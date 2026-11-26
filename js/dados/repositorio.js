import { validarBackup, mesclar } from './backup.js';

// Único módulo que conversa com o IndexedDB. O resto do app usa só estas funções,
// para que uma futura sincronização (Google Drive) possa entrar aqui sem mexer nas telas.

/** @typedef {{id:string, titulo:string, paginas:number, arquivoNome:string,
 *   adicionadoEm:number, ultimaLeitura:number|null, pagina:number, posicao:number}} Livro
 *  pagina: 1-based; posicao: 0..1 dentro da página */
/** @typedef {{id:string, livroId:string, pagina:number, nome:string, criadoEm:number}} Marcador */
/** @typedef {{x:number,y:number,w:number,h:number}} Retangulo  (0..1 relativo à página) */
/** @typedef {{id:string, livroId:string, pagina:number, rects:Retangulo[], texto:string, criadoEm:number}} Marca */

export class ErroLivroRepetido extends Error {
  constructor(livro) {
    super(`“${livro.titulo}” já está na estante.`);
    this.name = 'ErroLivroRepetido';
    this.livro = livro;
  }
}

export class ErroSemEspaco extends Error {
  constructor() {
    super('Não há espaço no aparelho.');
    this.name = 'ErroSemEspaco';
  }
}

const VERSAO = 1;
const STORES = ['livros', 'arquivos', 'capas', 'marcadores', 'marcas', 'pendentes'];

const ehCota = (e) => e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED');

function pedido(req) {
  return new Promise((ok, falha) => {
    req.onsuccess = () => ok(req.result);
    req.onerror = () => falha(req.error);
  });
}

function abrirBanco(nome) {
  const req = indexedDB.open(nome, VERSAO);
  req.onupgradeneeded = () => {
    const db = req.result;
    for (const s of ['livros', 'arquivos', 'capas', 'pendentes']) {
      if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
    }
    for (const s of ['marcadores', 'marcas']) {
      if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }).createIndex('livroId', 'livroId');
    }
  };
  return pedido(req);
}

/**
 * Roda `trabalho(stores)` numa transação e resolve com o retorno dele quando a transação termina.
 * Qualquer erro aborta a transação inteira (nada fica pela metade).
 */
function transacao(db, nomes, modo, trabalho) {
  return new Promise((ok, falha) => {
    const tx = db.transaction(nomes, modo);
    const stores = Object.fromEntries(nomes.map((n) => [n, tx.objectStore(n)]));
    let resultado;
    let erro = null;
    tx.oncomplete = () => ok(resultado);
    tx.onabort = () => {
      const e = erro ?? tx.error;
      falha(ehCota(e) ? new ErroSemEspaco() : e ?? new Error('Transação cancelada'));
    };
    Promise.resolve()
      .then(() => trabalho(stores))
      .then((r) => { resultado = r; })
      .catch((e) => {
        erro = e;
        try { tx.abort(); } catch { falha(ehCota(e) ? new ErroSemEspaco() : e); }
      });
  });
}

const porLivro = (store, livroId) => pedido(store.index('livroId').getAll(livroId));

export async function abrirRepositorio(nomeBanco = 'estante') {
  const db = await abrirBanco(nomeBanco);
  const ler = (store, id) => transacao(db, [store], 'readonly', async (s) => (await pedido(s[store].get(id))) ?? null);

  return {
    /** @returns {Promise<Livro>} */
    async adicionarLivro({ id, titulo, paginas, arquivoNome, arquivo, capa }) {
      return transacao(db, ['livros', 'arquivos', 'capas', 'pendentes'], 'readwrite', async (s) => {
        const existente = await pedido(s.livros.get(id));
        if (existente) throw new ErroLivroRepetido(existente);
        const pendente = await pedido(s.pendentes.get(id));
        /** @type {Livro} */
        const livro = {
          id, titulo, paginas, arquivoNome, adicionadoEm: Date.now(),
          ultimaLeitura: null, pagina: 1, posicao: 0,
        };
        if (pendente) {
          Object.assign(livro, {
            titulo: pendente.titulo || titulo,
            pagina: Math.min(Math.max(1, pendente.pagina), paginas),
            posicao: pendente.posicao ?? 0,
            ultimaLeitura: pendente.ultimaLeitura ?? null,
          });
          s.pendentes.delete(id);
        }
        s.livros.put(livro);
        s.capas.put({ id, blob: capa });
        s.arquivos.put({ id, blob: arquivo });
        return livro;
      });
    },

    /** @returns {Promise<Livro[]>} */
    async listarLivros() {
      const todos = await transacao(db, ['livros'], 'readonly', (s) => pedido(s.livros.getAll()));
      return todos.sort((a, b) => {
        if (a.ultimaLeitura == null && b.ultimaLeitura != null) return 1;
        if (b.ultimaLeitura == null && a.ultimaLeitura != null) return -1;
        if (a.ultimaLeitura !== b.ultimaLeitura) return b.ultimaLeitura - a.ultimaLeitura;
        return b.adicionadoEm - a.adicionadoEm;
      });
    },

    obterLivro: (id) => ler('livros', id),
    async obterArquivo(id) { return (await ler('arquivos', id))?.blob ?? null; },
    async obterCapa(id) { return (await ler('capas', id))?.blob ?? null; },

    async renomearLivro(id, titulo) {
      const limpo = String(titulo ?? '').trim();
      if (!limpo) throw new TypeError('O nome não pode ficar vazio.');
      return transacao(db, ['livros'], 'readwrite', async (s) => {
        const livro = await pedido(s.livros.get(id));
        if (!livro) throw new Error('Livro não encontrado.');
        livro.titulo = limpo;
        s.livros.put(livro);
        return livro;
      });
    },

    async removerLivro(id) {
      await transacao(db, ['livros', 'arquivos', 'capas', 'marcadores', 'marcas', 'pendentes'], 'readwrite', async (s) => {
        s.livros.delete(id);
        s.arquivos.delete(id);
        s.capas.delete(id);
        s.pendentes.delete(id);
        for (const store of [s.marcadores, s.marcas]) {
          for (const item of await porLivro(store, id)) store.delete(item.id);
        }
      });
    },

    async salvarProgresso(id, { pagina, posicao }, agora = Date.now()) {
      await transacao(db, ['livros'], 'readwrite', async (s) => {
        const livro = await pedido(s.livros.get(id));
        if (!livro) return;
        livro.pagina = Math.min(Math.max(1, Math.round(pagina)), livro.paginas);
        livro.posicao = Math.min(Math.max(0, posicao ?? 0), 1);
        livro.ultimaLeitura = agora;
        s.livros.put(livro);
      });
    },

    /**
     * Grava o progresso de um livro já conhecido numa única ida ao banco, sem ler antes.
     * Usado ao fechar/esconder a página, quando não há tempo para duas idas.
     */
    salvarProgressoRapido(livro, agora = Date.now()) {
      const registro = {
        ...livro,
        pagina: Math.min(Math.max(1, Math.round(livro.pagina)), livro.paginas),
        posicao: Math.min(Math.max(0, livro.posicao ?? 0), 1),
        ultimaLeitura: agora,
      };
      const tx = db.transaction(['livros'], 'readwrite');
      tx.objectStore('livros').put(registro);
      const fim = new Promise((ok, falha) => {
        tx.oncomplete = () => ok(registro);
        tx.onabort = tx.onerror = () => falha(tx.error);
      });
      tx.commit?.();
      return fim;
    },

    async ultimoLido() {
      const lista = await this.listarLivros();
      return lista.find((l) => l.ultimaLeitura != null) ?? null;
    },

    async adicionarMarcador(livroId, pagina, nome = '') {
      /** @type {Marcador} */
      const m = { id: crypto.randomUUID(), livroId, pagina, nome: String(nome ?? '').trim(), criadoEm: Date.now() };
      await transacao(db, ['marcadores'], 'readwrite', (s) => { s.marcadores.put(m); });
      return m;
    },
    async listarMarcadores(livroId) {
      const lista = await transacao(db, ['marcadores'], 'readonly', (s) => porLivro(s.marcadores, livroId));
      return lista.sort((a, b) => a.pagina - b.pagina || a.criadoEm - b.criadoEm);
    },
    async removerMarcador(id) {
      await transacao(db, ['marcadores'], 'readwrite', (s) => { s.marcadores.delete(id); });
    },

    async adicionarMarca(livroId, { pagina, rects, texto }) {
      /** @type {Marca} */
      const m = { id: crypto.randomUUID(), livroId, pagina, rects, texto, criadoEm: Date.now() };
      await transacao(db, ['marcas'], 'readwrite', (s) => { s.marcas.put(m); });
      return m;
    },
    async listarMarcas(livroId) {
      const lista = await transacao(db, ['marcas'], 'readonly', (s) => porLivro(s.marcas, livroId));
      return lista.sort((a, b) => a.pagina - b.pagina || (a.rects[0]?.y ?? 0) - (b.rects[0]?.y ?? 0));
    },
    async removerMarca(id) {
      await transacao(db, ['marcas'], 'readwrite', (s) => { s.marcas.delete(id); });
    },

    async espacoUsado() {
      if (!globalThis.navigator?.storage?.estimate) return null;
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      return { usado: usage, cota: quota };
    },

    /** Progresso, marcadores e marcas (sem PDFs nem capas). */
    async exportarDados(agora = Date.now()) {
      return transacao(db, ['livros', 'marcadores', 'marcas'], 'readonly', async (s) => ({
        app: 'estante', versao: 1, exportadoEm: agora,
        livros: (await pedido(s.livros.getAll())).map(({ id, titulo, pagina, posicao, ultimaLeitura }) => ({ id, titulo, pagina, posicao, ultimaLeitura })),
        marcadores: await pedido(s.marcadores.getAll()),
        marcas: await pedido(s.marcas.getAll()),
      }));
    },

    /** Junta um backup com o que existe. Livros ausentes viram pendentes até o PDF ser adicionado. */
    async importarDados(obj) {
      validarBackup(obj);
      return transacao(db, ['livros', 'pendentes', 'marcadores', 'marcas'], 'readwrite', async (s) => {
        const naEstante = await pedido(s.livros.getAll());
        const pendentes = await pedido(s.pendentes.getAll());
        const atual = {
          livros: [...naEstante, ...pendentes],
          marcadores: await pedido(s.marcadores.getAll()),
          marcas: await pedido(s.marcas.getAll()),
        };
        const { novos } = mesclar(atual, obj);
        const ids = new Set(naEstante.map((l) => l.id));
        for (const l of novos.livros) {
          if (ids.has(l.id)) {
            const livro = naEstante.find((x) => x.id === l.id);
            Object.assign(livro, { pagina: Math.min(Math.max(1, l.pagina), livro.paginas), posicao: l.posicao, ultimaLeitura: l.ultimaLeitura });
            s.livros.put(livro);
          } else {
            s.pendentes.put(l);
          }
        }
        for (const m of novos.marcadores) s.marcadores.put(m);
        for (const m of novos.marcas) s.marcas.put(m);
        return { livros: novos.livros.length, marcadores: novos.marcadores.length, marcas: novos.marcas.length };
      });
    },

    // Usados pelo backup e pelos testes.
    _gravarPendente(p) { return transacao(db, ['pendentes'], 'readwrite', (s) => { s.pendentes.put(p); }); },
    _lerPendente: (id) => ler('pendentes', id),
    _db: db,
  };
}
