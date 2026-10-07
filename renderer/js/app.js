/* ═══════════════════════════════════════════════════════════════════════════
   MOJI — el panel

   Una sola ventana con dos caras que comparten celda: el panel (pestañas,
   búsqueda, grilla y pie con la vista previa) y Ajustes. El main la esconde y
   la vuelve a mostrar con el atajo; cada vez que abre manda `panel:opened` con
   el estado fresco y acá se rearma (ver api.onOpen, al final).

   El renderer no inserta nada: le pasa al main el id del catálogo y el tono, y
   el main resuelve el carácter y lo manda con SendInput (src/native.cjs).
   ═══════════════════════════════════════════════════════════════════════════ */

import { Icons } from './icons.js';
import { Tooltip, Menu, Modal } from './overlays.js';
import { exit, swap, tick, scrollFade } from './motion.js';
import { searchItems, variant } from './search.mjs';

Icons.add({
  'moji-mark': '<circle cx="8" cy="8" r="6"/><path d="M5.3 9.4q2.7 3.2 5.4 0M5.7 5.8v.6m4.6-.6v.6"/>',
  // La carita del ícono de la app (tools/icons.mjs), a color: solo va en la titlebar.
  'moji-face': '<defs><linearGradient id="moji-face-fill" x1="0" y1="2" x2="0" y2="14" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffdb5e"/><stop offset="1" stop-color="#f5a623"/></linearGradient></defs><circle cx="8" cy="8" r="6" fill="url(#moji-face-fill)" stroke="none"/><path d="M6 5.35v1.1M10 5.35v1.1" stroke="#5c3a00" stroke-width="1.32"/><path d="M4.9 8.9Q8 12.9 11.1 8.9" stroke="#5c3a00" stroke-width="1.24"/>',
  'moji-smile': '<circle cx="8" cy="8" r="6"/><path d="M5.3 9.4q2.7 3.2 5.4 0M5.7 5.8v.6m4.6-.6v.6"/>',
  'moji-used': '<path d="M2 6a6 6 0 1 1 0 4M2 2v4h4M8 4.5V8l2.3 1.5"/>',
  'moji-kao': '<path d="M3.5 3C.8 5.5.8 10.5 3.5 13M12.5 3c2.7 2.5 2.7 7.5 0 10M5 6.7l1-1 1 1m2 0 1-1 1 1M6.8 10h2.4"/>',
  'moji-symbol': '<path d="M3 3h5M5.5 1v4M2 12l3-5 3 5zM10 6h4M10 9h4M12 11v3m-1.5-1.5h3"/>',
  'moji-search': '<circle cx="6.7" cy="6.7" r="4.7"/><path d="m10.2 10.2 3.8 3.8"/>',
  'moji-close': '<path d="m4 4 8 8M4 12l8-8"/>',
  'moji-back': '<path d="m9 3-5 5 5 5M4 8h9"/>',
  'moji-power': '<path d="M8 2.2v5.3M4.5 4.3a5 5 0 1 0 7 0"/>',
  'moji-settings': '<path d="M3 4h10M3 8h10M3 12h10"/><circle cx="6" cy="4" r="1.5" fill="var(--op-bg)"/><circle cx="10" cy="8" r="1.5" fill="var(--op-bg)"/><circle cx="6" cy="12" r="1.5" fill="var(--op-bg)"/>',
});
Icons.mount();
Tooltip.init();

const $ = (id) => document.getElementById(id);
const api = window.moji;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/* ── Textos que se ponen al día ─────────────────────────────────────────────
   swap() de Opal releva lo viejo por lo nuevo en la misma celda. Pero si en
   una frase solo cambian las cifras («Bajando la 0.5.0… 41 %» → «42 %»),
   relevarla entera la apagaría y la prendería en cada paso: ahí se reescribe
   en su lugar y destella (tick). Mientras un relevo está en curso no se toca
   lo que se va: va como relevo. */
function frase(el, html) {
  const live = el.querySelector(':scope > .op-swap__item:not([data-state=closing])');
  const digits = (h) => h.replace(/\d+/g, '#');
  const same = live && el.__swap != null && el.__swap !== html && digits(el.__swap) === digits(html)
    && el.querySelectorAll(':scope > .op-swap__item').length === 1;
  if (!same) return swap(el, html);
  live.innerHTML = html;
  el.__swap = html;   // la memoria de swap(): el próximo relevo compara contra esto
  tick(el);   // en el contenedor: el ítem asentado tiene animation: none y le ganaría
  return live;
}

/** Un número suelto: en su lugar, y destella si cambió. El primero no. */
function numero(el, n) {
  const text = String(n);
  if (el.textContent === text) return;
  const first = el.textContent === '';
  el.textContent = text;
  if (!first) tick(el);
}

/* ── Constantes ─────────────────────────────────────────────────────────── */

const TYPES = [
  ['frequent', 'Más usados', 'moji-used'],
  ['emoji', 'Emojis', 'moji-smile'],
  ['kaomoji', 'Kaomojis', 'moji-kao'],
  ['symbol', 'Símbolos', 'moji-symbol'],
];
const TONE_COLORS = ['#f4c542', '#f6d7b0', '#dfb18c', '#ba845b', '#8f5d40', '#593f32'];
const TONE_NAMES = ['Original', 'Claro', 'Claro medio', 'Medio', 'Oscuro medio', 'Oscuro'];

/** Lo que se muestra en «Más usados» hasta que haya usos propios. */
const SEED = [
  '1F601', '1F602', '1F923', '1F60A', '1F609', '1F60D', '1F970', '1F618',
  '1F60E', '1F914', '1F62D', '1F605', '1F44D', '1F44F', '1F64C', '1F64F',
  '2764', '1F525', '2728', '1F389', '1F4AA', '1F440', '1F9C9', '1F680',
];

const PLACEHOLDER = {
  symbol: 'Buscá: raíz, flecha, alfa…',
  kaomoji: 'Buscá: alegría, tristeza, animales…',
  default: 'Buscá: corazón, pulgar, mate…',
};

/* ── Estado ─────────────────────────────────────────────────────────────── */

let state;            // lo que manda el main (snapshot): ajustes, usos, versión
let catalog;          // renderer/data/catalog.json
let byId;
let category = 'all';
let visible = [];     // los ítems de la grilla, en orden: data-index apunta acá
let settingsOpen = false;
let sending = false;
let inserted = false; // después de insertar, Esc cierra directo
let noticeTimer;
let previewed;

/* ── Entradas y salidas de las dos caras y el aviso ─────────────────────────
   No salen del DOM, se ocultan. arrive/leave les dan entrada y salida
   animadas; la entrada se apaga con .is-settled (nunca con style.animation,
   que le ganaría a la regla de salida). mode: 'still' sin animación, 'in'
   entra, 'after' entra cuando la otra ya va por la mitad de su salida
   (relevo). */

function leave(el) {
  if (el.hidden || el.dataset.state === 'closing') return;
  el.dataset.state = 'closing';
  const cancel = () => {
    clearTimeout(timer);
    el.removeEventListener('animationend', onEnd);
    el._cancelLeave = null;
  };
  const end = () => {
    cancel();
    delete el.dataset.state;
    el.hidden = true;
  };
  const onEnd = (e) => { if (e.target === el) end(); };
  const timer = setTimeout(end, 260);
  el.addEventListener('animationend', onEnd);
  el._cancelLeave = cancel;
}

function arrive(el, mode = 'in') {
  el._cancelLeave?.();
  delete el.dataset.state;
  el.classList.toggle('is-after', mode === 'after');
  if (mode === 'still') {
    el.classList.add('is-settled');
    el.hidden = false;
    return;
  }
  el.classList.remove('is-settled');
  el.hidden = false;
  el.addEventListener('animationend', function done(e) {
    if (e.target !== el) return;
    el.removeEventListener('animationend', done);
    if (!el.dataset.state) {
      el.classList.add('is-settled');
      el.classList.remove('is-after');
    }
  });
}

function drop(el) {
  el._cancelLeave?.();
  delete el.dataset.state;
  el.hidden = true;
}

/* El aviso de abajo. Si ya está a la vista, el texto nuevo releva al viejo en
   su lugar (antes cambiaba de un cuadro al otro). Si estaba oculto, entra con
   un renglón nuevo: un nodo fresco, así swap() no compara contra un texto que
   ya no está. */
function notice(message, error = false) {
  clearTimeout(noticeTimer);
  const n = $('notice');
  n.classList.toggle('error', error);
  const shown = !n.hidden && !n.dataset.state;
  const line = n.querySelector(':scope > .notice-text');
  if (shown && line) {
    swap(line, esc(message));
  } else {
    const fresh = document.createElement('span');
    fresh.className = 'notice-text';
    fresh.textContent = message;
    n.replaceChildren(fresh);
    arrive(n);
  }
  noticeTimer = setTimeout(() => leave(n), error ? 7000 : 2000);
}

async function settings(patch) {
  try {
    state = await api.settings(patch);
    return true;
  } catch (e) {
    notice(e.message, true);
    return false;
  }
}

/** En Más usados cada uno conserva el tono con que se eligió. */
function toneFor(item) {
  if (state.tab !== 'frequent') return state.tone;
  return state.usage.find((u) => u.id === item.id)?.tone ?? state.tone;
}

/* ── Vista previa del pie ────────────────────────────────────────────────────
   Cambia con cada carácter que se recorre, así que no hace relevo (se
   quedaría a media luz todo el tiempo): lo nuevo se escribe en su lugar y
   sube desde transparente en un tiempo de hover. Al vaciarse se esfuma antes
   de borrar el texto. */

function pulse(el, from, to, done) {
  el.__pulso?.cancel();
  el.__pulso = el.animate([{ opacity: from }, { opacity: to }], { duration: 110, easing: 'cubic-bezier(.33,1,.68,1)' });
  if (done) el.__pulso.onfinish = done;
}

function preview(item) {
  if (item === previewed) return;
  const had = !!previewed;
  previewed = item;
  const char = $('preview-char');
  const label = $('preview-label');
  if (!item) {
    if (!had) return;
    const clear = () => {
      if (previewed) return;
      char.textContent = '';
      label.textContent = '';
    };
    pulse(char, 1, 0, clear);
    pulse(label, 1, 0);
    return;
  }
  char.textContent = variant(item, toneFor(item));
  char.classList.toggle('kao-preview', item.kind === 'kaomoji');
  label.textContent = item.label;
  pulse(char, 0.35, 1);
  pulse(label, 0.35, 1);
}

/* ── Pestañas y categorías ──────────────────────────────────────────────── */

function renderTabs() {
  for (const [id, label, icon] of TYPES) {
    const b = document.createElement('button');
    b.className = 'tab';
    b.id = `tab-${id}`;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-controls', 'results');
    b.setAttribute('aria-selected', String(id === state.tab));
    b.dataset.tab = id;
    b.innerHTML = `${Icons.svg(icon)}<span>${label}</span>`;
    b.onclick = () => changeTab(id);
    $('tabs').append(b);
  }
}

// focusTab: con las flechas sobre las pestañas el foco se queda en la pestaña.
async function changeTab(id, focusTab = false) {
  const focus = () => (focusTab ? $(`tab-${id}`) : $('search')).focus();
  if (id === state.tab && category === 'all' && !$('search').value) {
    focus();
    return;
  }
  state.tab = id;
  category = 'all';
  $('search').value = '';
  render('swap');
  focus();
  await settings({ tab: id });
}

/* Los chips se arman una vez por pestaña; elegir uno solo cambia
   aria-pressed, así el fondo transiciona y el scroll horizontal queda donde
   estaba. */
function renderCategories() {
  const box = $('categories');
  if (box.dataset.tab !== state.tab) {
    box.replaceChildren();
    const cats = state.tab === 'frequent'
      ? [{ id: 'all', label: 'Todos' }, { id: 'emoji', label: 'Emojis' }, { id: 'kaomoji', label: 'Kaomojis' }, { id: 'symbol', label: 'Símbolos' }]
      : [{ id: 'all', label: 'Todos' }, ...catalog.categories[state.tab]];
    for (const c of cats) {
      const b = document.createElement('button');
      b.className = 'category';
      b.textContent = c.label;
      b.dataset.id = c.id;
      b.onclick = () => {
        if (category === c.id) return;
        category = c.id;
        render('swap');
        b.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      };
      box.append(b);
    }
    box.dataset.tab = state.tab;
    box.scrollLeft = 0;
  }
  for (const b of box.children) b.setAttribute('aria-pressed', String(b.dataset.id === category));
  edgeFade(box);
}

/* La tira de categorías se recorta a lo ancho: se esfuma solo del lado donde
   hay más chips (pegada al principio, el borde izquierdo corta limpio). */
function edgeFade(box) {
  const slack = box.scrollWidth - box.clientWidth;
  box.classList.toggle('is-start', box.scrollLeft <= 1);
  box.classList.toggle('is-end', slack <= 1 || box.scrollLeft >= slack - 1);
}

/* ── La grilla ──────────────────────────────────────────────────────────── */

/* Relevo de resultados: la tanda vieja y la nueva comparten la misma celda de
   .results; la vieja se desvanece quieta en su lugar y la nueva entra un
   toque después. 'still' (tipear, tono, abrir el panel) cambia en el acto:
   filtrar mientras escribís no espera a ninguna animación. */
function mount(set, mode) {
  const box = $('results');
  box.querySelectorAll(':scope > [data-state=closing]').forEach((e) => e.remove());
  const old = box.querySelector(':scope > .result-set');
  if (mode === 'swap' && old) {
    old.style.transform = `translateY(${-box.scrollTop}px)`;
    exit(old, { fallback: 220 });
    set.classList.add('is-after');
    set.addEventListener('animationend', function done(e) {
      if (e.target !== set) return;
      set.removeEventListener('animationend', done);
      set.classList.add('is-settled');
    });
  } else {
    old?.remove();
    set.classList.add('is-settled');
  }
  box.append(set);
  box.scrollTop = 0;
}

/** Los ítems que van a la grilla según pestaña, categoría y búsqueda. */
function itemsFor(query) {
  if (state.tab === 'frequent') {
    let items = state.usage.length
      ? state.usage.map((u) => byId.get(u.id)).filter(Boolean)
      : SEED.map((id) => byId.get(id)).filter(Boolean);
    if (query) items = catalog.items;
    if (category !== 'all') items = items.filter((i) => i.kind === category);
    return searchItems(items, query);
  }
  const ofTab = catalog.items.filter((i) => i.kind === state.tab);
  if (category !== 'all') return searchItems(ofTab.filter((i) => i.category === category), query);
  if (query) return searchItems(ofTab, query);
  // «Todos» sin búsqueda va agrupado, en el orden de las categorías: es lo que
  // permite ponerle título a cada grupo.
  return catalog.categories[state.tab].flatMap((c) => ofTab.filter((i) => i.category === c.id));
}

/** ¿La grilla lleva títulos de grupo? Solo en «Todos» de una pestaña y sin búsqueda. */
const grouped = (query) => state.tab !== 'frequent' && category === 'all' && !query;

function sectionName(query) {
  if (query) return 'Resultados';
  if (state.tab === 'frequent') return state.usage.length ? 'Tus más usados' : 'Para empezar';
  if (category === 'all') return TYPES.find((t) => t[0] === state.tab)[1];
  return catalog.categories[state.tab].find((c) => c.id === category)?.label || category;
}

function render(mode = 'still') {
  Tooltip.hide(); // su botón se va con la tanda vieja sin disparar pointerout
  document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === state.tab)));
  renderCategories();

  const query = $('search').value.trim();
  $('clear-search').classList.toggle('is-off', !query);
  $('search-key').classList.toggle('is-off', !!query);

  visible = itemsFor(query);
  frase($('section-name'), esc(sectionName(query)));
  numero($('result-count'), visible.length);
  $('results').setAttribute('aria-labelledby', `tab-${state.tab}`);

  const grid = document.createElement('div');
  grid.className = `result-set grid ${state.tab === 'frequent' ? 'mixed' : state.tab}`;
  const titles = grouped(query) ? new Map(catalog.categories[state.tab].map((c) => [c.id, c.label])) : null;
  let group = null;
  for (const [index, item] of visible.entries()) {
    if (titles && item.category !== group) {
      group = item.category;
      const t = document.createElement('div');
      t.className = 'group-title';
      t.textContent = titles.get(group) || group;
      grid.append(t);
    }
    const b = document.createElement('button');
    b.className = 'character';
    b.dataset.id = item.id;
    b.dataset.kind = item.kind;
    b.dataset.index = index;
    b.setAttribute('aria-label', item.label);
    b.dataset.tip = item.label;
    b.dataset.tipSide = 'top';
    const span = document.createElement('span');
    span.className = 'glyph';
    span.textContent = variant(item, toneFor(item));
    b.append(span);
    grid.append(b);
  }

  if (!visible.length) {
    grid.className = 'result-set empty';
    grid.innerHTML = Icons.svg('moji-search');
    const label = document.createElement('span');
    label.textContent = query ? 'No encontramos ese carácter.' : 'Todavía no usaste caracteres de este tipo.';
    const small = document.createElement('small');
    small.textContent = query ? 'Probá con otra palabra o categoría.' : 'Los que elijas van a aparecer acá.';
    grid.append(label, small);
  }

  mount(grid, mode);
  $('tone').querySelector('.tone-dot').style.background = TONE_COLORS[state.tone];
  $('tone').classList.toggle('is-off', state.tab === 'kaomoji' || state.tab === 'symbol');
  preview(null);
  $('search').placeholder = PLACEHOLDER[state.tab] || PLACEHOLDER.default;
}

/* Un solo escuchador para toda la grilla (Emojis tiene casi 2000 botones). La
   tanda que se está yendo no cuenta. */
const itemOf = (target) => {
  const b = target.closest?.('.character');
  return b && !b.parentElement.dataset.state ? visible[Number(b.dataset.index)] : null;
};
$('results').addEventListener('mouseover', (e) => { const item = itemOf(e.target); if (item) preview(item); });
$('results').addEventListener('focusin', (e) => { const item = itemOf(e.target); if (item) preview(item); });
$('results').addEventListener('click', (e) => { const item = itemOf(e.target); if (item) choose(item); });
$('results').addEventListener('contextmenu', (e) => {
  const item = itemOf(e.target);
  if (!item) return;
  e.preventDefault();
  choose(item, true);
});

async function choose(item, copyOnly = false) {
  if (sending) return;
  sending = true;
  Tooltip.hide(true);
  try {
    const result = await api.choose(item.id, toneFor(item), copyOnly);
    state = result.state;
    if (copyOnly) {
      notice('Copiado');
      if (state.tab === 'frequent' && $('search').value === '') render();
    } else {
      inserted = true;
    }
  } catch (e) {
    notice(e.message, true);
  } finally {
    sending = false;
  }
}

/* ── Actualizaciones ────────────────────────────────────────────────────────
   El main baja la versión nueva solo (src/updater.cjs); acá solo se cuenta y
   se ofrece instalar. */

const UPDATE_TEXT = {
  dev: () => 'Corriendo desde el código: se actualiza la versión instalada.',
  portable: () => 'Versión portable: bajá la nueva desde GitHub.',
  idle: () => 'Se buscan solas al abrir Moji.',
  checking: () => 'Buscando…',
  none: () => 'Tenés la última versión.',
  downloading: (u) => `Bajando la ${u.version}… ${u.percent || 0} %`,
  ready: (u) => `La ${u.version} está lista para instalarse.`,
  error: () => 'No se pudo buscar. Revisá la conexión.',
};
let announced = '';

/* Con la versión lista, el botón pasa a primario: es la única acción que
   importa en Ajustes. Su rótulo cambia con un relevo y el ancho viaja
   (swap con size; .op-swap--row lo deja en fila). */
function renderUpdate(u) {
  state.update = u;
  frase($('update-status'), esc((UPDATE_TEXT[u.state] || UPDATE_TEXT.idle)(u)));
  const b = $('update-action');
  const ready = u.state === 'ready';
  const label = ready ? 'Instalar' : u.state === 'error' ? 'Reintentar' : 'Buscar';
  b.classList.toggle('is-off', ['dev', 'portable', 'downloading'].includes(u.state));
  b.disabled = u.state === 'checking';
  b.classList.toggle('op-btn--primary', ready);
  b.classList.toggle('op-btn--secondary', !ready);
  b.setAttribute('aria-label', ready ? 'Instalar y reiniciar' : u.state === 'error' ? 'Reintentar' : 'Buscar actualizaciones');
  swap(b, `${Icons.svg(ready ? 'download' : 'retry')}<span>${label}</span>`, { size: true });
}

$('update-action').onclick = async () => {
  if (state.update?.state === 'ready') {
    api.installUpdate();
    return;
  }
  try {
    renderUpdate(await api.checkUpdate());
  } catch (e) {
    notice(e.message, true);
  }
};

api.onUpdate((u) => {
  if (!state) return;
  renderUpdate(u);
  if (u.state === 'ready' && announced !== u.version && !settingsOpen) {
    announced = u.version;
    notice(`Moji ${u.version} está lista: instalala desde Ajustes`);
  }
});

/* ── Ajustes ────────────────────────────────────────────────────────────────
   Panel y Ajustes ocupan la misma celda: la que se va se desvanece y la otra
   entra a mitad de camino. animate=false al abrir el panel: aparece ya
   armado. */

const shortcutLabel = (s) => s.replace('Control', 'Ctrl');

function preferences(open, animate = true) {
  settingsOpen = open;
  Menu.close();
  Tooltip.hide(true);
  const [from, to] = open ? [$('panel'), $('preferences')] : [$('preferences'), $('panel')];
  const swapping = animate && !from.hidden && !from.dataset.state;
  if (swapping) leave(from);
  else drop(from);
  arrive(to, swapping ? 'after' : 'still');
  if (!open) {
    $('search').focus();
    return;
  }
  $('shortcut').value = shortcutLabel(state.shortcut);
  frase($('shortcut-status'), state.shortcutOK ? 'Atajo activo' : 'Atajo ocupado: elegí otra combinación');
  $('startup').setAttribute('aria-checked', String(state.startup));
  $('version').textContent = state.version;
  renderUpdate(state.update);
}

$('settings').onclick = () => preferences(!settingsOpen);
$('back').onclick = () => preferences(false);
$('close').onclick = () => api.hide();
$('quit').onclick = () => api.quit();

$('search').addEventListener('input', () => render());
$('clear-search').onclick = () => {
  $('search').value = '';
  render();
  $('search').focus();
};

// La rueda vertical sobre los chips los corre a lo ancho.
$('categories').addEventListener('wheel', (e) => {
  if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
  $('categories').scrollLeft += e.deltaY;
  e.preventDefault();
}, { passive: false });
$('categories').addEventListener('scroll', () => edgeFade($('categories')), { passive: true });

$('shortcut').addEventListener('focus', () => {
  frase($('shortcut-status'), 'Presioná la combinación que quieras usar.');
});
$('shortcut').addEventListener('blur', () => {
  frase($('shortcut-status'), state.shortcutOK ? 'Atajo activo' : 'Atajo ocupado: elegí otra combinación');
});
$('shortcut').addEventListener('keydown', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (e.key === 'Escape') {
    e.target.blur();
    return;
  }
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
  const key = e.code.startsWith('Key') ? e.code.slice(3)
    : e.code.startsWith('Digit') ? e.code.slice(5)
    : e.code === 'Period' ? '.'
    : e.code;
  const chord = [e.ctrlKey && 'Control', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super', key]
    .filter(Boolean).join('+');
  if (await settings({ shortcut: chord })) {
    e.target.value = shortcutLabel(state.shortcut);
    e.target.blur();
    frase($('shortcut-status'), 'Atajo guardado');
  }
});

$('startup').onclick = async () => {
  if (await settings({ startup: !state.startup })) $('startup').setAttribute('aria-checked', String(state.startup));
};

$('reset-usage').onclick = async () => {
  const yes = await Modal.confirm({
    title: '¿Reiniciar más usados?',
    sub: 'Se borra el conteo de usos. Tus ajustes se conservan.',
    confirmLabel: 'Reiniciar',
  });
  if (!yes) return;
  try {
    state = await api.clear();
    render();
    notice('Más usados reiniciados');
  } catch (e) {
    notice(e.message, true);
  }
};

$('tone').onclick = () => Menu.show(
  $('tone'),
  TONE_NAMES.map((label, i) => ({
    label,
    dot: TONE_COLORS[i],
    selected: state.tone === i,
    onSelect: async () => { if (await settings({ tone: i })) render(); },
  })),
  { align: 'end' },
);

/* ── Teclado ──────────────────────────────────────────────────────────────── */

/* Flechas arriba/abajo por geometría y no de a N índices: en Más usados los
   kaomojis ocupan tres columnas, y con títulos de grupo las filas no tienen
   todas la misma cantidad. `chars` son solo los caracteres (sin los títulos),
   así su posición coincide con data-index. */
function vertical(chars, from, dir) {
  const top = from.offsetTop;
  const cx = from.offsetLeft + from.offsetWidth / 2;
  let i = Number(from.dataset.index) + dir;
  while (chars[i] && chars[i].offsetTop === top) i += dir;
  if (!chars[i]) return from;
  const row = chars[i].offsetTop;
  let best = chars[i];
  let gap = Infinity;
  for (; chars[i] && chars[i].offsetTop === row; i += dir) {
    const d = Math.abs(chars[i].offsetLeft + chars[i].offsetWidth / 2 - cx);
    if (d < gap) {
      gap = d;
      best = chars[i];
    }
  }
  return best;
}

document.addEventListener('keydown', (e) => {
  if (Modal.isOpen) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    if (Menu.isOpen) { Menu.close(); return; }
    if (settingsOpen) { preferences(false); return; }
    if ($('search').value && !inserted) {
      $('search').value = '';
      render();
      return;
    }
    api.hide();
    return;
  }
  if (settingsOpen) return;

  if (e.key === '/' && document.activeElement !== $('search')) {
    e.preventDefault();
    $('search').focus();
    return;
  }
  if (e.ctrlKey && /^[1-4]$/.test(e.key)) {
    e.preventDefault();
    changeTab(TYPES[Number(e.key) - 1][0]);
    return;
  }
  if (document.activeElement?.getAttribute('role') === 'tab' && ['ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
    const i = TYPES.findIndex((t) => t[0] === state.tab);
    changeTab(TYPES[(i + (e.key === 'ArrowRight' ? 1 : 3)) % 4][0], true);
    return;
  }
  if (document.activeElement === $('search') && (e.key === 'ArrowDown' || e.key === 'Enter')) {
    e.preventDefault();
    if (e.key === 'Enter' && visible[0]) choose(visible[0]);
    else $('results').querySelector(':scope > .result-set:not([data-state]) .character')?.focus();
    return;
  }

  const active = document.activeElement?.closest('.character');
  if (!active) return;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
    e.preventDefault();
    const chars = active.parentElement.querySelectorAll(':scope > .character');
    const idx = Number(active.dataset.index);
    const last = chars.length - 1;
    const next = e.key === 'ArrowUp' || e.key === 'ArrowDown'
      ? vertical(chars, active, e.key === 'ArrowDown' ? 1 : -1)
      : chars[{ Home: 0, End: last, ArrowLeft: Math.max(0, idx - 1), ArrowRight: Math.min(last, idx + 1) }[e.key]];
    next?.focus();
    return;
  }
  if (e.ctrlKey && e.key.toLowerCase() === 'c') {
    e.preventDefault();
    choose(visible[Number(active.dataset.index)], true);
  }
});

/* ── Abrir y cerrar ─────────────────────────────────────────────────────────
   Al ocultarse, el panel no deja nada flotando para la próxima vez: ni el
   diálogo de confirmación, ni un menú, ni salidas a medias (con la ventana
   oculta los timers se frenan y quedarían en pantalla al reabrir). */

function clearOverlays() {
  Tooltip.hide(true);
  Menu.close(true);
  Modal.close(null);
  document.querySelectorAll('#op-layer > [data-state=closing]').forEach((e) => e.remove());
  clearTimeout(noticeTimer);
  drop($('notice'));
}

api.onOpen((s) => {
  if (!catalog) return;
  state = s;
  inserted = false;
  category = 'all';
  $('search').value = '';
  clearOverlays();
  preferences(false, false);
  $('categories').scrollLeft = 0;
  render();
  $('search').focus();
  if (!state.shortcutOK) notice('El atajo está ocupado. Podés cambiarlo en Ajustes.', true);
});
api.onClose(clearOverlays);

try {
  [state, catalog] = await Promise.all([
    api.state(),
    fetch('./data/catalog.json').then((r) => r.json()),
  ]);
  byId = new Map(catalog.items.map((i) => [i.id, i]));
  scrollFade($('results'));
  renderTabs();
  render();
  const splash = $('boot-splash');
  splash.dataset.state = 'closing';
  setTimeout(() => splash.remove(), 190);
  $('search').focus();
  document.documentElement.dataset.ready = 'true';
} catch (e) {
  $('boot-splash').textContent = 'No se pudo abrir Moji';
  notice(e.message, true);
}
