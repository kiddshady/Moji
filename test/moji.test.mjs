import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {searchItems,variant} from '../renderer/js/search.mjs';
const require=createRequire(import.meta.url);
const {data,resolve,rank}=require('../src/catalog.cjs');
const {events,stride}=require('../src/native.cjs');
assert.equal(new Set(data.items.map(i=>i.id)).size,data.items.length);
assert(data.items.filter(i=>i.kind==='emoji').length>1800);
assert(searchItems(data.items,'corazon').some(i=>i.id==='2764'));
assert(searchItems(data.items,'mate').some(i=>i.id==='1F9C9'));
assert(searchItems(data.items,'raiz').some(i=>i.value==='√'));
assert(searchItems(data.items,'grinning').length>0);
assert(searchItems(data.items,'pulgar arriba').some(i=>i.id==='1F44D'));
// Lo que sugieren los placeholders del buscador tiene que encontrar algo.
for(const q of ['corazon','pulgar','mate','alegria','tristeza','animales','raiz','flecha','alfa'])assert(searchItems(data.items,q).length>0,`el buscador sugiere "${q}" y no encuentra nada`);
assert.equal(resolve('1F44D',1).value,'👍🏻');
assert.equal(variant(resolve('1F44D'),5),'👍🏿');
assert.throws(()=>resolve('../invalido',0));
assert.throws(()=>resolve('1F44D',99));
assert.deepEqual(rank({'1F44D':{count:3,last:1},'1F601':{count:1,last:10},'1F602':{count:3,last:20}}).map(i=>i.id),['1F602','1F44D','1F601']);
const complex='👩🏽‍💻';
const b=events(complex),offset=stride===40?8:4;
assert.equal(b.length,complex.length*2*stride);
for(let i=0;i<complex.length;i++){assert.equal(b.readUInt16LE(i*2*stride+offset+2),complex.charCodeAt(i));assert.equal(b.readUInt32LE((i*2+1)*stride+offset+4),6)}
console.log(`Catálogo, búsqueda, tonos, frecuencia y UTF-16: OK (${data.items.length} caracteres).`);
