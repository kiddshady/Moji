/* La búsqueda: cada palabra tiene que aparecer en el nombre, las etiquetas,
   la categoría o el propio carácter. Sin tildes ni mayúsculas, así «corazon»
   encuentra «corazón». La usan el renderer y test/moji.test.mjs. */

export const normalize = (text) => String(text).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

export function searchItems(items, query) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return items;
  return items.filter((i) => {
    const haystack = normalize(`${i.label} ${i.tags || ''} ${i.category} ${i.value}`);
    return words.every((w) => haystack.includes(w));
  });
}

/** El carácter con el tono pedido, o el original si no tiene variantes. */
export function variant(item, tone) {
  return item.skins?.find((s) => s.tone === tone)?.value || item.value;
}
