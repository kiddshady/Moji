'use strict';
const { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage, screen, clipboard } = require('electron');
const fs = require('fs');
const path = require('path');
const BG = '#0a0b0d';
app.setName('Moji');
process.env.EMOJIPANEL_DATA = process.env.MOJI_DATA || path.join(app.getPath('userData'), 'data');
const store = require('./src/store.cjs');
const native = require('./src/native.cjs');
const catalog = require('./src/catalog.cjs');
const updater = require('./src/updater.cjs');
const defaults = { shortcut:'Control+Alt+.', tone:0, tab:'frequent', usage:{} };
let state = structuredClone(defaults), win, tray, target = 0, opening = false, busy = false, quitting = false;
let registered = false, ready = false;
const stateDoc = store.doc('panel', defaults);
const allowedTabs = ['frequent','emoji','kaomoji','symbol'];
const save = () => stateDoc.write(state);
const loginOptions = () => ({path:process.env.PORTABLE_EXECUTABLE_FILE||app.getPath('exe'),args:['--background']});
const snapshot = () => ({ ...state, usage:catalog.rank(state.usage), shortcutOK:registered, startup:app.getLoginItemSettings(loginOptions()).openAtLogin, version:app.getVersion(), update:updater.current() });
function hwnd() { return win?.getNativeWindowHandle().readBigUInt64LE(0) || 0n; }
// restore: al cerrar a propósito (Esc, la X, el atajo) el foco vuelve a la ventana
// desde la que se abrió Moji, con su cursor. Se pide mientras Moji todavía está en
// primer plano, que es cuando Windows lo permite. Al hacer clic afuera no: ahí el
// foco ya está donde el usuario lo quiso.
function hide(restore = false) {
  if (!win || win.isDestroyed() || !win.isVisible()) return;
  win.webContents.send('panel:closing');
  if (restore && target && BigInt(target) !== hwnd()) native.focus(target);
  win.hide();
}
async function show(capture = true) {
  if (!ready || opening) return;
  if (capture) { const h=native.foreground(); target=BigInt(h)!==hwnd()?h:target; }
  opening = true;
  const cursor=screen.getCursorScreenPoint(), a=screen.getDisplayNearestPoint(cursor).workArea;
  const x=Math.round(Math.min(Math.max(cursor.x-80,a.x+8),a.x+a.width-424));
  const y=Math.round(Math.min(Math.max(cursor.y+16,a.y+8),a.y+a.height-544));
  // Onyx's DWM warm-up happens off-screen on hidden -> visible transitions.
  win.setPosition(-20000,-20000); win.showInactive();
  await new Promise(r=>setTimeout(r,200));
  if (quitting) return;
  win.setPosition(x,y); win.show(); win.focus();
  win.webContents.send('panel:opened',snapshot());
  opening=false;
}
function toggle() { win?.isVisible() && win.isFocused() ? hide(true) : show(); }
function registerShortcut(value) {
  if (typeof value==='string') value=value.replace(/\+Period$/i,'+.');
  if (typeof value!=='string' || value.length>80 || !/^(Control|Alt|Shift|Super)(\+(Control|Alt|Shift|Super))*\+([A-Z0-9.]|Space|F\d{1,2})$/.test(value)) throw new Error('Usá un modificador y una letra, número, punto, espacio o tecla de función.');
  if (value===state.shortcut && registered) return;
  let success=false;
  try { success=globalShortcut.register(value,toggle); } catch {}
  if (!success) throw new Error('Ese atajo está ocupado. Elegí otra combinación.');
  if(registered) globalShortcut.unregister(state.shortcut);
  state.shortcut=value; registered=true;
}
// Los íconos los hornea tools/icons.mjs. Se leen con fs, que entiende el asar, así
// la misma ruta vale en dev y empaquetado. La bandeja lleva un dibujo por cada escala
// de Windows (100/125/150/200 %), no el de 256 achicado.
const asset=name=>fs.readFileSync(path.join(__dirname,'assets',name));
function icon() {
  const image=nativeImage.createEmpty();
  for(const [scaleFactor,size] of [[1,16],[1.25,20],[1.5,24],[2,32]]) image.addRepresentation({scaleFactor,buffer:asset(`tray-${size}.png`)});
  return image;
}
// Con una versión nueva ya bajada, la bandeja ofrece instalarla: es la salida para
// quien nunca entra a Ajustes.
function trayMenu() {
  const u=updater.current();
  tray?.setContextMenu(Menu.buildFromTemplate([{label:'Abrir Moji',click:()=>show()},...(u.state==='ready'?[{label:`Instalar la versión ${u.version}`,click:()=>updater.install()}]:[]),{type:'separator'},{label:'Salir de Moji',click:()=>app.quit()}]));
}
function guard(fn) { return async(e,...args)=>{ if(e.sender!==win?.webContents) return {ok:false,error:'Origen no válido.'}; try{return {ok:true,data:await fn(...args)}}catch(err){return {ok:false,error:err.message}} }; }
function registerIPC() {
  ipcMain.handle('moji:state',guard(()=>snapshot()));
  ipcMain.handle('moji:settings',guard(async(patch)=>{
    if (!patch || typeof patch!=='object') throw new Error('Ajustes no válidos.');
    if(patch.shortcut!==undefined) registerShortcut(patch.shortcut);
    if(patch.tone!==undefined){ if(!Number.isInteger(patch.tone)||patch.tone<0||patch.tone>5)throw new Error('Tono no válido.'); state.tone=patch.tone; }
    if(patch.tab!==undefined){if(!allowedTabs.includes(patch.tab))throw new Error('Pestaña no válida.');state.tab=patch.tab;}
    if(patch.startup!==undefined){ if(typeof patch.startup!=='boolean')throw new Error('Inicio no válido.'); if(!app.isPackaged)throw new Error('El inicio con Windows se habilita en la versión empaquetada.'); app.setLoginItemSettings({openAtLogin:patch.startup,...loginOptions()}); }
    await save(); return snapshot();
  }));
  ipcMain.handle('moji:choose',guard(async(id,tone,copyOnly=false)=>{
    if(busy) throw new Error('Esperá a que termine la inserción.');
    if(typeof copyOnly!=='boolean')throw new Error('Acción no válida.');
    const item=catalog.resolve(id,tone); busy=true;
    try{
      if(copyOnly) clipboard.writeText(item.value);
      // El panel queda abierto: el foco va a la app un instante y vuelve, así se
      // pueden elegir varios seguidos. Esc (o hacer clic afuera) lo cierra.
      else try{await native.insert(target,item.value)}finally{if(win.isVisible()){native.reclaim(hwnd());win.focus()}}
      const old=state.usage[id]||{count:0};
      state.usage[id]={count:old.count+1,last:Date.now(),tone};
      await save(); return {value:item.value,state:snapshot()};
    } finally {busy=false;}
  }));
  ipcMain.handle('moji:update-check',guard(()=>updater.check()));
  ipcMain.on('moji:update-install',e=>{if(e.sender===win?.webContents)updater.install()});
  ipcMain.handle('moji:clear',guard(async()=>{state.usage={};await save();return snapshot()}));
  ipcMain.on('moji:hide',e=>{if(e.sender===win?.webContents)hide(true)});
  ipcMain.on('moji:quit',e=>{if(e.sender===win?.webContents)app.quit()});
}
async function start() {
  const stored=await stateDoc.read();
  state={...defaults,...stored, usage:{}};
  for(const [id,s] of Object.entries(stored?.usage||{})){
    if(catalog.data.items.some(i=>i.id===id)&&Number.isFinite(s.count)&&s.count>0&&Number.isFinite(s.last))state.usage[id]={count:s.count,last:s.last,tone:Number.isInteger(s.tone)&&s.tone>=0&&s.tone<=5?s.tone:0};
  }
  if(!allowedTabs.includes(state.tab))state.tab='frequent';
  if(!Number.isInteger(state.tone)||state.tone<0||state.tone>5)state.tone=0;
  target=native.foreground();
  win=new BrowserWindow({width:416,height:536,x:-20000,y:-20000,frame:false,resizable:false,maximizable:false,show:false,skipTaskbar:true,alwaysOnTop:true,backgroundColor:BG,autoHideMenuBar:true,icon:nativeImage.createFromBuffer(asset('icon.png')),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,spellcheck:false}});
  win.setMenu(null);
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',e=>e.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_wc,_p,cb)=>cb(false));
  win.on('blur',()=>{if(!opening&&!busy)hide()});
  win.on('close',e=>{if(!quitting){e.preventDefault();hide(true)}});
  win.webContents.on('console-message',e=>{if(e.level>=2)console.error('[renderer]',e.message)});
  registerIPC();
  try{registerShortcut(state.shortcut)}catch(err){registered=false;console.error(err.message)}
  tray=new Tray(icon()); tray.setToolTip('Moji');
  tray.on('click',()=>show());
  trayMenu();
  await win.loadFile(path.join(__dirname,'renderer/index.html'));
  ready=true;
  updater.init(status=>{if(!win.isDestroyed())win.webContents.send('moji:update',status);trayMenu()});
  if(!process.argv.includes('--background'))await show(false);
  return win;
}
if(!app.requestSingleInstanceLock())app.quit();
else {
  app.on('second-instance',()=>show());
  app.on('before-quit',()=>{quitting=true;globalShortcut.unregisterAll();tray?.destroy()});
  app.on('window-all-closed',()=>{});
  app.whenReady().then(start).catch(err=>{console.error(err);app.exit(1)});
}
module.exports={getWindow:()=>win,show,hide,getState:()=>snapshot(),getTarget:()=>target,icon};
