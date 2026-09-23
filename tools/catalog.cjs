'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const es = require('emojibase-data/es/data.json');
const en = new Map(require('emojibase-data/en/data.json').map(e => [e.hexcode, e]));
const groupNames = {0:'Caritas y emociones',1:'Personas y manos',3:'Animales y naturaleza',4:'Comida y bebida',5:'Viajes y lugares',6:'Actividades',7:'Objetos',8:'Símbolos emoji',9:'Banderas'};
const aliases = {'1F602':'jajaja risa risas lol','1F923':'jajaja risa carcajada lol','1F601':'feliz sonrisa dientes','1F44D':'bien ok dale like pulgar','1F44E':'mal dislike pulgar','1F9C9':'mate argentina','1F1E6-1F1F7':'argentina bandera','2764':'amor corazón corazon rojo','1F525':'fuego buenisimo','1F389':'fiesta cumple cumpleaños','1F914':'pensar duda mmm','1F480':'calavera muerto me muero'};
const items = es.filter(e => groupNames[e.group] && Number.isFinite(e.order)).map(e => ({
  id:e.hexcode, kind:'emoji', category:String(e.group), label:e.label, value:e.emoji,
  tags:[...(e.tags || []), en.get(e.hexcode)?.label || '', ...(en.get(e.hexcode)?.tags || []), aliases[e.hexcode] || ''].join(' '),
  skins:(e.skins || []).filter(s => Number.isInteger(s.tone)).map(s => ({tone:s.tone,value:s.emoji})),
  version:e.version,
}));
const kaos = {
  'Alegría': ['(＾▽＾)','(≧▽≦)','ヽ(・∀・)ﾉ','(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧','(*^‿^*)','(⌒‿⌒)','(✧ω✧)','( ´ ▽ ` )','٩(◕‿◕｡)۶','(๑˃ᴗ˂)ﻭ','ヾ(☆▽☆)','(o´▽`o)'],
  'Amor': ['(♡˙︶˙♡)','(｡♥‿♥｡)','(づ｡◕‿‿◕｡)づ','(っ˘з(˘⌣˘ )','( ˘ ³˘)♥','(♡°▽°♡)','(◕‿◕)♡','(⁄ ⁄•⁄ω⁄•⁄ ⁄)','(つ≧▽≦)つ','♡( ◡‿◡ )'],
  'Tristeza': ['(╥﹏╥)','(｡•́︿•̀｡)','(ಥ﹏ಥ)','(つω`｡)','(T_T)','(；ω；)','(ノ_<。)','(｡╯︵╰｡)','(╯︵╰,)','(っ˘̩╭╮˘̩)っ'],
  'Sorpresa': ['(⊙_⊙)','Σ(°ロ°)','(°口°)！','(O_O;)','(⊙ω⊙)','(・・;)','(゜-゜)','(⊙﹏⊙)','(＃°Д°)','(ﾉﾟ0ﾟ)ﾉ'],
  'Actitud': ['¯\\_(ツ)_/¯','(¬‿¬)','( •_•)>⌐■-■','(⌐■_■)','(ง •̀_•́)ง','(╯°□°)╯︵ ┻━┻','┬─┬ノ( º _ ºノ)','ಠ_ಠ','(눈_눈)','( •̀ ω •́ )✧','(￣ヘ￣)','(－_－) zzZ'],
  'Animales': ['ฅ^•ﻌ•^ฅ','(=^･ω･^=)','ʕ•ᴥ•ʔ','／(≧ x ≦)＼','(=｀ω´=)','U・ᴥ・U','(•ө•)','(=①ω①=)','ʕっ•ᴥ•ʔっ','／(^ x ^)＼'],
};
for (const [category, values] of Object.entries(kaos)) values.forEach((value, i) => items.push({id:`kao-${category}-${i}`,kind:'kaomoji',category,label:`${category} ${i+1}`,value,tags:category==='Alegría'?'feliz risa sonrisa fiesta':category==='Actitud'?'meh duda enojo dormir pelea shrug mesa':category.toLowerCase()}));
const symbols = {
 'Matemática': [['±','más menos'],['×','multiplicación por'],['÷','división'],['≠','distinto desigual'],['≈','aproximadamente'],['≤','menor igual'],['≥','mayor igual'],['∞','infinito'],['√','raíz cuadrada'],['∑','sumatoria sigma'],['∏','productoria'],['∫','integral'],['∂','derivada parcial'],['∆','incremento delta'],['∇','nabla'],['∈','pertenece'],['∉','no pertenece'],['∩','intersección'],['∪','unión'],['∅','vacío'],['∀','para todo'],['∃','existe'],['∝','proporcional'],['π','pi'],['‰','por mil'],['°','grados']],
 'Flechas': [['←','izquierda'],['→','derecha reacción'],['↑','arriba gas'],['↓','abajo precipitado'],['↔','ambos lados'],['↕','vertical'],['↗','noreste'],['↘','sureste'],['↙','suroeste'],['↖','noroeste'],['⇒','implica'],['⇐','implica izquierda'],['⇔','equivalencia'],['⇌','equilibrio químico'],['⇄','reversible'],['⟶','flecha larga reacción']],
 'Letras griegas': Array.from('αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΘΛΞΠΣΦΨΩ').map(c=>[c,(['alfa','beta','gamma','delta','epsilon','zeta','eta','theta','iota','kappa','lambda','mu micro','nu','xi','omicron','pi','rho','sigma','tau','upsilon','phi','chi','psi','omega']['αβγδεζηθικλμνξοπρστυφχψω'.indexOf(c.toLowerCase())] || '')+' griega']),
 'Tipografía': [['©','copyright'],['®','marca registrada'],['™','marca comercial'],['…','puntos suspensivos'],['—','raya guion largo'],['–','guion medio'],['·','punto medio'],['•','viñeta'],['§','sección'],['¶','párrafo'],['†','daga'],['‡','doble daga'],['«','comillas apertura'],['»','comillas cierre'],['“','comilla curva apertura'],['”','comilla curva cierre'],['‘','comilla simple apertura'],['’','apóstrofo'],['¿','pregunta apertura'],['¡','exclamación apertura']],
 'Monedas': [['$','peso dólar'],['€','euro'],['£','libra'],['¥','yen yuan'],['₿','bitcoin'],['¢','centavo'],['₽','rublo'],['₹','rupia'],['₩','won'],['₺','lira']],
 'Super y subíndices': Array.from('⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿᵃᵇᶜ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎').map((c,i)=>[c,`${i<19?'superíndice exponente':'subíndice química'} ${i<10?i:i>=19&&i<29?i-19:''}`]),
 'Formas': [['✓','tilde correcto check'],['✗','cruz incorrecto'],['★','estrella llena'],['☆','estrella vacía'],['●','círculo lleno'],['○','círculo vacío'],['■','cuadrado lleno'],['□','cuadrado vacío'],['◆','rombo lleno'],['◇','rombo vacío'],['▲','triángulo arriba'],['▼','triángulo abajo'],['◀','triángulo izquierda'],['▶','triángulo derecha'],['♡','corazón contorno'],['♥','corazón lleno'],['♪','nota musical'],['♫','notas musicales']],
};
for(const [category, values] of Object.entries(symbols)) values.forEach(([value,label],i)=>items.push({id:`sym-${category}-${i}`,kind:'symbol',category,label,value,tags:category}));
const categories={emoji:Object.entries(groupNames).map(([id,label])=>({id,label})),kaomoji:Object.keys(kaos).map(id=>({id,label:id})),symbol:Object.keys(symbols).map(id=>({id,label:id}))};
fs.mkdirSync(path.join(root,'renderer/data'),{recursive:true});
fs.writeFileSync(path.join(root,'renderer/data/catalog.json'),JSON.stringify({categories,items}));
console.log(`${items.length} caracteres preparados.`);
