/** Achata o sumário do PDF.js em pré-ordem: [{titulo, nivel, dest}]. */
export function achatarSumario(outline, nivel = 0) {
  if (!Array.isArray(outline)) return [];
  return outline.flatMap((item) => [
    { titulo: String(item.title ?? '').trim(), nivel, dest: item.dest },
    ...achatarSumario(item.items, nivel + 1),
  ]);
}

/** Minúsculas e sem acentos, para comparar textos na busca. */
export function normalizarBusca(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
