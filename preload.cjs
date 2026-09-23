'use strict';
const {contextBridge,ipcRenderer}=require('electron');
async function call(channel,...args){const r=await ipcRenderer.invoke(channel,...args);if(!r?.ok)throw new Error(r?.error||'No se pudo completar la acción.');return r.data}
contextBridge.exposeInMainWorld('moji',{
 state:()=>call('moji:state'), settings:p=>call('moji:settings',p),
 choose:(id,tone,copyOnly=false)=>call('moji:choose',id,tone,copyOnly),
 clear:()=>call('moji:clear'), checkUpdate:()=>call('moji:update-check'), installUpdate:()=>ipcRenderer.send('moji:update-install'),
 onUpdate:cb=>ipcRenderer.on('moji:update',(_e,s)=>cb(s)), hide:()=>ipcRenderer.send('moji:hide'),quit:()=>ipcRenderer.send('moji:quit'),
 onOpen:cb=>ipcRenderer.on('panel:opened',(_e,s)=>cb(s)),
 onClose:cb=>ipcRenderer.on('panel:closing',()=>cb()),
});
