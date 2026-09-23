'use strict';
// Runs the actual portable as a separate process. CDP is loopback-only and only
// used by this development test; normal launches do not enable a debug port.
const {app,BrowserWindow,clipboard}=require('electron');
const {spawn}=require('child_process');
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),assert=require('assert/strict');
const native=require('../src/native.cjs'),koffi=require('koffi');
const send=koffi.load('user32.dll').func('uint32_t __stdcall SendInput(uint32_t n, const void *p, int size)');
const root=path.join(__dirname,'..'),defaultExe=path.join(root,'dist',`${require('../package.json').build.productName}.exe`),exe=process.env.MOJI_PACKAGE_EXE?path.resolve(root,process.env.MOJI_PACKAGE_EXE):defaultExe,data=fs.mkdtempSync(path.join(os.tmpdir(),'moji-package-'));
let child,ws,target,seq=0;const calls=new Map();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label,n=200){for(let i=0;i<n;i++){if(await fn())return;await sleep(100)}throw new Error('Timeout '+label)}
async function port(){return new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})})}
function rpc(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;calls.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))})}
async function js(expression){const r=await rpc('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result?.value}
async function launch(){
 const p=await port();
 child=spawn(exe,['--background',`--remote-debugging-port=${p}`,'--remote-debugging-address=127.0.0.1'],{env:{...process.env,MOJI_DATA:data},windowsHide:true,stdio:'ignore'});
 let page;
 await until(async()=>{try{const list=await fetch(`http://127.0.0.1:${p}/json/list`).then(r=>r.json());page=list.find(i=>i.type==='page'&&i.url.includes('renderer/index.html'));return !!page}catch{return false}},'portable ready',400);
 ws=new WebSocket(page.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
 ws.onmessage=e=>{const message=JSON.parse(e.data);const call=calls.get(message.id);if(call){calls.delete(message.id);message.error?call.reject(new Error(message.error.message)):call.resolve(message.result)}};
 await until(()=>js('document.documentElement?.dataset.ready'),'portable renderer');
}
async function close(){await js('window.moji.quit()');await sleep(500);ws.close();await until(()=>child.exitCode!==null,'portable closed');}
async function chord(){target.show();target.focus();await sleep(150);await target.webContents.executeJavaScript('document.querySelector("textarea").focus()');const targetHwnd=target.getNativeWindowHandle().readBigUInt64LE();await until(async()=>{target.show();target.focus();native.focus(targetHwnd);await sleep(30);return BigInt(native.foreground())===targetHwnd},'package target focus');const list=[[17,0],[18,0],[0xBE,0],[0xBE,2],[18,2],[17,2]],buf=Buffer.alloc(240);list.forEach(([key,flags],i)=>{buf.writeUInt32LE(1,i*40);buf.writeUInt16LE(key,i*40+8);buf.writeUInt32LE(flags,i*40+12)});assert.equal(send(6,buf,40),6);await until(()=>js('document.hasFocus()'),'hotkey opens portable');await sleep(120)}
const deadline=setTimeout(()=>{console.error('PACKAGE TIMEOUT');child?.kill();app.exit(2)},120000);
app.whenReady().then(async()=>{
 target=new BrowserWindow({width:520,height:230,show:false,backgroundColor:'#141414'});
 await target.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<title>Moji · prueba del portable</title><body style="background:#141414;color:#ddd;font:14px Segoe UI;padding:18px">Prueba del ejecutable portable<textarea style="display:block;width:96%;height:85px;font:24px Segoe UI Emoji" autofocus></textarea></body>'));
 await launch();console.log('Portable inició con catálogo y módulo Win32 empaquetados.');
 const clip=clipboard.readText();
 await chord();
 await js(`document.getElementById('tab-emoji').click()`);await sleep(120);
 await js('window.moji.settings({tone:5})');
 await js('window.moji.choose("1F44D",5)');
 await until(async()=>await target.webContents.executeJavaScript('document.querySelector("textarea").value')==='👍🏿','external insertion');
 await chord();
 await js('window.moji.choose("1F469-200D-1F4BB",3)');
 await until(async()=>await target.webContents.executeJavaScript('document.querySelector("textarea").value')==='👍🏿👩🏽‍💻','ZWJ external insertion');
 assert.equal(clipboard.readText(),clip);
 await chord();
 const screenshot=await rpc('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(root,'.shots/portable.png'),Buffer.from(screenshot.data,'base64'));
 await close();
 await launch();const state=await js('window.moji.state()');
 assert.equal(state.tone,5);assert.equal(state.usage.find(i=>i.id==='1F44D').count,1);assert.equal(state.usage.find(i=>i.id==='1F469-200D-1F4BB').tone,3);
 await close();target.destroy();clearTimeout(deadline);
 console.log('PACKAGE OK: atajo global + inserción en otro proceso + emoji compuesto + portapapeles intacto + persistencia tras reinicio.');app.quit();
}).catch(async e=>{console.error(e);try{await js('window.moji.quit()')}catch{}child?.kill();clearTimeout(deadline);app.exit(1)});
