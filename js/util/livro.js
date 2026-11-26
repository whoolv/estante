/** Percentual lido (0..100). Livro nunca aberto conta como 0. */
export function percentualLido(livro) {
  if (livro.ultimaLeitura == null || !livro.paginas) return 0;
  return Math.min(100, Math.max(0, Math.round((livro.pagina / livro.paginas) * 100)));
}

const GENERICOS = /^(untitled|sem t[ií]tulo|document|documento)$/i;

/** Título inicial: o dos metadados do PDF, se for útil; senão o nome do arquivo limpo. */
export function tituloInicial(tituloMeta, nomeArquivo) {
  const meta = (tituloMeta ?? '').trim();
  if (meta.length >= 3 && !GENERICOS.test(meta) && !tituloPareceArquivo(meta)) return meta;
  return nomeArquivo.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const ARQUIVO = /\.(indd|indb|idml|qxd|qxp|docx?|odt|rtf|pdf|pmd|p65|tex|pages|fm|e?ps)$/i;

/** O título interno do PDF é só o nome do arquivo de origem (ex.: "Kurose_menor.indb")? */
export function tituloPareceArquivo(titulo) {
  const t = String(titulo ?? '').trim();
  return ARQUIVO.test(t) || /^microsoft (word|powerpoint|excel) - /i.test(t);
}
