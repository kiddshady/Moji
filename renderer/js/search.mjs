export const normalize = text => String(text).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim();
export function searchItems(items, query) {
 const words=normalize(query).split(/\s+/).filter(Boolean);
 if(!words.length)return items;
 return items.filter(i=>words.every(w=>normalize(`${i.label} ${i.tags||''} ${i.category} ${i.value}`).includes(w)));
}
export function variant(item,tone){return item.skins?.find(s=>s.tone===tone)?.value||item.value}
