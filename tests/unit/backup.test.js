import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { validarBackup, mesclar, ErroBackupInvalido } from '../../js/dados/backup.js';
import { abrirRepositorio } from '../../js/dados/repositorio.js';

let n = 0;
const novoRepo = () => abrirRepositorio(`backup-${++n}`);
const livro = (id) => ({ id, titulo: `Livro ${id}`, paginas: 50, arquivoNome: `${id}.pdf`, arquivo: new Blob(['%PDF']), capa: new Blob(['c']) });
const vazio = { livros: [], marcadores: [], marcas: [] };

describe('validarBackup', () => {
  it('rejeita arquivo de outro app', () => {
    expect(() => validarBackup({ app: 'outro', versao: 1, livros: [], marcadores: [], marcas: [] })).toThrow(ErroBackupInvalido);
    expect(() => validarBackup({ app: 'estante', versao: 2, livros: [], marcadores: [], marcas: [] })).toThrow(ErroBackupInvalido);
    expect(() => validarBackup({ app: 'estante', versao: 1, livros: [] })).toThrow(ErroBackupInvalido);
    expect(() => validarBackup(null)).toThrow(ErroBackupInvalido);
    expect(() => validarBackup({ app: 'estante', versao: 1, livros: [], marcadores: [], marcas: [] })).not.toThrow();
  });
});

describe('mesclar', () => {
  const l = (pagina, ultimaLeitura, titulo = 'T') => ({ id: 'A', titulo, pagina, posicao: 0, ultimaLeitura });
  it('progresso mais recente vence', () => {
    expect(mesclar({ ...vazio, livros: [l(10, 100, 'Local')] }, { ...vazio, livros: [l(30, 200, 'Outro')] }).livros[0])
      .toMatchObject({ pagina: 30, titulo: 'Local' });
    expect(mesclar({ ...vazio, livros: [l(10, 200)] }, { ...vazio, livros: [l(30, 100)] }).livros[0].pagina).toBe(10);
    expect(mesclar({ ...vazio, livros: [l(10, null)] }, { ...vazio, livros: [l(30, 5)] }).livros[0].pagina).toBe(30);
  });
  it('não duplica marcadores iguais', () => {
    const m = { id: '1', livroId: 'A', pagina: 3, nome: 'x', criadoEm: 1 };
    const r = mesclar({ ...vazio, marcadores: [m] }, { ...vazio, marcadores: [{ ...m, id: '2' }, { ...m, id: '3', pagina: 4 }] });
    expect(r.marcadores.map((x) => x.pagina).sort()).toEqual([3, 4]);
  });
  it('não duplica marcas iguais', () => {
    const m = { id: '1', livroId: 'A', pagina: 3, texto: 'oi', rects: [{ x: 0, y: 0, w: 1, h: 1 }], criadoEm: 1 };
    expect(mesclar({ ...vazio, marcas: [m] }, { ...vazio, marcas: [{ ...m, id: '9' }] }).marcas).toHaveLength(1);
  });
});

describe('exportar e importar', () => {
  it('ida e volta', async () => {
    const origem = await novoRepo();
    await origem.adicionarLivro(livro('A'));
    await origem.salvarProgresso('A', { pagina: 12, posicao: 0.5 }, 1000);
    await origem.adicionarMarcador('A', 4, 'Fórmula');
    await origem.adicionarMarcador('A', 8);
    await origem.adicionarMarca('A', { pagina: 2, rects: [{ x: 0, y: 0, w: 1, h: 0.1 }], texto: 'trecho' });
    const dados = await origem.exportarDados(5);
    expect(dados).toMatchObject({ app: 'estante', versao: 1, exportadoEm: 5 });
    expect(JSON.stringify(dados)).not.toContain('PDF');

    const destino = await novoRepo();
    const r = await destino.importarDados(JSON.parse(JSON.stringify(dados)));
    expect(r).toEqual({ livros: 1, marcadores: 2, marcas: 1 });
    expect(await destino.listarLivros()).toEqual([]);
    const l = await destino.adicionarLivro(livro('A'));
    expect(l).toMatchObject({ pagina: 12, posicao: 0.5, ultimaLeitura: 1000 });
    expect(await destino.listarMarcadores('A')).toHaveLength(2);
    expect(await destino.listarMarcas('A')).toHaveLength(1);

    const deNovo = await destino.importarDados(dados);
    expect(deNovo).toEqual({ livros: 0, marcadores: 0, marcas: 0 });
  });

  it('importar atualiza progresso de livro existente se for mais recente', async () => {
    const repo = await novoRepo();
    await repo.adicionarLivro(livro('A'));
    await repo.salvarProgresso('A', { pagina: 3, posicao: 0 }, 100);
    await repo.importarDados({ app: 'estante', versao: 1, exportadoEm: 1, livros: [{ id: 'A', titulo: 'X', pagina: 20, posicao: 0, ultimaLeitura: 500 }], marcadores: [], marcas: [] });
    expect(await repo.obterLivro('A')).toMatchObject({ pagina: 20, titulo: 'Livro A' });
  });

  it('exportar inclui o progresso de livros que ainda não voltaram para a estante', async () => {
    const repo = await novoRepo();
    await repo.adicionarLivro(livro('A'));
    await repo.importarDados({ app: 'estante', versao: 1, exportadoEm: 1, livros: [{ id: 'P', titulo: 'Pendente', pagina: 77, posicao: 0.5, ultimaLeitura: 900 }], marcadores: [], marcas: [] });
    const dados = await repo.exportarDados(5);
    expect(dados.livros.map((l) => l.id).sort()).toEqual(['A', 'P']);
    expect(dados.livros.find((l) => l.id === 'P')).toEqual({ id: 'P', titulo: 'Pendente', pagina: 77, posicao: 0.5, ultimaLeitura: 900 });
  });

  it('importar arquivo inválido lança', async () => {
    const repo = await novoRepo();
    await expect(repo.importarDados({ foo: 1 })).rejects.toBeInstanceOf(ErroBackupInvalido);
  });
});
