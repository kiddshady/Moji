/* ═══════════════════════════════════════════════════════════════════════════
   MOJI — el ícono, horneado desde el código
   La carita de la marca (el mismo dibujo que `moji-mark` en app.js) sobre la
   baldosa de Onyx: a sangre, sin borde, esquinas al 19 %. Mismas proporciones
   que Tessera, medidas sobre su icon.png: trazo 7,2 % y glifo ~60 % del lienzo.

   Cada tamaño se dibuja a SU tamaño con supermuestreo, no se achica el de 256.
   Hasta 24 px (la bandeja a 100/125/150 %) se usa una versión ajustada al
   píxel: la marca escalada pegaba ojos y sonrisa al aro y a 16 px era una
   mancha. Los colores salen de tokens.css, así que un retint.mjs se arrastra
   con solo volver a correr esto.

   Sin dependencias; los encoders PNG/ICO son los de Mnemus.
   `npm run icons` regenera assets/ y deja la hoja de control en .shots/icons.png.
   ═══════════════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG } from './png.mjs';
import { encodeICO } from './ico.mjs';
import { oklchToHex } from './oklch.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets');

/* ── Color: los tokens de la app ─────────────────────────────────────────── */

const css = fs.readFileSync(path.join(ROOT, 'renderer/css/tokens.css'), 'utf8');
const num = (re, what) => {
  const m = css.match(re);
  if (!m) throw new Error(`tokens.css: no encontré ${what}`);
  return m.slice(1).map(Number);
};
const [HUE] = num(/--ox-hue:\s*([\d.]+)/, '--ox-hue');
const [TINT] = num(/--ox-tint:\s*([\d.]+)/, '--ox-tint');
const token = (name) => {
  const [L, C] = num(new RegExp(`--ox-${name}:\\s*oklch\\(([\\d.]+)%\\s+calc\\(([\\d.]+)\\s*\\*\\s*var\\(--ox-tint\\)\\)`), `--ox-${name}`);
  const hex = oklchToHex(L / 100, C * TINT, HUE);
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
};
const TILE = token('s1');    // el plano del rail y la statusbar
const INK = token('text');   // primario, nunca blanco puro

/* ── La cara ─────────────────────────────────────────────────────────────── */

/* La marca tal cual, en la grilla 16 del SVG. */
const MARK = {
  ring: { cx: 8, cy: 8, r: 6 },
  eyes: [[5.7, 5.8, 5.7, 6.4], [10.3, 5.8, 10.3, 6.4]],
  smile: [5.3, 9.4, 8, 12.6, 10.7, 9.4],          // M5.3 9.4 q2.7 3.2 5.4 0
};

/* La misma cara para la bandeja, en la grilla del lienzo: a 16 px cada unidad es
   un píxel, así que el aro, los ojos y el fondo de la sonrisa caen enteros en su
   fila o columna en vez de repartirse en grises. Elegida entre seis candidatas
   mirándolas a tamaño real (la sin aro se lee más fuerte, pero ya es otro dibujo). */
const HINTED = {
  ring: { cx: 8, cy: 8, r: 5.5 },
  eyes: [[5.5, 5.5, 5.5, 6.5], [10.5, 5.5, 10.5, 6.5]],
  smile: [5.5, 9, 8, 12, 10.5, 9],                // el fondo cae en y = 10,5
};

/* Geometría, trazo y escala (grilla de la cara → grilla 16 del lienzo) por tamaño.
   Desde 48 px, la proporción de Tessera: aro al 62,5 % del lienzo, trazo 7,2 %. */
function glyph(size) {
  if (size <= 24) return prepare(HINTED, 1.25, 1);
  const [frac, sw] = size >= 48 ? [0.625, 1.57] : [0.68, 1.85];
  return prepare(MARK, sw, (frac * 16) / (12 + sw));
}

function prepare(g, sw, scale) {
  const [x0, y0, cx, cy, x1, y1] = g.smile;
  const smile = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48; const u = 1 - t;
    smile.push([u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]);
  }
  const ys = smile.map((p) => p[1]);
  const box = [Math.min(x0, x1) - sw, Math.min(...ys) - sw, Math.max(x0, x1) + sw, Math.max(...ys) + sw];
  return { ...g, smile, box, half: sw / 2, scale };
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax; const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** ¿El punto (en la grilla de la cara) cae en la tinta? */
function inGlyph(g, x, y) {
  const { ring, eyes, smile, box, half } = g;
  if (Math.abs(Math.hypot(x - ring.cx, y - ring.cy) - ring.r) <= half) return true;
  for (const [ax, ay, bx, by] of eyes) if (segDist(x, y, ax, ay, bx, by) <= half) return true;
  if (x < box[0] || y < box[1] || x > box[2] || y > box[3]) return false;
  for (let i = 0; i < smile.length - 1; i++) {
    if (segDist(x, y, smile[i][0], smile[i][1], smile[i + 1][0], smile[i + 1][1]) <= half) return true;
  }
  return false;
}

const TILE_R = 0.19;   // radio de la baldosa sobre el lado

/** Baldosa redondeada a sangre sobre [0,1]². */
function inTile(u, v) {
  const qx = Math.abs(u - 0.5) - (0.5 - TILE_R);
  const qy = Math.abs(v - 0.5) - (0.5 - TILE_R);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - TILE_R <= 0;
}

function render(size) {
  const g = glyph(size);
  const N = size <= 64 ? 8 : 5;               // submuestras por lado
  const out = new Uint8Array(size * size * 4);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let tile = 0; let ink = 0;
      for (let sy = 0; sy < N; sy++) {
        for (let sx = 0; sx < N; sx++) {
          const u = (px + (sx + 0.5) / N) / size;
          const v = (py + (sy + 0.5) / N) / size;
          if (!inTile(u, v)) continue;
          tile++;
          if (inGlyph(g, (u * 16 - 8) / g.scale + 8, (v * 16 - 8) / g.scale + 8)) ink++;
        }
      }
      if (!tile) continue;
      const k = ink / tile; const o = (py * size + px) * 4;
      for (let c = 0; c < 3; c++) out[o + c] = Math.round(TILE[c] + (INK[c] - TILE[c]) * k);
      out[o + 3] = Math.round((tile / (N * N)) * 255);
    }
  }
  return out;
}

/* ── Hornear ─────────────────────────────────────────────────────────────── */

const ICO_SIZES = [256, 128, 64, 48, 40, 32, 24, 20, 16];
const TRAY_SIZES = [16, 20, 24, 32];
const images = new Map(ICO_SIZES.map((size) => [size, render(size)]));

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'icon.ico'), encodeICO(ICO_SIZES.map((size) => ({ size, data: images.get(size) }))));
fs.writeFileSync(path.join(OUT, 'icon.png'), encodePNG(256, 256, images.get(256)));
for (const size of TRAY_SIZES) fs.writeFileSync(path.join(OUT, `tray-${size}.png`), encodePNG(size, size, images.get(size)));

/* ── Hoja de control: cada tamaño a 1:1 y la bandeja ampliada por vecino más
   cercano, sobre la barra de tareas oscura y la clara de Windows 11. ─────── */

function sheet() {
  const GAP = 16;
  const cells = [...ICO_SIZES.map((s) => ({ s, zoom: 1 })), { s: 16, zoom: 10 }, { s: 24, zoom: 8 }, { s: 32, zoom: 6 }];
  const W = cells.reduce((w, c) => w + c.s * c.zoom + GAP, GAP);
  const rowH = 256 + GAP * 2;
  const px = new Uint8Array(W * rowH * 2 * 4);
  [[32, 32, 32], [243, 243, 243]].forEach((bg, row) => {
    for (let y = row * rowH; y < (row + 1) * rowH; y++) {
      for (let x = 0; x < W; x++) px.set([...bg, 255], (y * W + x) * 4);
    }
    let x0 = GAP;
    for (const { s, zoom } of cells) {
      const img = images.get(s); const side = s * zoom;
      const y0 = (row * rowH + GAP + (256 - side) / 2) | 0;
      for (let y = 0; y < side; y++) {
        for (let x = 0; x < side; x++) {
          const i = (((y / zoom) | 0) * s + ((x / zoom) | 0)) * 4; const a = img[i + 3] / 255;
          const o = ((y0 + y) * W + x0 + x) * 4;
          for (let c = 0; c < 3; c++) px[o + c] = Math.round(px[o + c] * (1 - a) + img[i + c] * a);
        }
      }
      x0 += side + GAP;
    }
  });
  return encodePNG(W, rowH * 2, px);
}

fs.mkdirSync(path.join(ROOT, '.shots'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '.shots/icons.png'), sheet());

const kb = (f) => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(1);
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
console.log(`baldosa ${hex(TILE)} · tinta ${hex(INK)} (hue ${HUE}, tint ${TINT})`);
console.log(`icon.ico  ${kb('icon.ico')} kB  (${ICO_SIZES.join(', ')})`);
console.log(`icon.png  ${kb('icon.png')} kB`);
console.log(`tray-*.png  ${TRAY_SIZES.join(', ')}`);
console.log('control: .shots/icons.png');
