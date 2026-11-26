import { normalizarBusca } from '../util/texto.js';

/**
 * Ocorrências de `termo` nos textos das páginas (textos[0] = página 1), sem diferenciar acento ou caixa.
 * Termos com menos de 2 caracteres não buscam nada.
 */
export function encontrarOcorrencias(textos, termo) {
  const alvo = normalizarBusca(String(termo ?? '').trim());
  if (alvo.length < 2) return [];
  const saida = [];
  textos.forEach((texto, i) => {
    const t = normalizarBusca(texto);
    let de = 0;
    for (;;) {
      const achou = t.indexOf(alvo, de);
      if (achou < 0) break;
      saida.push({ pagina: i + 1, inicio: achou });
      de = achou + alvo.length;
    }
  });
  return saida;
}
