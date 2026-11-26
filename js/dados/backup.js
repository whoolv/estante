// Backup das marcações (sem PDFs): validar e juntar com o que já existe no aparelho.

export class ErroBackupInvalido extends Error {
  constructor() {
    super('Esse arquivo não é um backup da Estante.');
    this.name = 'ErroBackupInvalido';
  }
}

const ehId = (v) => typeof v === 'string' && v.length > 0 && v.length <= 128;
const ehPagina = (v) => Number.isInteger(v) && v >= 1;
const ehNumero = (v) => typeof v === 'number' && Number.isFinite(v);
const ehTexto = (v) => typeof v === 'string';
const ehRetangulo = (r) => r && ['x', 'y', 'w', 'h'].every((k) => ehNumero(r[k]));

const livroOk = (l) => l && ehId(l.id) && ehTexto(l.titulo) && ehPagina(l.pagina)
  && (l.posicao == null || ehNumero(l.posicao)) && (l.ultimaLeitura == null || ehNumero(l.ultimaLeitura));
const marcadorOk = (m) => m && ehTexto(m.id) && ehId(m.livroId) && ehPagina(m.pagina) && (m.nome == null || ehTexto(m.nome));
const marcaOk = (m) => m && ehTexto(m.id) && ehId(m.livroId) && ehPagina(m.pagina) && ehTexto(m.texto)
  && Array.isArray(m.rects) && m.rects.length > 0 && m.rects.every(ehRetangulo);

/** Confere o formato do backup e devolve uma cópia só com os itens válidos (itens estragados são ignorados). */
export function validarBackup(obj) {
  const ok = obj && typeof obj === 'object' && obj.app === 'estante' && obj.versao === 1
    && Array.isArray(obj.livros) && Array.isArray(obj.marcadores) && Array.isArray(obj.marcas);
  if (!ok) throw new ErroBackupInvalido();
  return {
    ...obj,
    livros: obj.livros.filter(livroOk),
    marcadores: obj.marcadores.filter(marcadorOk),
    marcas: obj.marcas.filter(marcaOk),
  };
}

const chaveMarcador = (m) => `${m.livroId}|${m.pagina}|${m.nome ?? ''}`;
const chaveMarca = (m) => `${m.livroId}|${m.pagina}|${m.texto ?? ''}|${JSON.stringify(m.rects ?? [])}`;

/**
 * Junta `importado` em `atual`. Progresso: vence a leitura mais recente (nula perde).
 * Título local prevalece. Marcadores e marcas iguais não se repetem.
 * Também devolve `novos`: só o que mudou ou entrou, para gravar.
 */
export function mesclar(atual, importado) {
  const livros = new Map(atual.livros.map((l) => [l.id, { ...l }]));
  const novos = { livros: [], marcadores: [], marcas: [] };

  for (const imp of importado.livros) {
    const local = livros.get(imp.id);
    if (!local) {
      const novo = { id: imp.id, titulo: imp.titulo, pagina: imp.pagina, posicao: imp.posicao ?? 0, ultimaLeitura: imp.ultimaLeitura ?? null };
      livros.set(imp.id, novo);
      novos.livros.push(novo);
    } else if ((imp.ultimaLeitura ?? -Infinity) > (local.ultimaLeitura ?? -Infinity)) {
      Object.assign(local, { pagina: imp.pagina, posicao: imp.posicao ?? 0, ultimaLeitura: imp.ultimaLeitura });
      novos.livros.push(local);
    }
  }

  const juntar = (lista, entrada, chave, destino) => {
    const vistos = new Set(lista.map(chave));
    const ids = new Set(lista.map((x) => x.id));
    const saida = [...lista];
    for (const item of entrada) {
      const k = chave(item);
      if (vistos.has(k)) continue;
      vistos.add(k);
      const copia = { ...item, id: ids.has(item.id) || !item.id ? crypto.randomUUID() : item.id };
      ids.add(copia.id);
      saida.push(copia);
      destino.push(copia);
    }
    return saida;
  };

  return {
    livros: [...livros.values()],
    marcadores: juntar(atual.marcadores, importado.marcadores, chaveMarcador, novos.marcadores),
    marcas: juntar(atual.marcas, importado.marcas, chaveMarca, novos.marcas),
    novos,
  };
}
