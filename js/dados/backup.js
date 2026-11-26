// Backup das marcações (sem PDFs): validar e juntar com o que já existe no aparelho.

export class ErroBackupInvalido extends Error {
  constructor() {
    super('Esse arquivo não é um backup da Estante.');
    this.name = 'ErroBackupInvalido';
  }
}

export function validarBackup(obj) {
  const ok = obj && typeof obj === 'object' && obj.app === 'estante' && obj.versao === 1
    && Array.isArray(obj.livros) && Array.isArray(obj.marcadores) && Array.isArray(obj.marcas);
  if (!ok) throw new ErroBackupInvalido();
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
