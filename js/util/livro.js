/** Percentual lido (0..100). Livro nunca aberto conta como 0. */
export function percentualLido(livro) {
  if (livro.ultimaLeitura == null || !livro.paginas) return 0;
  return Math.min(100, Math.max(0, Math.round((livro.pagina / livro.paginas) * 100)));
}

const GENERICOS = /^(untitled|sem t[ií]tulo|document|documento)$/i;

/** Título inicial: o dos metadados do PDF, se for útil; senão o nome do arquivo limpo. */
export function tituloInicial(tituloMeta, nomeArquivo) {
  const meta = (tituloMeta ?? '').trim();
  if (meta.length >= 3 && !GENERICOS.test(meta)) return meta;
  return nomeArquivo.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}
