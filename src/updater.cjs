'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   Actualizaciones desde los Releases de GitHub (kiddshady/Moji), el mismo
   esquema que Finway: mira al arrancar y cada 6 h, baja en silencio y avisa
   cuando está lista. Nunca reinicia sola; si no se instala a mano, se instala
   al salir de Moji. Lee el latest.yml que el workflow de .github/ sube junto
   al instalador.

   Estados: dev | portable | idle → checking → none | downloading → ready, o error.
   ═══════════════════════════════════════════════════════════════════════════ */

const { app } = require('electron');

const START_DELAY = 8000;
const EVERY = 6 * 60 * 60 * 1000;

let status = { state: !app.isPackaged ? 'dev' : process.env.PORTABLE_EXECUTABLE_FILE ? 'portable' : 'idle' };
let notify = () => {};
let updater = null;

function set(next) {
  status = next;
  notify(status);
}

function init(onStatus) {
  notify = onStatus;
  // El portable no se puede reemplazar a sí mismo: se actualiza bajando el nuevo .exe.
  if (status.state !== 'idle') return;
  updater = require('electron-updater').autoUpdater;
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.logger = null;
  updater.on('checking-for-update', () => set({ state: 'checking' }));
  updater.on('update-not-available', () => set({ state: 'none', version: app.getVersion() }));
  updater.on('update-available', (info) => set({ state: 'downloading', version: info.version, percent: 0 }));
  updater.on('download-progress', (p) => set({ state: 'downloading', version: status.version, percent: Math.round(p.percent) }));
  updater.on('update-downloaded', (info) => set({ state: 'ready', version: info.version }));
  // Sin red no es para alarmarse: Ajustes dice que no se pudo mirar y listo.
  updater.on('error', (err) => set({ state: 'error', error: err?.message || String(err) }));
  setTimeout(check, START_DELAY);
  setInterval(check, EVERY).unref?.();
}

async function check() {
  if (!updater || ['checking', 'downloading', 'ready'].includes(status.state)) return status;
  try {
    await updater.checkForUpdates();
  } catch (err) {
    set({ state: 'error', error: err?.message || String(err) });
  }
  return status;
}

// isSilent:false muestra el progreso del instalador; isForceRunAfter:true reabre Moji.
function install() {
  if (status.state === 'ready') updater.quitAndInstall(false, true);
}

module.exports = { init, check, install, current: () => status };
