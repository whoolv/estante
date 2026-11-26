/** Achata o sumário do PDF.js em pré-ordem: [{titulo, nivel, dest}]. */
export function achatarSumario(outline, nivel = 0) {
  if (!Array.isArray(outline)) return [];
  return outline.flatMap((item) => [
    { titulo: limparTituloSumario(item.title), nivel, dest: item.dest },
    ...achatarSumario(item.items, nivel + 1),
  ]);
}

/** Minúsculas e sem acentos, para comparar textos na busca. */
export function normalizarBusca(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Sinais de texto embaralhado: caractere de substituição, área de uso privado e o quadrado "□".
const LIXO = '\\ufffd\\ue000-\\uf8ff\\u25a1';
const CJK = '\\u2e80-\\u2fff\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uac00-\\ud7af\\uf900-\\ufaff';
// Um sinal de lixo e o que vem grudado nele (ideogramas soltos, espaços e parênteses), até o fim do trecho.
const TRECHO_EMBARALHADO = new RegExp(`\\s*[${LIXO}][${LIXO}${CJK}\\s()]*`, 'g');
const CONTROLE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/**
 * Limpa títulos do sumário com caracteres embaralhados (defeito comum em PDFs).
 * Só mexe onde há sinal de lixo: títulos de verdade em qualquer escrita ficam como estão.
 */
export function limparTituloSumario(titulo) {
  const s = String(titulo ?? '').replace(CONTROLE, ' ').replace(TRECHO_EMBARALHADO, ' ');
  return s.replace(/\s+/g, ' ').trim();
}
