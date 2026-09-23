'use strict';
const data = require('../renderer/data/catalog.json');
const byId = new Map(data.items.map(item => [item.id, item]));
function resolve(id, tone = 0) {
  const item = byId.get(id);
  if (!item) throw new Error('Carácter desconocido.');
  if (!Number.isInteger(tone) || tone < 0 || tone > 5) throw new Error('Tono no válido.');
  const skin = item.skins?.find(s => s.tone === tone);
  return { ...item, value: skin?.value || item.value };
}
function rank(usage) {
  return Object.entries(usage).filter(([id]) => byId.has(id))
    .sort((a, b) => b[1].count - a[1].count || b[1].last - a[1].last).slice(0, 80)
    .map(([id, stat]) => ({ id, ...stat }));
}
module.exports = { resolve, rank, data };
