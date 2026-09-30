import {Icons} from './icons.js';
import {Tooltip,Menu,Modal} from './overlays.js';
import {exit} from './motion.js';
import {searchItems,variant} from './search.mjs';
Icons.add({
 'moji-mark':'<circle cx="8" cy="8" r="6"/><path d="M5.3 9.4q2.7 3.2 5.4 0M5.7 5.8v.6m4.6-.6v.6"/>',
 'moji-smile':'<circle cx="8" cy="8" r="6"/><path d="M5.3 9.4q2.7 3.2 5.4 0M5.7 5.8v.6m4.6-.6v.6"/>',
 'moji-used':'<path d="M2 6a6 6 0 1 1 0 4M2 2v4h4M8 4.5V8l2.3 1.5"/>',
 'moji-kao':'<path d="M3.5 3C.8 5.5.8 10.5 3.5 13M12.5 3c2.7 2.5 2.7 7.5 0 10M5 6.7l1-1 1 1m2 0 1-1 1 1M6.8 10h2.4"/>',
 'moji-symbol':'<path d="M3 3h5M5.5 1v4M2 12l3-5 3 5zM10 6h4M10 9h4M12 11v3m-1.5-1.5h3"/>',
 'moji-search':'<circle cx="6.7" cy="6.7" r="4.7"/><path d="m10.2 10.2 3.8 3.8"/>',
 'moji-close':'<path d="m4 4 8 8M4 12l8-8"/>',
 'moji-back':'<path d="m9 3-5 5 5 5M4 8h9"/>',
 'moji-settings':'<path d="M3 4h10M3 8h10M3 12h10"/><circle cx="6" cy="4" r="1.5" fill="var(--ox-bg)"/><circle cx="10" cy="8" r="1.5" fill="var(--ox-bg)"/><circle cx="6" cy="12" r="1.5" fill="var(--ox-bg)"/>',
});
Icons.mount();Tooltip.init();
const $=id=>document.getElementById(id), api=window.moji;
const types=[['frequent','Más usados','moji-used'],['emoji','Emojis','moji-smile'],['kaomoji','Kaomojis','moji-kao'],['symbol','Símbolos','moji-symbol']];
const toneColors=['#f4c542','#f6d7b0','#dfb18c','#ba845b','#8f5d40','#593f32'];
const toneNames=['Original','Claro','Claro medio','Medio','Oscuro medio','Oscuro'];
let state, catalog, byId, category='all', visible=[], settingsOpen=false, sending=false, inserted=false, noticeTimer, previewed;
const seed=['1F601','1F602','1F923','1F60A','1F609','1F60D','1F970','1F618','1F60E','1F914','1F62D','1F605','1F44D','1F44F','1F64C','1F64F','2764','1F525','2728','1F389','1F4AA','1F440','1F9C9','1F680'];
// Vistas y aviso: no salen del DOM, se ocultan. arrive/leave les dan entrada y salida
// animadas; la entrada se apaga con .is-settled (nunca con style.animation, que le
// ganaría a la regla de salida). mode: 'still' sin animación, 'in' entra, 'after'
// entra cuando la otra ya va por la mitad de su salida (relevo).
function leave(el){
 if(el.hidden||el.dataset.state==='closing')return;
 el.dataset.state='closing';
 const cancel=()=>{clearTimeout(timer);el.removeEventListener('animationend',onEnd);el._cancelLeave=null};
 const end=()=>{cancel();delete el.dataset.state;el.hidden=true};
 const onEnd=e=>{if(e.target===el)end()};
 const timer=setTimeout(end,260);el.addEventListener('animationend',onEnd);el._cancelLeave=cancel;
}
function arrive(el,mode='in'){
 el._cancelLeave?.();delete el.dataset.state;el.classList.toggle('is-after',mode==='after');
 if(mode==='still'){el.classList.add('is-settled');el.hidden=false;return}
 el.classList.remove('is-settled');el.hidden=false;
 el.addEventListener('animationend',function done(e){if(e.target!==el)return;el.removeEventListener('animationend',done);if(!el.dataset.state){el.classList.add('is-settled');el.classList.remove('is-after')}});
}
function drop(el){el._cancelLeave?.();delete el.dataset.state;el.hidden=true}
function notice(message,error=false){clearTimeout(noticeTimer);const n=$('notice');n.textContent=message;n.classList.toggle('error',error);if(n.hidden||n.dataset.state)arrive(n);noticeTimer=setTimeout(()=>leave(n),error?7000:2000)}
async function settings(patch){try{state=await api.settings(patch);return true}catch(e){notice(e.message,true);return false}}
function toneFor(item){return state.tab==='frequent'?(state.usage.find(u=>u.id===item.id)?.tone??state.tone):state.tone}
function preview(item){if(item===previewed)return;previewed=item;if(!item){$('preview-char').textContent='';$('preview-label').textContent='';return}const value=variant(item,toneFor(item));$('preview-char').textContent=value;$('preview-char').classList.toggle('kao-preview',item.kind==='kaomoji');$('preview-label').textContent=item.label}
function renderTabs(){for(const [id,label,icon] of types){const b=document.createElement('button');b.className='tab';b.id=`tab-${id}`;b.setAttribute('role','tab');b.setAttribute('aria-controls','results');b.setAttribute('aria-selected',String(id===state.tab));b.dataset.tab=id;b.innerHTML=Icons.svg(icon)+`<span>${label}</span>`;b.onclick=()=>changeTab(id);$('tabs').append(b)}}
// focusTab: con las flechas sobre las pestañas el foco se queda en la pestaña.
async function changeTab(id,focusTab=false){if(id===state.tab&&category==='all'&&!$('search').value){(focusTab?$(`tab-${id}`):$('search')).focus();return}state.tab=id;category='all';$('search').value='';render('swap');(focusTab?$(`tab-${id}`):$('search')).focus();await settings({tab:id})}
// Los chips se arman una vez por pestaña; elegir uno solo cambia aria-pressed, así
// el fondo transiciona y el scroll horizontal queda donde estaba.
function renderCategories(){const box=$('categories');if(box.dataset.tab!==state.tab){box.replaceChildren();const cats=state.tab==='frequent'?[{id:'all',label:'Todos'},{id:'emoji',label:'Emojis'},{id:'kaomoji',label:'Kaomojis'},{id:'symbol',label:'Símbolos'}]:[{id:'all',label:'Todos'},...catalog.categories[state.tab]];for(const c of cats){const b=document.createElement('button');b.className='category';b.textContent=c.label;b.dataset.id=c.id;b.onclick=()=>{if(category===c.id)return;category=c.id;render('swap')};box.append(b)}box.dataset.tab=state.tab;box.scrollLeft=0}for(const b of box.children)b.setAttribute('aria-pressed',String(b.dataset.id===category))}
// Relevo de resultados: la tanda vieja y la nueva comparten la misma celda de
// .results; la vieja se desvanece quieta en su lugar y la nueva entra un toque
// después. 'still' (tipear, tono, abrir el panel) cambia en el acto: filtrar mientras
// escribís no espera a ninguna animación.
function mount(set,mode){
 const box=$('results');box.querySelectorAll(':scope > [data-state=closing]').forEach(e=>e.remove());
 const old=box.firstElementChild;
 if(mode==='swap'&&old){old.style.transform=`translateY(${-box.scrollTop}px)`;exit(old,{fallback:220});set.classList.add('is-after');set.addEventListener('animationend',function done(e){if(e.target!==set)return;set.removeEventListener('animationend',done);set.classList.add('is-settled')})}
 else{old?.remove();set.classList.add('is-settled')}
 box.append(set);box.scrollTop=0;
}
function render(mode='still'){
 Tooltip.hide();// su botón se va con la tanda vieja sin disparar pointerout
 document.querySelectorAll('.tab').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===state.tab)));
 renderCategories();const query=$('search').value.trim();$('clear-search').classList.toggle('is-off',!query);$('search-key').classList.toggle('is-off',!!query);
 let items;
 if(state.tab==='frequent'){
   items=state.usage.length?state.usage.map(u=>byId.get(u.id)).filter(Boolean):seed.map(id=>byId.get(id)).filter(Boolean);
   if(query)items=catalog.items;
   if(category!=='all')items=items.filter(i=>i.kind===category);
 }else{items=catalog.items.filter(i=>i.kind===state.tab&&(category==='all'||i.category===category))}
 visible=searchItems(items,query);
 $('section-name').textContent=query?'Resultados':state.tab==='frequent'?(state.usage.length?'Tus más usados':'Para empezar'):category==='all'?types.find(t=>t[0]===state.tab)[1]:catalog.categories[state.tab].find(c=>c.id===category)?.label||category;
 $('result-count').textContent=String(visible.length);$('results').setAttribute('aria-labelledby',`tab-${state.tab}`);
 const grid=document.createElement('div');grid.className=`result-set grid ${state.tab==='frequent'?'mixed':state.tab}`;
 for(const [index,item] of visible.entries()){
   const b=document.createElement('button');b.className='character';b.dataset.id=item.id;b.dataset.kind=item.kind;b.dataset.index=index;b.setAttribute('aria-label',item.label);b.dataset.tip=item.label;b.dataset.tipSide='top';
   const span=document.createElement('span');span.className='glyph';span.textContent=variant(item,toneFor(item));b.append(span);grid.append(b);
 }
 if(!visible.length){grid.className='result-set empty';grid.innerHTML=Icons.svg('moji-search');const label=document.createElement('span');label.textContent=query?'No encontramos ese carácter.':'Todavía no usaste caracteres de este tipo.';const small=document.createElement('small');small.textContent=query?'Probá con otra palabra o categoría.':'Los que elijas van a aparecer acá.';grid.append(label,small)}
 mount(grid,mode);$('tone').querySelector('.tone-dot').style.background=toneColors[state.tone];
 $('tone').classList.toggle('is-off',state.tab==='kaomoji'||state.tab==='symbol');preview(null);
 $('search').placeholder=state.tab==='symbol'?'Buscá: raíz, flecha, alfa…':state.tab==='kaomoji'?'Buscá: alegría, tristeza, animales…':'Buscá: corazón, pulgar, mate…';
}
// Un solo escuchador para toda la grilla (Emojis tiene casi 2000 botones). La tanda
// que se está yendo no cuenta.
const itemOf=target=>{const b=target.closest?.('.character');return b&&!b.parentElement.dataset.state?visible[Number(b.dataset.index)]:null};
$('results').addEventListener('mouseover',e=>{const item=itemOf(e.target);if(item)preview(item)});
$('results').addEventListener('focusin',e=>{const item=itemOf(e.target);if(item)preview(item)});
$('results').addEventListener('click',e=>{const item=itemOf(e.target);if(item)choose(item)});
$('results').addEventListener('contextmenu',e=>{const item=itemOf(e.target);if(item){e.preventDefault();choose(item,true)}});
async function choose(item,copyOnly=false){if(sending)return;sending=true;Tooltip.hide(true);try{const result=await api.choose(item.id,toneFor(item),copyOnly);state=result.state;if(!copyOnly)inserted=true;if(copyOnly){notice('Copiado');if(state.tab==='frequent'&&$('search').value==='')render()}}catch(e){notice(e.message,true)}finally{sending=false}}
// El main baja la versión nueva solo (src/updater.cjs); acá solo se cuenta y se ofrece instalar.
const updateText={dev:()=>'Corriendo desde el código: se actualiza la versión instalada.',portable:()=>'Versión portable: bajá la nueva desde GitHub.',idle:()=>'Se buscan solas al abrir Moji.',checking:()=>'Buscando…',none:()=>'Tenés la última versión.',downloading:u=>`Bajando la ${u.version}… ${u.percent||0} %`,ready:u=>`La ${u.version} está lista para instalarse.`,error:()=>'No se pudo buscar. Revisá la conexión.'};
let announced='';
function renderUpdate(u){state.update=u;$('update-status').textContent=(updateText[u.state]||updateText.idle)(u);const b=$('update-action');b.hidden=['dev','portable','downloading'].includes(u.state);b.disabled=u.state==='checking';b.textContent=u.state==='ready'?'Instalar y reiniciar':u.state==='error'?'Reintentar':'Buscar ahora'}
$('update-action').onclick=async()=>{if(state.update?.state==='ready'){api.installUpdate();return}try{renderUpdate(await api.checkUpdate())}catch(e){notice(e.message,true)}};
api.onUpdate(u=>{if(!state)return;renderUpdate(u);if(u.state==='ready'&&announced!==u.version&&!settingsOpen){announced=u.version;notice(`Moji ${u.version} está lista: instalala desde Ajustes`)}});
// Panel y Ajustes ocupan la misma celda: la que se va se desvanece y la otra entra
// a mitad de camino. animate=false al abrir el panel: aparece ya armado.
function preferences(open,animate=true){
 settingsOpen=open;Menu.close();Tooltip.hide(true);
 const [from,to]=open?[$('panel'),$('preferences')]:[$('preferences'),$('panel')];
 const swapping=animate&&!from.hidden&&!from.dataset.state;
 if(swapping)leave(from);else drop(from);
 arrive(to,swapping?'after':'still');
 if(open){$('shortcut').value=state.shortcut.replace('Control','Ctrl');$('shortcut-status').textContent=state.shortcutOK?'Atajo activo':'Atajo ocupado: elegí otra combinación';$('startup').setAttribute('aria-checked',String(state.startup));$('version').textContent=state.version;renderUpdate(state.update)}else $('search').focus();
}
$('settings').onclick=()=>preferences(!settingsOpen);$('back').onclick=()=>preferences(false);$('close').onclick=()=>api.hide();$('quit').onclick=()=>api.quit();
$('search').addEventListener('input',()=>render());$('clear-search').onclick=()=>{$('search').value='';render();$('search').focus()};
$('categories').addEventListener('wheel',e=>{if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){$('categories').scrollLeft+=e.deltaY;e.preventDefault()}},{passive:false});
$('shortcut').addEventListener('focus',()=>{$('shortcut-status').textContent='Presioná la combinación que quieras usar.'});
$('shortcut').addEventListener('keydown',async e=>{e.preventDefault();e.stopPropagation();if(e.key==='Escape'){e.target.blur();return}if(['Control','Alt','Shift','Meta'].includes(e.key))return;let key=e.code.startsWith('Key')?e.code.slice(3):e.code.startsWith('Digit')?e.code.slice(5):e.code==='Period'?'.':e.code;const chord=[e.ctrlKey?'Control':null,e.altKey?'Alt':null,e.shiftKey?'Shift':null,e.metaKey?'Super':null,key].filter(Boolean).join('+');if(await settings({shortcut:chord})){e.target.value=state.shortcut.replace('Control','Ctrl');$('shortcut-status').textContent='Atajo guardado';e.target.blur()}});
$('startup').onclick=async()=>{if(await settings({startup:!state.startup}))$('startup').setAttribute('aria-checked',String(state.startup))};
$('reset-usage').onclick=async()=>{const yes=await Modal.confirm({title:'¿Reiniciar más usados?',sub:'Se borra el conteo de usos. Tus ajustes se conservan.',confirmLabel:'Reiniciar'});if(yes){try{state=await api.clear();render();notice('Más usados reiniciados')}catch(e){notice(e.message,true)}}};
$('tone').onclick=()=>Menu.show($('tone'),toneNames.map((label,i)=>({label,selected:state.tone===i,onSelect:async()=>{if(await settings({tone:i}))render()}})),{align:'end'});
// Flechas arriba/abajo por geometría y no de a N índices: en Más usados los kaomojis
// ocupan tres columnas y las filas no tienen todas la misma cantidad.
function vertical(chars,from,dir){
 const top=from.offsetTop,cx=from.offsetLeft+from.offsetWidth/2;let i=Number(from.dataset.index)+dir;
 while(chars[i]&&chars[i].offsetTop===top)i+=dir;
 if(!chars[i])return from;
 const row=chars[i].offsetTop;let best=chars[i],gap=Infinity;
 for(;chars[i]&&chars[i].offsetTop===row;i+=dir){const d=Math.abs(chars[i].offsetLeft+chars[i].offsetWidth/2-cx);if(d<gap){gap=d;best=chars[i]}}
 return best;
}
document.addEventListener('keydown',e=>{
 if(document.querySelector('.ox-modal__anim:not([data-state=closing])'))return;
 if(e.key==='Escape'){e.preventDefault();if(Menu.isOpen){Menu.close();return}if(settingsOpen){preferences(false);return}if($('search').value&&!inserted){$('search').value='';render();return}api.hide();return}
 if(settingsOpen)return;
 if(e.key==='/'&&document.activeElement!==$('search')){e.preventDefault();$('search').focus();return}
 if(e.ctrlKey&&/^[1-4]$/.test(e.key)){e.preventDefault();changeTab(types[Number(e.key)-1][0]);return}
 if(document.activeElement?.getAttribute('role')==='tab'&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const i=types.findIndex(t=>t[0]===state.tab);changeTab(types[(i+(e.key==='ArrowRight'?1:3))%4][0],true);return}
 if(document.activeElement===$('search')&&(e.key==='ArrowDown'||e.key==='Enter')){e.preventDefault();const first=$('results').firstElementChild?.querySelector('.character');if(e.key==='Enter'&&visible[0])choose(visible[0]);else first?.focus();return}
 const active=document.activeElement?.closest('.character');
 if(active&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)){
   e.preventDefault();const chars=active.parentElement.children,idx=Number(active.dataset.index),last=chars.length-1;
   const next=e.key==='ArrowUp'||e.key==='ArrowDown'?vertical(chars,active,e.key==='ArrowDown'?1:-1):chars[{Home:0,End:last,ArrowLeft:Math.max(0,idx-1),ArrowRight:Math.min(last,idx+1)}[e.key]];
   next?.focus();
 }
 if(active&&e.ctrlKey&&e.key.toLowerCase()==='c'){e.preventDefault();choose(visible[Number(active.dataset.index)],true)}
});
// Al ocultarse, el panel no deja nada flotando para la próxima vez: ni el diálogo de
// confirmación, ni un menú, ni salidas a medias (con la ventana oculta los timers se
// frenan y quedarían en pantalla al reabrir).
function clearOverlays(){Tooltip.hide(true);Menu.close(true);Modal.close(null);document.querySelectorAll('#ox-layer > [data-state=closing]').forEach(e=>e.remove());clearTimeout(noticeTimer);drop($('notice'))}
api.onOpen(s=>{if(!catalog)return;state=s;inserted=false;category='all';$('search').value='';clearOverlays();preferences(false,false);$('categories').scrollLeft=0;render();$('search').focus();if(!state.shortcutOK)notice('El atajo está ocupado. Podés cambiarlo en Ajustes.',true)});
api.onClose(clearOverlays);
try{[state,catalog]=await Promise.all([api.state(),fetch('./data/catalog.json').then(r=>r.json())]);byId=new Map(catalog.items.map(i=>[i.id,i]));renderTabs();render();const splash=$('boot-splash');splash.dataset.state='closing';setTimeout(()=>splash.remove(),190);$('search').focus();document.documentElement.dataset.ready='true'}catch(e){$('boot-splash').textContent='No se pudo abrir Moji';notice(e.message,true)}
