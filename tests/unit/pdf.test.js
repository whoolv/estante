import { describe, it, expect } from 'vitest';
import { achatarSumario, normalizarBusca } from '../../js/util/texto.js';

describe('achatarSumario', () => {
  it('achata em pré-ordem com nível', () => {
    const outline = [
      { title: 'A', dest: 'a', items: [{ title: 'A.1', dest: 'b', items: [] }] },
      { title: 'B', dest: 'c', items: [] },
    ];
    expect(achatarSumario(outline)).toEqual([
      { titulo: 'A', nivel: 0, dest: 'a' },
      { titulo: 'A.1', nivel: 1, dest: 'b' },
      { titulo: 'B', nivel: 0, dest: 'c' },
    ]);
  });
  it('sumário ausente vira lista vazia', () => expect(achatarSumario(null)).toEqual([]));
});

describe('normalizarBusca', () => {
  it('tira acento e caixa', () => expect(normalizarBusca('Estânte')).toBe('estante'));
});
