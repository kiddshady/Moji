/* ═══════════════════════════════════════════════════════════════════════════
   MOJI — el ícono, horneado desde el código
   Una carita rellena, amarilla como el emoji clásico, sobre la baldosa de Onyx:
   a sangre, sin borde, esquinas al 19 %. La cara ocupa el 62 % del lienzo (68 %
   en la bandeja), con un degradé de amarillo a naranja que le da volumen y ojos
   y sonrisa marrones. Elegida en una hoja de control entre tres variantes (plana,
   con volumen, rasgos del color de la baldosa), al lado de Atlas, Beacon, Pharos
   y Tessera.

   Cada tamaño se dibuja a SU tamaño con supermuestreo, no se achica el de 256.
   Hasta 24 px (la bandeja a 100/125/150 %) se usa una versión ajustada al
   píxel: a 16 px los ojos caen en columnas enteras y no se funden en la cara.
   La baldosa sale de tokens.css, así que un retint.mjs se arrastra con solo
   volver a correr esto; el amarillo es del emoji, no del tema, y no cambia.

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

/* ── Color ───────────────────────────────────────────────────────────────── */

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
  return rgb(hex);
};
function rgb(hex) { return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); }
const TILE = token('s1');            // el plano del rail y la statusbar
const FACE_TOP = rgb('#ffdb5e');     // la cara, de arriba…
const FACE_BOTTOM = rgb('#f5a623');  // …a abajo
const FEATURES = rgb('#5c3a00');     // ojos y sonrisa

/* ── La cara ─────────────────────────────────────────────────────────────── */

/* Grilla 16, cara centrada en 8,8. Ojos: segmentos verticales de punta redonda;
   sonrisa: una cuadrática con trazo. */
const FACE = {
  r: 6,
  eyes: [[6, 5.35, 6, 6.45], [10, 5.35, 10, 6.45]], eyeHalf: 0.66,
  smile: [4.9, 8.9, 8, 12.9, 11.1, 8.9], smileHalf: 0.62,   // M4.9 8.9 Q8 12.9 11.1 8.9
};

/* La misma cara para la bandeja, en la grilla del lienzo: a 16 px cada unidad es
   un píxel. El disco (r 5,5) ocupa el 68 % y los ojos van en las columnas 5 y
   10 enteras, con la sonrisa apoyada en la fila 10. */
const HINTED = {
  r: 5.5,
  eyes: [[5.5, 5.5, 5.5, 6.5], [10.5, 5.5, 10.5, 6.5]], eyeHalf: 0.5,
  smile: [5.5, 9, 8, 12, 10.5, 9], smileHalf: 0.62,
};

/* Geometría y escala (grilla de la cara → grilla 16 del lienzo) por tamaño. */
function glyph(size) {
  if (size <= 24) return prepare(HINTED, 1);
  const span = size >= 48 ? 0.62 : 0.68;
  return prepare(FACE, (span * 16) / (2 * FACE.r));
}

function prepare(g, scale) {
  const [x0, y0, cx, cy, x1, y1] = g.smile;
  const smile = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48; const u = 1 - t;
    smile.push([u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]);
  }
  return { ...g, smile, scale };
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax; const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** El color de un punto (en la grilla de la cara), o null si cae fuera de ella. */
function faceColor(g, x, y) {
  if (Math.hypot(x - 8, y - 8) > g.r) return null;
  for (const [ax, ay, bx, by] of g.eyes) if (segDist(x, y, ax, ay, bx, by) <= g.eyeHalf) return FEATURES;
  for (let i = 0; i < g.smile.length - 1; i++) {
    if (segDist(x, y, g.smile[i][0], g.smile[i][1], g.smile[i + 1][0], g.smile[i + 1][1]) <= g.smileHalf) return FEATURES;
  }
  const t = (y - (8 - g.r)) / (2 * g.r);
  return FACE_TOP.map((c, i) => c + (FACE_BOTTOM[i] - c) * t);
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
      let tile = 0; const sum = [0, 0, 0];
      for (let sy = 0; sy < N; sy++) {
        for (let sx = 0; sx < N; sx++) {
          const u = (px + (sx + 0.5) / N) / size;
          const v = (py + (sy + 0.5) / N) / size;
          if (!inTile(u, v)) continue;
          tile++;
          const color = faceColor(g, (u * 16 - 8) / g.scale + 8, (v * 16 - 8) / g.scale + 8) || TILE;
          for (let c = 0; c < 3; c++) sum[c] += color[c];
        }
      }
      if (!tile) continue;
      const o = (py * size + px) * 4;
      for (let c = 0; c < 3; c++) out[o + c] = Math.round(sum[c] / tile);
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
console.log(`baldosa ${hex(TILE)} (hue ${HUE}, tint ${TINT}) · cara ${hex(FACE_TOP)} → ${hex(FACE_BOTTOM)} · rasgos ${hex(FEATURES)}`);
console.log(`icon.ico  ${kb('icon.ico')} kB  (${ICO_SIZES.join(', ')})`);
console.log(`icon.png  ${kb('icon.png')} kB`);
console.log(`tray-*.png  ${TRAY_SIZES.join(', ')}`);
console.log('control: .shots/icons.png');
