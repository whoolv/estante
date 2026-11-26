import 'fake-indexeddb/auto';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { abrirRepositorio, ErroLivroRepetido, ErroSemEspaco } from '../../js/dados/repositorio.js';

let n = 0;
const novoRepo = () => abrirRepositorio(`teste-${++n}`);
const livro = (id, extra = {}) => ({
  id, titulo: `Livro ${id}`, paginas: 10, arquivoNome: `${id}.pdf`,
  arquivo: new Blob(['%PDF-' + id]), capa: new Blob(['capa']), ...extra,
});

afterEach(() => vi.restoreAllMocks());

describe('repositório', () => {
  it('adiciona e lista um livro', async () => {
    const repo = await novoRepo();
    await repo.adicionarLivro(livro('A'));
    const lista = await repo.listarLivros();
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ id: 'A', pagina: 1, posicao: 0, ultimaLeitura: null, titulo: 'Livro A' });
    expect((await repo.obterArquivo('A')).size).toBe(6);
    expect(await repo.obterCapa('A')).toBeInstanceOf(Blob);
  });

  it('recusa livro repetido', async () => {
    const repo = await novoRepo();
    await repo.adicionarLivro(livro('A'));
    await expect(repo.adicionarLivro(livro('A'))).rejects.toBeInstanceOf(ErroLivroRepetido);
  });

  it('ordena por última leitura', async () => {
    const repo = await novoRepo();
    for (const id of ['A', 'B', 'C']) await repo.adicionarLivro(livro(id));
    await repo.salvarProgresso('A', { pagina: 2, posicao: 0 }, 100);
    await repo.salvarProgresso('C', { pagina: 2, posicao: 0 }, 200);
    expect((await repo.listarLivros()).map((l) => l.id)).toEqual(['C', 'A', 'B']);
  });

  it('salva progresso e ultimoLido', async () => {
    const repo = await novoRepo();
    await repo.adicionarLivro(livro('A'));
    await repo.adicionarLivro(livro('B'));
    expect(await repo.ultimoLido()).toBeNull();
    await repo.salvarProgresso('A', { pagina: 5, posicao: 0.3 }, 100);
    expect(await repo.obterLivro('A')).toMatchObject({ pagina: 5, posicao: 0.3, ultimaLeitura: 100 });
    expect((await repo.ultimoLido()).id).toBe('A');
  });

  it('renomeia aparando espaços', async () => {
    const repo = await novoRepo();
    await repo.adicionarLivro(livro('A'));
    expect((await repo.renomearLivro('A', '  Novo nome ')).titulo).toBe('Novo nome');
    expect((await repo.obterLivro('A')).titulo).toBe('Novo nome');
  });

  it('renomear vazio lança', async () => {
    const repo = await novoRepo();
    await repo.adicionarLivro(livro('A'));
    await expect(repo.renomearLivro('A', '   ')).rejects.toBeInstanceOf(TypeError);
  });

  it('remover apaga tudo do livro', async () => {
    const repo = await novoRepo();
    await repo.adicionarLivro(livro('A'));
    await repo.adicionarLivro(livro('B'));
    await repo.adicionarMarcador('A', 3, 'x');
    await repo.adicionarMarca('A', { pagina: 2, rects: [{ x: 0, y: 0, w: 1, h: 1 }], texto: 't' });
    await repo.adicionarMarcador('B', 1);
    await repo.removerLivro('A');
    expect(await repo.obterLivro('A')).toBeNull();
    expect(await repo.obterArquivo('A')).toBeNull();
    expect(await repo.obterCapa('A')).toBeNull();
    expect(await repo.listarMarcadores('A')).toEqual([]);
    expect(await repo.listarMarcas('A')).toEqual([]);
    expect(await repo.listarMarcadores('B')).toHaveLength(1);
  });

  it('marcadores e marcas ordenados', async () => {
    const repo = await novoRepo();
    await repo.adicionarLivro(livro('A'));
    await repo.adicionarMarcador('A', 9, 'nove');
    const m = await repo.adicionarMarcador('A', 2);
    expect(m).toMatchObject({ livroId: 'A', pagina: 2, nome: '' });
    expect((await repo.listarMarcadores('A')).map((x) => x.pagina)).toEqual([2, 9]);
    await repo.adicionarMarca('A', { pagina: 4, rects: [{ x: 0, y: 0.5, w: 1, h: 0.1 }], texto: 'b' });
    await repo.adicionarMarca('A', { pagina: 4, rects: [{ x: 0, y: 0.1, w: 1, h: 0.1 }], texto: 'a' });
    await repo.adicionarMarca('A', { pagina: 1, rects: [{ x: 0, y: 0.9, w: 1, h: 0.1 }], texto: 'c' });
    expect((await repo.listarMarcas('A')).map((x) => x.texto)).toEqual(['c', 'a', 'b']);
    await repo.removerMarcador(m.id);
    expect(await repo.listarMarcadores('A')).toHaveLength(1);
  });

  it('falta de espaço não deixa registro pela metade', async () => {
    const repo = await novoRepo();
    const original = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (...args) {
      if (this.name === 'arquivos') throw new DOMException('cheio', 'QuotaExceededError');
      return original.apply(this, args);
    });
    await expect(repo.adicionarLivro(livro('A'))).rejects.toBeInstanceOf(ErroSemEspaco);
    vi.restoreAllMocks();
    expect(await repo.listarLivros()).toEqual([]);
    expect(await repo.obterCapa('A')).toBeNull();
  });

  it('pendente é aplicado ao adicionar', async () => {
    const repo = await novoRepo();
    await repo._gravarPendente({ id: 'A', titulo: 'Meu', pagina: 7, posicao: 0, ultimaLeitura: 50 });
    const l = await repo.adicionarLivro(livro('A'));
    expect(l).toMatchObject({ titulo: 'Meu', pagina: 7, ultimaLeitura: 50 });
    expect(await repo._lerPendente('A')).toBeNull();
  });

  it('salvarProgressoRapido grava na hora, sem esperar leitura', async () => {
    const repo = await novoRepo();
    const l = await repo.adicionarLivro(livro('A'));
    const put = vi.spyOn(IDBObjectStore.prototype, 'put');
    const promessa = repo.salvarProgressoRapido({ ...l, pagina: 6, posicao: 0.25 }, 300);
    expect(put).toHaveBeenCalledTimes(1);
    await promessa;
    vi.restoreAllMocks();
    expect(await repo.obterLivro('A')).toMatchObject({ pagina: 6, posicao: 0.25, ultimaLeitura: 300 });
  });
});
