import { describe, it, expect } from 'vitest';
import { normalizarRetangulos } from '../../js/util/retangulos.js';

const pagina = { left: 0, top: 0, width: 600, height: 800 };
const r = (left, top, width, height) => ({ left, top, width, height });
const perto = (a, b) => {
  expect(a.length).toBe(b.length);
  a.forEach((x, i) => {
    for (const k of ['x', 'y', 'w', 'h']) expect(x[k]).toBeCloseTo(b[i][k], 4);
  });
};

describe('normalizarRetangulos', () => {
  it('converte para frações da página', () => {
    perto(normalizarRetangulos([r(60, 80, 300, 16)], pagina), [{ x: 0.1, y: 0.1, w: 0.5, h: 0.02 }]);
  });
  it('respeita o deslocamento da página na tela', () => {
    perto(normalizarRetangulos([r(160, 280, 300, 16)], { ...pagina, left: 100, top: 200 }), [{ x: 0.1, y: 0.1, w: 0.5, h: 0.02 }]);
  });
  it('junta retângulos lado a lado na mesma linha', () => {
    perto(normalizarRetangulos([r(60, 80, 100, 16), r(162, 80, 198, 16)], pagina), [{ x: 0.1, y: 0.1, w: 0.5, h: 0.02 }]);
  });
  it('mantém linhas diferentes separadas, em ordem', () => {
    const saida = normalizarRetangulos([r(60, 120, 100, 16), r(60, 80, 100, 16)], pagina);
    expect(saida).toHaveLength(2);
    expect(saida[0].y).toBeLessThan(saida[1].y);
  });
  it('descarta retângulos minúsculos', () => {
    expect(normalizarRetangulos([r(10, 10, 0.5, 0.5)], pagina)).toEqual([]);
  });
  it('corta o que sai da página', () => {
    perto(normalizarRetangulos([r(-60, 80, 120, 16)], pagina), [{ x: 0, y: 0.1, w: 0.1, h: 0.02 }]);
  });
});
