'use strict';

/* El puente: lo único del sistema que ve el renderer es `window.moji`.
   Cada pedido devuelve {ok, data} desde el main; acá un {ok:false} se
   convierte en una excepción, así el renderer escribe try/catch normal. */

const { contextBridge, ipcRenderer } = require('electron');

async function call(channel, ...args) {
  const r = await ipcRenderer.invoke(channel, ...args);
  if (!r?.ok) throw new Error(r?.error || 'No se pudo completar la acción.');
  return r.data;
}

contextBridge.exposeInMainWorld('moji', {
  state: () => call('moji:state'),
  settings: (patch) => call('moji:settings', patch),
  choose: (id, tone, copyOnly = false) => call('moji:choose', id, tone, copyOnly),
  clear: () => call('moji:clear'),

  checkUpdate: () => call('moji:update-check'),
  installUpdate: () => ipcRenderer.send('moji:update-install'),
  onUpdate: (cb) => ipcRenderer.on('moji:update', (_e, s) => cb(s)),

  hide: () => ipcRenderer.send('moji:hide'),
  quit: () => ipcRenderer.send('moji:quit'),
  onOpen: (cb) => ipcRenderer.on('panel:opened', (_e, s) => cb(s)),
  onClose: (cb) => ipcRenderer.on('panel:closing', () => cb()),
});
