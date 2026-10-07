'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   Humo de Moji: monta el main de verdad y recorre el panel. Incluye el atajo
   global y la inserción Win32 en una ventana de prueba, así que MANDA TECLAS
   REALES y roba el foco unos segundos.

     npm run smoke

   Usa una carpeta de datos temporal y su propio atajo: corre aunque Moji
   esté abierto. Falla si no llega al final.
   ═══════════════════════════════════════════════════════════════════════════ */

const { app, BrowserWindow, clipboard } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert/strict');

const root = path.join(__dirname, '..');
process.env.MOJI_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'moji-smoke-'));

/* Carpeta de userData propia: con la de siempre, un Moji instalado abierto se
   queda con el candado de instancia única, main.cjs sale en silencio y el
   smoke "pasa" sin probar nada. Y un atajo de prueba propio, porque el de
   fábrica lo tiene tomado ese Moji. */
app.setPath('userData', path.join(process.env.MOJI_DATA, 'userdata'));
const CHORD = 'Control+Alt+Shift+F9';
fs.writeFileSync(path.join(process.env.MOJI_DATA, 'panel.json'), JSON.stringify({ shortcut: CHORD }));
process.argv.push('--background');

let passed = false;
app.on('will-quit', () => {
  if (!passed) {
    console.error('SMOKE: Moji se cerró antes de terminar la prueba.');
    app.exit(1);
  }
});

const moji = require('../main.cjs');
const native = require('../src/native.cjs');
const koffi = require('koffi');

// Con un cambio de pestaña, la tanda vieja de resultados convive un instante con la nueva.
const LIVE = '#results>:not([data-state=closing]) .character';
const out = path.join(root, '.shots');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const timeout = setTimeout(() => {
  console.error('SMOKE TIMEOUT');
  app.exit(2);
}, 90000);

async function until(fn, label) {
  for (let i = 0; i < 100; i++) {
    if (await fn()) return;
    await sleep(50);
  }
  throw new Error('Timeout: ' + label);
}

/** Aprieta y suelta Ctrl+Alt+Shift+F9 con SendInput, como lo haría el teclado. */
function pressChord() {
  const send = koffi.load('user32.dll').func('uint32_t __stdcall SendInput(uint32_t count, const void *events, int size)');
  const keys = [[0x11, 0], [0x12, 0], [0x10, 0], [0x78, 0], [0x78, 2], [0x10, 2], [0x12, 2], [0x11, 2]];
  const buf = Buffer.alloc(keys.length * 40);
  keys.forEach(([key, flag], i) => {
    buf.writeUInt32LE(1, i * 40);
    buf.writeUInt16LE(key, i * 40 + 8);
    buf.writeUInt32LE(flag, i * 40 + 12);
  });
  assert.equal(send(keys.length, buf, 40), keys.length);
}

app.whenReady().then(async () => {
  await until(() => moji.getWindow()?.webContents && !moji.getWindow().webContents.isLoading(), 'window');
  const win = moji.getWindow();
  const js = (code) => win.webContents.executeJavaScript(code).catch((e) => { throw new Error(code + '\n' + e.message); });
  const search = (q) => js(`document.getElementById('search').value=${JSON.stringify(q)};document.getElementById('search').dispatchEvent(new Event('input'))`);
  // Las capturas, con lo que entra ya asentado: antes salían a mitad del relevo.
  const shot = async (name) => {
    await sleep(350);
    fs.writeFileSync(path.join(out, name), (await win.webContents.capturePage()).toPNG());
  };
  const errors = [];
  win.webContents.on('console-message', (e) => { if (e.level >= 3) errors.push(e.message); });

  await until(() => js('document.documentElement?.dataset.ready'), 'renderer ready');
  console.log('Renderer listo');

  // La vista previa: al aparecer un nombre, la pista no se corre.
  const hintTop = () => js('document.getElementById("preview-hint").getBoundingClientRect().top');
  const idleTop = await hintTop();
  assert.equal(await js('document.getElementById("preview-label").textContent'), '');
  await js(`document.querySelector("${LIVE}").dispatchEvent(new MouseEvent("mouseover",{bubbles:true}))`);
  assert.notEqual(await js('document.getElementById("preview-label").textContent'), '');
  assert.equal(await hintTop(), idleTop, 'preview hint keeps its place when a label appears');

  assert.equal(await js('document.querySelectorAll(".tab").length'), 4);
  assert.equal(await js(`document.querySelectorAll("${LIVE}").length`), 24);
  fs.mkdirSync(out, { recursive: true });

  const trayIcon = moji.icon();
  assert.deepEqual(trayIcon.getSize(), { width: 16, height: 16 });
  assert.deepEqual([...trayIcon.getScaleFactors()].sort((a, b) => a - b), [1, 1.25, 1.5, 2]);

  // La primera captura recién mostrada puede volver vacía hasta que se confirma un cuadro.
  await moji.show(false);
  await sleep(300);
  await win.webContents.capturePage();
  await shot('frequent.png');

  // Emojis: «Todos» va agrupado, con un título por categoría.
  await js('document.getElementById("tab-emoji").click()');
  await until(() => js(`document.querySelectorAll("${LIVE}").length`).then((n) => n > 1800), 'emoji grid');
  assert.equal(await js(`document.querySelectorAll('#results>:not([data-state=closing]) .group-title').length`), 9);
  assert.equal(await js(`document.querySelector('#results .group-title').textContent`), 'Caritas y emociones');
  // La tira de categorías recorta a la derecha: esfumada de ese lado, limpia del otro.
  assert.equal(await js(`document.getElementById('categories').className`), 'categories is-start');

  await search('pulgar arriba');
  assert(await js(`!!document.querySelector('[data-id="1F44D"]')`));
  assert.equal(await js(`document.querySelectorAll('#results .group-title').length`), 0, 'con búsqueda no hay grupos');
  console.log('Búsqueda OK');

  // El menú de tonos cae adentro del panel y cambia el tono de la grilla.
  await js('document.getElementById("tone").click()');
  await sleep(250);
  const rect = await js('(()=>{const r=document.querySelector(".op-menu").getBoundingClientRect();return {x:r.x,y:r.y,b:r.bottom}})()');
  assert(rect.x >= 0 && rect.y >= 0 && rect.b <= 536);
  assert.equal(await js('document.querySelectorAll(".op-menu .op-menuitem__dot").length'), 6);
  await js('document.querySelectorAll(".op-menuitem")[1].click()');
  await sleep(250);
  assert.equal(await js(`document.querySelector('[data-id="1F44D"] .glyph').textContent`), '👍🏻');

  // Win32 de verdad: foco e inserción en otra ventana del escritorio.
  const target = new BrowserWindow({ width: 500, height: 230, show: false, backgroundColor: '#141414', webPreferences: { contextIsolation: true, nodeIntegration: false } });
  await target.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<title>Moji · prueba de inserción</title><body style="background:#141414;color:#eee;font-family:Segoe UI;padding:18px"><p>Prueba local de inserción de Moji</p><textarea id="input" autofocus style="width:95%;height:80px;font-size:25px"></textarea></body>'));
  target.show();
  target.focus();
  await sleep(250);
  await target.webContents.executeJavaScript('document.getElementById("input").focus()');
  const targetHwnd = target.getNativeWindowHandle().readBigUInt64LE();
  const typed = () => target.webContents.executeJavaScript('document.getElementById("input").value');
  await until(async () => {
    target.show();
    target.focus();
    native.focus(targetHwnd);
    await sleep(30);
    return BigInt(native.foreground()) === targetHwnd;
  }, 'test target focus');
  const clip = await clipboard.readText();

  // El atajo registrado, disparado con SendInput y no llamando al callback.
  pressChord();
  await until(() => win.isFocused(), 'global shortcut');
  assert.equal(BigInt(moji.getTarget()), targetHwnd);

  await search('pulgar arriba');
  await js(`document.querySelector('[data-id="1F44D"]').click()`);
  await until(async () => (await typed()) === '👍🏻', 'native emoji inserted');
  assert.equal(await clipboard.readText(), clip, 'insertion leaves clipboard unchanged');
  await until(() => moji.getState().usage.some((i) => i.id === '1F44D'), 'usage saved');
  assert.equal(moji.getState().usage.find((i) => i.id === '1F44D').count, 1);
  await until(() => win.isVisible() && win.isFocused(), 'panel stays open and focused after insert');

  await js('document.getElementById("tab-kaomoji").click()');
  await sleep(150);
  assert(await js(`document.querySelectorAll("${LIVE}").length`) >= 60);
  await shot('kaomoji.png');
  const kao = await js(`document.querySelector("${LIVE} .glyph").textContent`);
  await js(`document.querySelector("${LIVE}").click()`);
  await until(async () => (await typed()) === '👍🏻' + kao, 'kaomoji inserted');
  await until(() => win.isVisible() && win.isFocused(), 'panel stays open and focused after insert');

  await js('document.getElementById("tab-symbol").click()');
  await sleep(120);
  await shot('symbols.png');
  await search('raiz');
  await js(`document.querySelector("${LIVE}").click()`);
  await until(async () => (await typed()) === '👍🏻' + kao + '√', 'symbol inserted');
  await until(() => win.isVisible() && win.isFocused(), 'panel stays open and focused after insert');

  // Después de insertar, Esc cierra directo aunque haya una búsqueda escrita.
  win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
  await until(() => !win.isVisible(), 'Esc closes after insert');

  // Ajustes: la versión es la de Moji, no la de Electron.
  await moji.show();
  await sleep(250);
  await js('document.getElementById("settings").click()');
  await shot('settings.png');
  assert.equal(await js('document.getElementById("preferences").hidden'), false);
  assert.equal(await js('document.getElementById("version").textContent'), require('../package.json').version);
  await js('document.getElementById("back").click()');

  await js('document.getElementById("tab-frequent").click()');
  await sleep(150);
  assert.equal(await js(`document.querySelectorAll("${LIVE}").length`), 3);
  const disk = JSON.parse(fs.readFileSync(path.join(process.env.MOJI_DATA, 'panel.json'), 'utf8'));
  assert.equal(disk.usage['1F44D'].tone, 1);

  // Reiniciar más usados: la confirmación entra en el panel y borra el conteo.
  await js('document.getElementById("settings").click();document.getElementById("reset-usage").click()');
  await sleep(350);
  const modal = await js('(()=>{const r=document.querySelector(".op-modal").getBoundingClientRect();return {x:r.x,y:r.y,b:r.bottom,r:r.right}})()');
  assert(modal.x >= 0 && modal.y >= 0 && modal.b <= 536 && modal.r <= 416, 'confirmation fits panel');
  await js('document.querySelector(".op-modal__foot .op-btn--primary").click()');
  await sleep(300);
  assert.equal(moji.getState().usage.length, 0);
  await js('document.getElementById("back").click()');

  win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
  await sleep(150);
  assert(!win.isVisible());
  assert.equal(moji.getState().shortcut, CHORD);
  assert.equal(moji.getState().shortcutOK, true, 'test shortcut registered');
  assert.deepEqual(errors, []);

  console.log('SMOKE OK: renderer + grupos + búsqueda + tonos + menú + atajo Win32 + inserción emoji/kaomoji/símbolo + portapapeles intacto + frecuencia en disco.');
  console.log('Capturas: ' + out);
  passed = true;
  target.destroy();
  clearTimeout(timeout);
  app.quit();
}).catch((err) => {
  console.error(err);
  clearTimeout(timeout);
  app.exit(1);
});
