'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   Arma renderer/data/catalog.json: los emojis de Emojibase (nombres en
   español, con los del inglés y unos alias rioplatenses como etiquetas de
   búsqueda) más la selección propia de kaomojis y símbolos.

     npm run catalog

   Los ids no se tocan nunca: «Más usados» guarda los usos por id, y uno que
   cambie se pierde de la lista.
   ═══════════════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const es = require('emojibase-data/es/data.json');
const en = new Map(require('emojibase-data/en/data.json').map((e) => [e.hexcode, e]));

/* ── Emojis ───────────────────────────────────────────────────────────────── */

// Los grupos de Emojibase que van (el 2, componentes, queda afuera).
const groupNames = {
  0: 'Caritas y emociones',
  1: 'Personas y manos',
  3: 'Animales y naturaleza',
  4: 'Comida y bebida',
  5: 'Viajes y lugares',
  6: 'Actividades',
  7: 'Objetos',
  8: 'Símbolos emoji',
  9: 'Banderas',
};

// Cómo se los busca acá, además de los nombres oficiales.
const aliases = {
  '1F602': 'jajaja risa risas lol',
  '1F923': 'jajaja risa carcajada lol',
  '1F601': 'feliz sonrisa dientes',
  '1F44D': 'bien ok dale like pulgar',
  '1F44E': 'mal dislike pulgar',
  '1F9C9': 'mate argentina',
  '1F1E6-1F1F7': 'argentina bandera',
  '2764': 'amor corazón corazon rojo',
  '1F525': 'fuego buenisimo',
  '1F389': 'fiesta cumple cumpleaños',
  '1F914': 'pensar duda mmm',
  '1F480': 'calavera muerto me muero',
};

const items = es
  .filter((e) => groupNames[e.group] && Number.isFinite(e.order))
  .map((e) => ({
    id: e.hexcode,
    kind: 'emoji',
    category: String(e.group),
    label: e.label,
    value: e.emoji,
    tags: [...(e.tags || []), en.get(e.hexcode)?.label || '', ...(en.get(e.hexcode)?.tags || []), aliases[e.hexcode] || ''].join(' '),
    skins: (e.skins || []).filter((s) => Number.isInteger(s.tone)).map((s) => ({ tone: s.tone, value: s.emoji })),
    version: e.version,
  }));

/* ── Kaomojis ─────────────────────────────────────────────────────────────────
   [carácter, nombre]. El nombre es lo que dicen el tooltip y la vista previa;
   el id sale de la categoría y la posición, así que agregar va al final. */

const kaos = {
  'Alegría': [
    ['(＾▽＾)', 'sonrisa grande'],
    ['(≧▽≦)', 'feliz con los ojos cerrados'],
    ['ヽ(・∀・)ﾉ', 'brazos arriba'],
    ['(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧', 'tirando brillitos'],
    ['(*^‿^*)', 'sonrisa con cachetes'],
    ['(⌒‿⌒)', 'sonrisa tranquila'],
    ['(✧ω✧)', 'ojos brillantes'],
    ['( ´ ▽ ` )', 'contento'],
    ['٩(◕‿◕｡)۶', 'festejando'],
    ['(๑˃ᴗ˂)ﻭ', 'puño arriba'],
    ['ヾ(☆▽☆)', 'saludo con estrellas'],
    ['(o´▽`o)', 'risa con cachetes'],
  ],
  'Amor': [
    ['(♡˙︶˙♡)', 'enamorado'],
    ['(｡♥‿♥｡)', 'ojos de corazón'],
    ['(づ｡◕‿‿◕｡)づ', 'abrazo'],
    ['(っ˘з(˘⌣˘ )', 'beso'],
    ['( ˘ ³˘)♥', 'tirando un beso'],
    ['(♡°▽°♡)', 'flechado'],
    ['(◕‿◕)♡', 'cariño'],
    ['(⁄ ⁄•⁄ω⁄•⁄ ⁄)', 'sonrojado'],
    ['(つ≧▽≦)つ', 'abrazo feliz'],
    ['♡( ◡‿◡ )', 'ternura'],
  ],
  'Tristeza': [
    ['(╥﹏╥)', 'llorando'],
    ['(｡•́︿•̀｡)', 'puchero'],
    ['(ಥ﹏ಥ)', 'llanto desconsolado'],
    ['(つω`｡)', 'secándose las lágrimas'],
    ['(T_T)', 'lágrimas'],
    ['(；ω；)', 'a punto de llorar'],
    ['(ノ_<。)', 'tapándose la cara'],
    ['(｡╯︵╰｡)', 'triste'],
    ['(╯︵╰,)', 'desanimado'],
    ['(っ˘̩╭╮˘̩)っ', 'pidiendo un abrazo'],
  ],
  'Sorpresa': [
    ['(⊙_⊙)', 'ojos como platos'],
    ['Σ(°ロ°)', 'sobresalto'],
    ['(°口°)！', 'boca abierta'],
    ['(O_O;)', 'sorpresa incómoda'],
    ['(⊙ω⊙)', 'asombro'],
    ['(・・;)', 'nervioso'],
    ['(゜-゜)', 'desconcierto'],
    ['(⊙﹏⊙)', 'preocupado'],
    ['(＃°Д°)', 'indignado'],
    ['(ﾉﾟ0ﾟ)ﾉ', 'manos arriba de sorpresa'],
  ],
  'Actitud': [
    ['¯\\_(ツ)_/¯', 'qué sé yo'],
    ['(¬‿¬)', 'pícaro'],
    ['( •_•)>⌐■-■', 'poniéndose los anteojos'],
    ['(⌐■_■)', 'con anteojos de sol'],
    ['(ง •̀_•́)ง', 'listo para pelear'],
    ['(╯°□°)╯︵ ┻━┻', 'dando vuelta la mesa'],
    ['┬─┬ノ( º _ ºノ)', 'acomodando la mesa'],
    ['ಠ_ಠ', 'mirada de desaprobación'],
    ['(눈_눈)', 'mirada sospechosa'],
    ['( •̀ ω •́ )✧', 'decidido'],
    ['(￣ヘ￣)', 'enojado'],
    ['(－_－) zzZ', 'durmiendo'],
  ],
  'Animales': [
    ['ฅ^•ﻌ•^ฅ', 'gato con patitas'],
    ['(=^･ω･^=)', 'gato'],
    ['ʕ•ᴥ•ʔ', 'oso'],
    ['／(≧ x ≦)＼', 'conejo apretando los ojos'],
    ['(=｀ω´=)', 'gato enojado'],
    ['U・ᴥ・U', 'perro'],
    ['(•ө•)', 'pollito'],
    ['(=①ω①=)', 'gato sorprendido'],
    ['ʕっ•ᴥ•ʔっ', 'oso abrazando'],
    ['／(^ x ^)＼', 'conejo'],
  ],
};

const kaoTags = {
  'Alegría': 'feliz risa sonrisa fiesta',
  'Actitud': 'meh duda enojo dormir pelea shrug mesa',
};

for (const [category, values] of Object.entries(kaos)) {
  values.forEach(([value, label], i) => items.push({
    id: `kao-${category}-${i}`,
    kind: 'kaomoji',
    category,
    label,
    value,
    tags: `${category} ${kaoTags[category] || category.toLowerCase()}`,
  }));
}

/* ── Símbolos ─────────────────────────────────────────────────────────────── */

const greekNames = ['alfa', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu micro', 'nu', 'xi', 'omicron', 'pi', 'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega'];
const greekLower = 'αβγδεζηθικλμνξοπρστυφχψω';

const symbols = {
  'Matemática': [
    ['±', 'más menos'], ['×', 'multiplicación por'], ['÷', 'división'], ['≠', 'distinto desigual'],
    ['≈', 'aproximadamente'], ['≤', 'menor igual'], ['≥', 'mayor igual'], ['∞', 'infinito'],
    ['√', 'raíz cuadrada'], ['∑', 'sumatoria sigma'], ['∏', 'productoria'], ['∫', 'integral'],
    ['∂', 'derivada parcial'], ['∆', 'incremento delta'], ['∇', 'nabla'], ['∈', 'pertenece'],
    ['∉', 'no pertenece'], ['∩', 'intersección'], ['∪', 'unión'], ['∅', 'vacío'],
    ['∀', 'para todo'], ['∃', 'existe'], ['∝', 'proporcional'], ['π', 'pi'],
    ['‰', 'por mil'], ['°', 'grados'],
  ],
  'Flechas': [
    ['←', 'izquierda'], ['→', 'derecha reacción'], ['↑', 'arriba gas'], ['↓', 'abajo precipitado'],
    ['↔', 'ambos lados'], ['↕', 'vertical'], ['↗', 'noreste'], ['↘', 'sureste'],
    ['↙', 'suroeste'], ['↖', 'noroeste'], ['⇒', 'implica'], ['⇐', 'implica izquierda'],
    ['⇔', 'equivalencia'], ['⇌', 'equilibrio químico'], ['⇄', 'reversible'], ['⟶', 'flecha larga reacción'],
  ],
  'Letras griegas': Array.from('αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΘΛΞΠΣΦΨΩ')
    .map((c) => [c, `${greekNames[greekLower.indexOf(c.toLowerCase())] || ''} griega`]),
  'Tipografía': [
    ['©', 'copyright'], ['®', 'marca registrada'], ['™', 'marca comercial'], ['…', 'puntos suspensivos'],
    ['—', 'raya guion largo'], ['–', 'guion medio'], ['·', 'punto medio'], ['•', 'viñeta'],
    ['§', 'sección'], ['¶', 'párrafo'], ['†', 'daga'], ['‡', 'doble daga'],
    ['«', 'comillas apertura'], ['»', 'comillas cierre'], ['“', 'comilla curva apertura'], ['”', 'comilla curva cierre'],
    ['‘', 'comilla simple apertura'], ['’', 'apóstrofo'], ['¿', 'pregunta apertura'], ['¡', 'exclamación apertura'],
  ],
  'Monedas': [
    ['$', 'peso dólar'], ['€', 'euro'], ['£', 'libra'], ['¥', 'yen yuan'], ['₿', 'bitcoin'],
    ['¢', 'centavo'], ['₽', 'rublo'], ['₹', 'rupia'], ['₩', 'won'], ['₺', 'lira'],
  ],
  // Los 19 primeros son superíndices y los 10 siguientes, los subíndices del 0 al 9.
  'Super y subíndices': Array.from('⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿᵃᵇᶜ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎')
    .map((c, i) => [c, `${i < 19 ? 'superíndice exponente' : 'subíndice química'} ${i < 10 ? i : i >= 19 && i < 29 ? i - 19 : ''}`]),
  'Formas': [
    ['✓', 'tilde correcto check'], ['✗', 'cruz incorrecto'], ['★', 'estrella llena'], ['☆', 'estrella vacía'],
    ['●', 'círculo lleno'], ['○', 'círculo vacío'], ['■', 'cuadrado lleno'], ['□', 'cuadrado vacío'],
    ['◆', 'rombo lleno'], ['◇', 'rombo vacío'], ['▲', 'triángulo arriba'], ['▼', 'triángulo abajo'],
    ['◀', 'triángulo izquierda'], ['▶', 'triángulo derecha'], ['♡', 'corazón contorno'], ['♥', 'corazón lleno'],
    ['♪', 'nota musical'], ['♫', 'notas musicales'],
  ],
};

for (const [category, values] of Object.entries(symbols)) {
  values.forEach(([value, label], i) => items.push({ id: `sym-${category}-${i}`, kind: 'symbol', category, label, value, tags: category }));
}

/* ── Salida ───────────────────────────────────────────────────────────────── */

const categories = {
  emoji: Object.entries(groupNames).map(([id, label]) => ({ id, label })),
  kaomoji: Object.keys(kaos).map((id) => ({ id, label: id })),
  symbol: Object.keys(symbols).map((id) => ({ id, label: id })),
};

fs.mkdirSync(path.join(root, 'renderer/data'), { recursive: true });
fs.writeFileSync(path.join(root, 'renderer/data/catalog.json'), JSON.stringify({ categories, items }));
console.log(`${items.length} caracteres preparados.`);
