/* ═══════════════════════════════════════════════════════════════════════════
   Que lo chico se lea sobre el vidrio.

   Moji tiene el escritorio detrás (el acrílico de Windows 11, main.cjs), así
   que su fondo no es un color fijo. Este test hace la cuenta del peor caso,
   Moji abierto sobre un documento blanco, con el velo de moji.css y la
   escalera de texto que Moji le pisa a Opal:

     · el acrílico oscuro sobre blanco queda en un gris de 148 (medido con
       fotos de la pantalla, octubre de 2026: con un velo de .5 el panel daba
       79, y 79 = .5 · 10 + .5 · 148);
     · el velo de --op-bg encima, con el alfa de --moji-velo;
     · las hojas de Opal (--op-s1, --op-s2) suman su luz encima del panel.

   text-3 lleva información (etiquetas, el contador, la ayuda del pie): 4,5:1.
   text-4 es para lo que no informa (placeholder, apagado): 3:1.
   ═══════════════════════════════════════════════════════════════════════════ */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { oklchToHex } from '../tools/oklch.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, 'renderer', 'css', f), 'utf8');
const tokens = read('tokens.css');
const moji = read('moji.css');

const ACRILICO_SOBRE_BLANCO = 148;

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FALLA ${name}  ${detail}`); }
};

const num = (src, re) => Number(src.match(re)?.[1]);
const hue = num(tokens, /--op-hue:\s*([\d.]+)/);
const tint = num(tokens, /--op-tint:\s*([\d.]+)/);
const velo = num(moji, /--moji-velo:\s*([\d.]+)/);
ok('moji.css declara --moji-velo', Number.isFinite(velo), String(velo));

/** Un token oklch de la escalera: el de moji.css si lo pisa, si no el de Opal. */
const gray = (name) => {
  const re = new RegExp(`--op-${name}:\\s*oklch\\(([\\d.]+)%\\s*calc\\(([\\d.]+)\\s*\\*\\s*var\\(--op-tint\\)\\)`);
  const m = moji.match(re) || tokens.match(re);
  return m && oklchToHex(Number(m[1]) / 100, Number(m[2]) * tint, hue);
};
const sheet = (name) => num(tokens, new RegExp(`--op-${name}:\\s*rgb\\(255 255 255 / ([\\d.]+)\\)`));

const ch = (hex, i) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
const lum = (rgb) => {
  const c = rgb.map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const bg = gray('bg');
const panel = [0, 1, 2].map((i) => velo * ch(bg, i) + (1 - velo) * ACRILICO_SOBRE_BLANCO);
const over = (alpha) => panel.map((v) => v + alpha * (255 - v));

console.log(`\nPeor caso: Moji sobre un documento blanco, velo ${velo}`);
const fondos = { panel, 'hoja s1 (el pie)': over(sheet('s1')), 'hoja s2 (Ajustes)': over(sheet('s2')) };
for (const [donde, fondo] of Object.entries(fondos)) {
  const t3 = [0, 1, 2].map((i) => ch(gray('text-3'), i));
  const r = contrast(t3, fondo);
  ok(`text-3 sobre ${donde} pasa 4,5:1`, r >= 4.5, `${r.toFixed(2)} (fondo ${fondo.map(Math.round).join(',')})`);
}
const t4 = [0, 1, 2].map((i) => ch(gray('text-4'), i));
const r4 = contrast(t4, panel);
ok('text-4 sobre el panel pasa 3:1', r4 >= 3, r4.toFixed(2));

console.log('\nLa escalera no se invierte');
const L = (name) => lum([0, 1, 2].map((i) => ch(gray(name), i)));
ok('text > text-2 > text-3 > text-4', L('text') > L('text-2') && L('text-2') > L('text-3') && L('text-3') > L('text-4'));

console.log('\nLo que informa no usa text-4');
for (const sel of ['#result-count', '#preview-hint', '.empty small', '.about small', 'kbd']) {
  const rule = moji.match(new RegExp(`(^|\\n)${sel.replace(/[.#]/g, '\\$&')}\\s*\\{[^}]*\\}`))?.[0] || '';
  ok(`${sel} no usa text-4`, !!rule && !rule.includes('--op-text-4'), rule.trim().slice(0, 80) || 'no está la regla');
}

console.log(`\n═══ ${pass} ok · ${fail} fallas ═══`);
process.exit(fail ? 1 : 0);
