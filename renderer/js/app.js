import {Icons} from './icons.js';
import {Tooltip,Menu,Modal} from './overlays.js';
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
let state, catalog, byId, category='all', visible=[], settingsOpen=false, sending=false, inserted=false, noticeTimer;
const seed=['1F601','1F602','1F923','1F60A','1F609','1F60D','1F970','1F618','1F60E','1F914','1F62D','1F605','1F44D','1F44F','1F64C','1F64F','2764','1F525','2728','1F389','1F4AA','1F440','1F9C9','1F680'];
function notice(message,error=false){clearTimeout(noticeTimer);$('notice').textContent=message;$('notice').classList.toggle('error',error);$('notice').hidden=false;noticeTimer=setTimeout(()=>$('notice').hidden=true,error?7000:2000)}
async function settings(patch){try{state=await api.settings(patch);return true}catch(e){notice(e.message,true);return false}}
function toneFor(item){return state.tab==='frequent'?(state.usage.find(u=>u.id===item.id)?.tone??state.tone):state.tone}
function preview(item){if(!item){$('preview-char').textContent='';$('preview-label').textContent='';return}const value=variant(item,toneFor(item));$('preview-char').textContent=value;$('preview-char').classList.toggle('kao-preview',item.kind==='kaomoji');$('preview-label').textContent=item.label}
function renderTabs(){for(const [id,label,icon] of types){const b=document.createElement('button');b.className='tab';b.id=`tab-${id}`;b.setAttribute('role','tab');b.setAttribute('aria-controls','results');b.setAttribute('aria-selected',String(id===state.tab));b.dataset.tab=id;b.innerHTML=Icons.svg(icon)+`<span>${label}</span>`;b.onclick=()=>changeTab(id);$('tabs').append(b)}}
async function changeTab(id){state.tab=id;category='all';$('search').value='';render();await settings({tab:id});$('search').focus()}
function renderCategories(){const box=$('categories');box.replaceChildren();const cats=state.tab==='frequent'?[{id:'all',label:'Todos'},{id:'emoji',label:'Emojis'},{id:'kaomoji',label:'Kaomojis'},{id:'symbol',label:'Símbolos'}]:[{id:'all',label:'Todos'},...catalog.categories[state.tab]];for(const c of cats){const b=document.createElement('button');b.className='category';b.textContent=c.label;b.setAttribute('aria-pressed',String(c.id===category));b.onclick=()=>{category=c.id;render()};box.append(b)}}
// still: al abrir el panel la grilla nace quieta; aparece la ventana entera, no la grilla.
function render(still=false){
 document.querySelectorAll('.tab').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===state.tab)));
 renderCategories();const query=$('search').value.trim();$('clear-search').hidden=!query;$('search-key').hidden=!!query;
 let items;
 if(state.tab==='frequent'){
   items=state.usage.length?state.usage.map(u=>byId.get(u.id)).filter(Boolean):seed.map(id=>byId.get(id)).filter(Boolean);
   if(query)items=catalog.items;
   if(category!=='all')items=items.filter(i=>i.kind===category);
 }else{items=catalog.items.filter(i=>i.kind===state.tab&&(category==='all'||i.category===category))}
 visible=searchItems(items,query);
 $('section-name').textContent=query?'Resultados':state.tab==='frequent'?(state.usage.length?'Tus más usados':'Para empezar'):category==='all'?types.find(t=>t[0]===state.tab)[1]:catalog.categories[state.tab].find(c=>c.id===category)?.label||category;
 $('result-count').textContent=String(visible.length);$('results').setAttribute('aria-labelledby',`tab-${state.tab}`);
 const grid=document.createElement('div');grid.className=`grid ${state.tab==='frequent'?'mixed':state.tab}${still?' still':''}`;
 for(const [index,item] of visible.entries()){
   const b=document.createElement('button');b.className='character';b.dataset.id=item.id;b.dataset.kind=item.kind;b.dataset.index=index;b.setAttribute('aria-label',item.label);b.dataset.tip=item.label;b.dataset.tipSide='top';
   const span=document.createElement('span');span.className='glyph';span.textContent=variant(item,toneFor(item));b.append(span);
   b.addEventListener('mouseenter',()=>preview(item));b.addEventListener('focus',()=>preview(item));
   b.onclick=()=>choose(item);b.oncontextmenu=e=>{e.preventDefault();choose(item,true)};grid.append(b);
 }
 if(!visible.length){grid.className='empty';grid.innerHTML=Icons.svg('moji-search');const label=document.createElement('span');label.textContent=query?'No encontramos ese carácter.':'Todavía no usaste caracteres de este tipo.';const small=document.createElement('small');small.textContent=query?'Probá con otra palabra o categoría.':'Los que elijas van a aparecer acá.';grid.append(label,small)}
 $('results').replaceChildren(grid);$('results').scrollTop=0;$('tone').querySelector('.tone-dot').style.background=toneColors[state.tone];
 $('tone').hidden=state.tab==='kaomoji'||state.tab==='symbol';preview(null);
 $('search').placeholder=state.tab==='symbol'?'Buscá: raíz, flecha, alfa…':state.tab==='kaomoji'?'Buscá: alegría, tristeza, animales…':'Buscá: corazón, pulgar, mate…';
}
async function choose(item,copyOnly=false){if(sending)return;sending=true;Tooltip.hide(true);try{const result=await api.choose(item.id,toneFor(item),copyOnly);state=result.state;if(!copyOnly)inserted=true;if(copyOnly){notice('Copiado');if(state.tab==='frequent'&&$('search').value==='')render()}}catch(e){notice(e.message,true)}finally{sending=false}}
// El main baja la versión nueva solo (src/updater.cjs); acá solo se cuenta y se ofrece instalar.
const updateText={dev:()=>'Corriendo desde el código: se actualiza la versión instalada.',portable:()=>'Versión portable: bajá la nueva desde GitHub.',idle:()=>'Se buscan solas al abrir Moji.',checking:()=>'Buscando…',none:()=>'Tenés la última versión.',downloading:u=>`Bajando la ${u.version}… ${u.percent||0} %`,ready:u=>`La ${u.version} está lista para instalarse.`,error:()=>'No se pudo buscar. Revisá la conexión.'};
let announced='';
function renderUpdate(u){state.update=u;$('update-status').textContent=(updateText[u.state]||updateText.idle)(u);const b=$('update-action');b.hidden=['dev','portable','downloading'].includes(u.state);b.disabled=u.state==='checking';b.textContent=u.state==='ready'?'Instalar y reiniciar':u.state==='error'?'Reintentar':'Buscar ahora'}
$('update-action').onclick=async()=>{if(state.update?.state==='ready'){api.installUpdate();return}try{renderUpdate(await api.checkUpdate())}catch(e){notice(e.message,true)}};
api.onUpdate(u=>{if(!state)return;renderUpdate(u);if(u.state==='ready'&&announced!==u.version&&!$('panel').hidden){announced=u.version;notice(`Moji ${u.version} está lista: instalala desde Ajustes`)}});
function preferences(open){settingsOpen=open;$('panel').hidden=open;$('preferences').hidden=!open;Menu.close();Tooltip.hide(true);if(open){$('shortcut').value=state.shortcut.replace('Control','Ctrl');$('shortcut-status').textContent=state.shortcutOK?'Atajo activo':'Atajo ocupado: elegí otra combinación';$('startup').setAttribute('aria-checked',String(state.startup));$('version').textContent=state.version;renderUpdate(state.update)}else $('search').focus()}
$('settings').onclick=()=>preferences(!settingsOpen);$('back').onclick=()=>preferences(false);$('close').onclick=()=>api.hide();$('quit').onclick=()=>api.quit();
$('search').addEventListener('input',()=>render());$('clear-search').onclick=()=>{$('search').value='';render();$('search').focus()};
$('categories').addEventListener('wheel',e=>{if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){$('categories').scrollLeft+=e.deltaY;e.preventDefault()}},{passive:false});
$('shortcut').addEventListener('focus',()=>{$('shortcut-status').textContent='Presioná la combinación que quieras usar.'});
$('shortcut').addEventListener('keydown',async e=>{e.preventDefault();e.stopPropagation();if(e.key==='Escape'){e.target.blur();return}if(['Control','Alt','Shift','Meta'].includes(e.key))return;let key=e.code.startsWith('Key')?e.code.slice(3):e.code.startsWith('Digit')?e.code.slice(5):e.code==='Period'?'.':e.code;const chord=[e.ctrlKey?'Control':null,e.altKey?'Alt':null,e.shiftKey?'Shift':null,e.metaKey?'Super':null,key].filter(Boolean).join('+');if(await settings({shortcut:chord})){e.target.value=state.shortcut.replace('Control','Ctrl');$('shortcut-status').textContent='Atajo guardado';e.target.blur()}});
$('startup').onclick=async()=>{if(await settings({startup:!state.startup}))$('startup').setAttribute('aria-checked',String(state.startup))};
$('reset-usage').onclick=async()=>{const yes=await Modal.confirm({title:'¿Reiniciar más usados?',sub:'Se borra el conteo de usos. Tus ajustes se conservan.',confirmLabel:'Reiniciar'});if(yes){state=await api.clear();render();notice('Más usados reiniciados')}};
$('tone').onclick=()=>Menu.show($('tone'),toneNames.map((label,i)=>({label,selected:state.tone===i,onSelect:async()=>{if(await settings({tone:i}))render()}})),{align:'end'});
document.addEventListener('keydown',e=>{
 if(document.querySelector('.ox-modal'))return;
 if(e.key==='Escape'){e.preventDefault();if(Menu.isOpen){Menu.close();return}if(settingsOpen){preferences(false);return}if($('search').value&&!inserted){$('search').value='';render();return}api.hide();return}
 if(settingsOpen)return;
 if(e.key==='/'&&document.activeElement!==$('search')){e.preventDefault();$('search').focus();return}
 if(e.ctrlKey&&/^[1-4]$/.test(e.key)){e.preventDefault();changeTab(types[Number(e.key)-1][0]);return}
 if(document.activeElement?.getAttribute('role')==='tab'&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const i=types.findIndex(t=>t[0]===state.tab);changeTab(types[(i+(e.key==='ArrowRight'?1:3))%4][0]);return}
 if(document.activeElement===$('search')&&(e.key==='ArrowDown'||e.key==='Enter')){e.preventDefault();const first=$('results').querySelector('.character');if(e.key==='Enter'&&visible[0])choose(visible[0]);else first?.focus();return}
 const active=document.activeElement?.closest('.character');
 if(active&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)){
   e.preventDefault();const columns=state.tab==='kaomoji'?3:8;const idx=Number(active.dataset.index);const next=e.key==='Home'?0:e.key==='End'?visible.length-1:idx+({ArrowLeft:-1,ArrowRight:1,ArrowUp:-columns,ArrowDown:columns}[e.key]);$('results').querySelector(`[data-index="${Math.max(0,Math.min(visible.length-1,next))}"]`)?.focus();
 }
 if(active&&e.ctrlKey&&e.key.toLowerCase()==='c'){e.preventDefault();choose(visible[Number(active.dataset.index)],true)}
});
api.onOpen(s=>{if(!catalog)return;state=s;inserted=false;category='all';$('search').value='';preferences(false);render(true);$('search').focus();if(!state.shortcutOK)notice('El atajo está ocupado. Podés cambiarlo en Ajustes.',true)});
api.onClose(()=>{Tooltip.hide(true);Menu.close();$('notice').hidden=true});
try{[state,catalog]=await Promise.all([api.state(),fetch('./data/catalog.json').then(r=>r.json())]);byId=new Map(catalog.items.map(i=>[i.id,i]));renderTabs();render();const splash=$('boot-splash');splash.dataset.state='closing';setTimeout(()=>splash.remove(),190);$('search').focus();document.documentElement.dataset.ready='true'}catch(e){$('boot-splash').textContent='No se pudo abrir Moji';notice(e.message,true)}
