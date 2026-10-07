'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   MOJI — proceso principal

   Vive en la bandeja. El atajo global (Ctrl+Alt+. de fábrica) recuerda qué
   ventana estaba adelante, muestra el panel al lado del cursor y, al elegir
   un carácter, le devuelve el foco a esa ventana y lo tipea con SendInput
   (src/native.cjs). El portapapeles solo se toca con «Copiar».

   Una sola ventana que se esconde y se vuelve a mostrar: nunca se destruye
   mientras la app vive. Cerrarla la esconde; se sale desde la bandeja o desde
   Ajustes.
   ═══════════════════════════════════════════════════════════════════════════ */

const { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage, nativeTheme, screen, clipboard } = require('electron');
const fs = require('fs');
const path = require('path');

/** El fondo de --op-bg en hex (tokens.test.mjs lo compara con el del splash). */
const BG = '#0a0a0a';

/* La ventana es de vidrio de verdad: Windows 11 pinta detrás el escritorio
   desenfocado (el material acrílico) y la página encima es translúcida, con
   un velo de --op-bg (moji.css). Por eso el backgroundColor es transparente:
   un color opaco taparía el acrílico. El tema va forzado a oscuro, porque el
   acrílico sigue al de Windows y en modo claro sería blanco. */
const GLASS = '#00000000';
nativeTheme.themeSource = 'dark';

app.setName('Moji');
/* Solo para test/package-smoke.cjs: un perfil aparte, así el .exe de prueba no
   choca con el candado de instancia única del Moji instalado y abierto. */
if (process.env.MOJI_USERDATA) app.setPath('userData', process.env.MOJI_USERDATA);
process.env.EMOJIPANEL_DATA = process.env.MOJI_DATA || path.join(app.getPath('userData'), 'data');

const store = require('./src/store.cjs');
const native = require('./src/native.cjs');
const catalog = require('./src/catalog.cjs');
const updater = require('./src/updater.cjs');

/* La versión sale del package.json y no de app.getVersion(): corriendo un
   script de prueba con `electron test/…`, Electron toma su propia versión
   (44.x) y Ajustes la mostraba como si fuera la de Moji. */
const VERSION = require('./package.json').version;

const WIDTH = 416;
const HEIGHT = 536;

const defaults = { shortcut: 'Control+Alt+.', tone: 0, tab: 'frequent', usage: {} };
const allowedTabs = ['frequent', 'emoji', 'kaomoji', 'symbol'];
const stateDoc = store.doc('panel', defaults);

let state = structuredClone(defaults);
let win;
let tray;
let target = 0;          // HWND de la ventana donde se va a insertar
let opening = false;
let busy = false;        // una inserción en curso
let quitting = false;
let registered = false;  // ¿el atajo quedó tomado?
let ready = false;       // el renderer ya cargó

const save = () => stateDoc.write(state);

const loginOptions = () => ({
  path: process.env.PORTABLE_EXECUTABLE_FILE || app.getPath('exe'),
  args: ['--background'],
});

/** Lo que el renderer necesita saber, en una sola foto. */
const snapshot = () => ({
  ...state,
  usage: catalog.rank(state.usage),
  shortcutOK: registered,
  startup: app.getLoginItemSettings(loginOptions()).openAtLogin,
  version: VERSION,
  update: updater.current(),
});

function hwnd() {
  return win?.getNativeWindowHandle().readBigUInt64LE(0) || 0n;
}

/* ── Mostrar y esconder ───────────────────────────────────────────────────── */

/* restore: al cerrar a propósito (Esc, la X, el atajo) el foco vuelve a la
   ventana desde la que se abrió Moji, con su cursor. Se pide mientras Moji
   todavía está en primer plano, que es cuando Windows lo permite. Al hacer
   clic afuera no: ahí el foco ya está donde el usuario lo quiso. */
function hide(restore = false) {
  if (!win || win.isDestroyed() || !win.isVisible()) return;
  win.webContents.send('panel:closing');
  if (restore && target && BigInt(target) !== hwnd()) native.focus(target);
  win.hide();
}

async function show(capture = true) {
  if (!ready || opening) return;
  if (capture) {
    const h = native.foreground();
    target = BigInt(h) !== hwnd() ? h : target;
  }
  opening = true;

  // Al lado del cursor, sin salirse del área de trabajo del monitor donde está.
  const cursor = screen.getCursorScreenPoint();
  const area = screen.getDisplayNearestPoint(cursor).workArea;
  const x = Math.round(Math.min(Math.max(cursor.x - 80, area.x + 8), area.x + area.width - WIDTH - 8));
  const y = Math.round(Math.min(Math.max(cursor.y + 16, area.y + 8), area.y + area.height - HEIGHT - 8));

  /* El calentamiento del DWM de Opal: el primer cuadro visible pasa fuera de
     pantalla. Y el panel se rearma acá, todavía afuera: si se avisara ya en
     su lugar, se vería un cuadro con lo de la vez anterior y después la
     grilla nueva (parpadeo). */
  win.setPosition(-20000, -20000);
  win.showInactive();
  win.webContents.send('panel:opened', snapshot());
  await new Promise((r) => setTimeout(r, 200));
  if (quitting) return;
  win.setPosition(x, y);
  win.show();
  win.focus();
  opening = false;
}

function toggle() {
  if (win?.isVisible() && win.isFocused()) hide(true);
  else show();
}

/* ── El atajo global ──────────────────────────────────────────────────────── */

const CHORD = /^(Control|Alt|Shift|Super)(\+(Control|Alt|Shift|Super))*\+([A-Z0-9.]|Space|F\d{1,2})$/;

function registerShortcut(value) {
  if (typeof value === 'string') value = value.replace(/\+Period$/i, '+.');
  if (typeof value !== 'string' || value.length > 80 || !CHORD.test(value)) {
    throw new Error('Usá un modificador y una letra, número, punto, espacio o tecla de función.');
  }
  // Con Shift solo, el atajo global se comería mayúsculas y signos en todas las apps.
  if (!/(^|\+)(Control|Alt|Super)\+/.test(value)) {
    throw new Error('Sumá Ctrl, Alt o Win: con Shift solo se bloquearían las mayúsculas y los signos en las demás apps.');
  }
  if (value === state.shortcut && registered) return;
  let success = false;
  try { success = globalShortcut.register(value, toggle); } catch { /* ocupado o inválido */ }
  if (!success) throw new Error('Ese atajo está ocupado. Elegí otra combinación.');
  if (registered) globalShortcut.unregister(state.shortcut);
  state.shortcut = value;
  registered = true;
}

/* ── La bandeja ───────────────────────────────────────────────────────────── */

/* Los íconos los hornea tools/icons.mjs. Se leen con fs, que entiende el asar,
   así la misma ruta vale en dev y empaquetado. La bandeja lleva un dibujo por
   cada escala de Windows (100/125/150/200 %), no el de 256 achicado. */
const asset = (name) => fs.readFileSync(path.join(__dirname, 'assets', name));

function icon() {
  const image = nativeImage.createEmpty();
  for (const [scaleFactor, size] of [[1, 16], [1.25, 20], [1.5, 24], [2, 32]]) {
    image.addRepresentation({ scaleFactor, buffer: asset(`tray-${size}.png`) });
  }
  return image;
}

/* Con una versión nueva ya bajada, la bandeja ofrece instalarla: es la salida
   para quien nunca entra a Ajustes. */
function trayMenu() {
  const u = updater.current();
  tray?.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir Moji', click: () => show() },
    ...(u.state === 'ready' ? [{ label: `Instalar la versión ${u.version}`, click: () => updater.install() }] : []),
    { type: 'separator' },
    { label: 'Salir de Moji', click: () => app.quit() },
  ]));
}

/* ── IPC ──────────────────────────────────────────────────────────────────────
   Cada handler devuelve {ok, data} o {ok:false, error}; el preload lo
   convierte en una excepción. Solo responde a la ventana de Moji. */

function guard(fn) {
  return async (e, ...args) => {
    if (e.sender !== win?.webContents) return { ok: false, error: 'Origen no válido.' };
    try {
      return { ok: true, data: await fn(...args) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  };
}

const validTone = (t) => Number.isInteger(t) && t >= 0 && t <= 5;

function registerIPC() {
  ipcMain.handle('moji:state', guard(() => snapshot()));

  ipcMain.handle('moji:settings', guard(async (patch) => {
    if (!patch || typeof patch !== 'object') throw new Error('Ajustes no válidos.');
    if (patch.shortcut !== undefined) registerShortcut(patch.shortcut);
    if (patch.tone !== undefined) {
      if (!validTone(patch.tone)) throw new Error('Tono no válido.');
      state.tone = patch.tone;
    }
    if (patch.tab !== undefined) {
      if (!allowedTabs.includes(patch.tab)) throw new Error('Pestaña no válida.');
      state.tab = patch.tab;
    }
    if (patch.startup !== undefined) {
      if (typeof patch.startup !== 'boolean') throw new Error('Inicio no válido.');
      if (!app.isPackaged) throw new Error('El inicio con Windows se habilita en la versión empaquetada.');
      app.setLoginItemSettings({ openAtLogin: patch.startup, ...loginOptions() });
    }
    await save();
    return snapshot();
  }));

  ipcMain.handle('moji:choose', guard(async (id, tone, copyOnly = false) => {
    if (busy) throw new Error('Esperá a que termine la inserción.');
    if (typeof copyOnly !== 'boolean') throw new Error('Acción no válida.');
    const item = catalog.resolve(id, tone); // valida el id y el tono
    busy = true;
    try {
      if (copyOnly) {
        await clipboard.writeText(item.value);   // asíncrono desde Electron 44
      } else {
        /* El panel queda abierto: el foco va a la app un instante y vuelve,
           así se pueden elegir varios seguidos. Esc (o hacer clic afuera) lo
           cierra. */
        try {
          await native.insert(target, item.value);
        } finally {
          if (win.isVisible()) {
            native.reclaim(hwnd());
            win.focus();
          }
        }
      }
      const old = state.usage[id] || { count: 0 };
      state.usage[id] = { count: old.count + 1, last: Date.now(), tone };
      await save();
      return { value: item.value, state: snapshot() };
    } finally {
      busy = false;
    }
  }));

  ipcMain.handle('moji:update-check', guard(() => updater.check()));
  ipcMain.on('moji:update-install', (e) => { if (e.sender === win?.webContents) updater.install(); });

  ipcMain.handle('moji:clear', guard(async () => {
    state.usage = {};
    await save();
    return snapshot();
  }));

  ipcMain.on('moji:hide', (e) => { if (e.sender === win?.webContents) hide(true); });
  ipcMain.on('moji:quit', (e) => { if (e.sender === win?.webContents) app.quit(); });
}

/* ── Arranque ─────────────────────────────────────────────────────────────── */

/** Lo guardado, sin confiar en nada: lo que no valida vuelve al default. */
function restore(stored) {
  const ids = new Set(catalog.data.items.map((i) => i.id));
  const usage = {};
  for (const [id, s] of Object.entries(stored?.usage || {})) {
    if (!ids.has(id) || !Number.isFinite(s.count) || s.count <= 0 || !Number.isFinite(s.last)) continue;
    usage[id] = { count: s.count, last: s.last, tone: validTone(s.tone) ? s.tone : 0 };
  }
  const next = { ...defaults, ...stored, usage };
  if (!allowedTabs.includes(next.tab)) next.tab = 'frequent';
  if (!validTone(next.tone)) next.tone = 0;
  return next;
}

async function start() {
  state = restore(await stateDoc.read());
  target = native.foreground();

  win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    x: -20000,
    y: -20000,
    frame: false,
    resizable: false,
    maximizable: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: GLASS,
    backgroundMaterial: 'acrylic',
    autoHideMenuBar: true,
    icon: nativeImage.createFromBuffer(asset('icon.png')),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  win.setMenu(null);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_wc, _p, cb) => cb(false));
  win.on('blur', () => { if (!opening && !busy) hide(); });
  /* Al insertar, Moji le da el foco a la otra app un instante (y mientras
     abre, todavía no lo tiene): sin esto, Windows cambiaría el acrílico por
     un gris sólido y volvería, un parpadeo en cada clic. Si en cambio pierde
     el foco porque se cierra (clic afuera), no hace falta: se esconde. */
  win.hookWindowMessage(native.WM_NCACTIVATE, (wParam) => {
    if (wParam.readUInt32LE(0) === 0 && (busy || opening)) setImmediate(() => native.lookActive(hwnd()));
  });
  win.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    hide(true);
  });
  win.webContents.on('console-message', (e) => { if (e.level >= 2) console.error('[renderer]', e.message); });

  registerIPC();
  try {
    registerShortcut(state.shortcut);
  } catch (err) {
    registered = false;
    console.error(err.message);
  }

  tray = new Tray(icon());
  tray.setToolTip('Moji');
  tray.on('click', () => show());
  trayMenu();

  await win.loadFile(path.join(__dirname, 'renderer/index.html'));
  ready = true;
  updater.init((status) => {
    if (!win.isDestroyed()) win.webContents.send('moji:update', status);
    trayMenu();
  });
  if (!process.argv.includes('--background')) await show(false);
  return win;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => show());
  app.on('before-quit', () => {
    quitting = true;
    globalShortcut.unregisterAll();
    tray?.destroy();
  });
  app.on('window-all-closed', () => {});
  app.whenReady().then(start).catch((err) => {
    console.error(err);
    app.exit(1);
  });
}

module.exports = { getWindow: () => win, show, hide, getState: () => snapshot(), getTarget: () => target, icon };
