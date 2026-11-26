import { describe, it, expect } from 'vitest';
import { densidadeDoCanvas, MAX_PIXELS_CANVAS } from '../../js/util/canvas.js';

describe('densidadeDoCanvas', () => {
  it('usa a densidade da tela quando cabe no limite', () => {
    expect(densidadeDoCanvas(400, 600, 2)).toBe(2);
    expect(densidadeDoCanvas(400, 600, 1)).toBe(1);
  });
  it('nunca passa de 2', () => {
    expect(densidadeDoCanvas(100, 100, 3)).toBe(2);
  });
  it('reduz a densidade para o canvas caber no limite de pixels', () => {
    const d = densidadeDoCanvas(3000, 4243, 2);
    expect(d).toBeLessThan(2);
    expect(Math.floor(3000 * d) * Math.floor(4243 * d)).toBeLessThanOrEqual(MAX_PIXELS_CANVAS);
  });
  it('celular com zoom 3 fica bem abaixo do limite do iOS', () => {
    const d = densidadeDoCanvas(343 * 3, 485 * 3, 2);
    expect(Math.floor(1029 * d) * Math.floor(1455 * d)).toBeLessThanOrEqual(MAX_PIXELS_CANVAS);
  });
  it('limite é de 2^22 pixels (16 MB por canvas)', () => {
    expect(MAX_PIXELS_CANVAS).toBe(4194304);
  });
});
