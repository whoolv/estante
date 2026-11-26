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

const ESTRANHOS = /[\u0000-\u001f\u007f�-□]/g;
const CJK = /[⺀-⿿぀-ヿ㐀-䶿一-鿿가-힯豈-﫿]/g;
const LATINO = /[A-Za-zÀ-ÿ]/;

/** Limpa títulos do sumário com caracteres embaralhados (defeito comum em PDFs). */
export function limparTituloSumario(titulo) {
  let s = String(titulo ?? '').replace(ESTRANHOS, ' ');
  if (LATINO.test(s)) s = s.replace(CJK, ' ');
  // tira parênteses que sobraram sem par
  let profundidade = 0;
  let saida = '';
  for (const c of s) {
    if (c === '(') profundidade++;
    if (c === ')') { if (profundidade === 0) continue; profundidade--; }
    saida += c;
  }
  while (profundidade-- > 0) saida = saida.replace(/\((?![^(]*\))/, ' ');
  return saida.replace(/\s+/g, ' ').trim();
}
