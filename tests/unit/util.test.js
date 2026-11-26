import { describe, it, expect } from 'vitest';
import { hashArquivo } from '../../js/util/hash.js';
import { tempoRelativo } from '../../js/util/tempo.js';
import { percentualLido, tituloInicial } from '../../js/util/livro.js';

describe('hashArquivo', () => {
  it('calcula o SHA-256 em hex', async () => {
    const dados = new TextEncoder().encode('abc').buffer;
    expect(await hashArquivo(dados)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('aceita Blob', async () => {
    expect(await hashArquivo(new Blob(['abc']))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('tempoRelativo', () => {
  const agora = new Date(2026, 10, 26, 15, 0).getTime();
  const em = (...a) => new Date(...a).getTime();
  it('hoje', () => expect(tempoRelativo(em(2026, 10, 26, 9, 0), agora)).toBe('hoje'));
  it('ontem', () => expect(tempoRelativo(em(2026, 10, 25, 23, 0), agora)).toBe('ontem'));
  it('há 3 dias', () => expect(tempoRelativo(em(2026, 10, 23, 12, 0), agora)).toBe('há 3 dias'));
  it('há 1 semana', () => expect(tempoRelativo(em(2026, 10, 19, 12, 0), agora)).toBe('há 1 semana'));
  it('há 3 semanas', () => expect(tempoRelativo(em(2026, 10, 5, 12, 0), agora)).toBe('há 3 semanas'));
  it('data a partir de 30 dias', () => expect(tempoRelativo(em(2026, 9, 20, 12, 0), agora)).toBe('20/10/2026'));
});

describe('percentualLido', () => {
  it('25% na página 50 de 200', () => expect(percentualLido({ paginas: 200, pagina: 50, ultimaLeitura: 1 })).toBe(25));
  it('0% se nunca aberto', () => expect(percentualLido({ paginas: 200, pagina: 1, ultimaLeitura: null })).toBe(0));
  it('100% na última página', () => expect(percentualLido({ paginas: 10, pagina: 10, ultimaLeitura: 1 })).toBe(100));
});

describe('tituloInicial', () => {
  it('nome do arquivo quando não há título', () =>
    expect(tituloInicial(null, 'Redes_de_Computadores_e_a_Internet_Uma_Abordagem_Top_Down_James.pdf'))
      .toBe('Redes de Computadores e a Internet Uma Abordagem Top Down James'));
  it('usa título dos metadados aparado', () => expect(tituloInicial('  Livro de Teste ', 'x.pdf')).toBe('Livro de Teste'));
  it('ignora título genérico', () => expect(tituloInicial('untitled', 'meu-livro.PDF')).toBe('meu livro'));
  it('título vazio', () => expect(tituloInicial('', 'a.pdf')).toBe('a'));
});
