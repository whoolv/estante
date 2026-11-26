import { describe, it, expect } from 'vitest';
import { encontrarOcorrencias } from '../../js/leitor/busca-logica.js';

describe('encontrarOcorrencias', () => {
  it('acha com e sem acento, em ordem', () => {
    expect(encontrarOcorrencias(['a casa', 'a estante', 'Estânte e estante'], 'estante')).toEqual([
      { pagina: 2, inicio: 2 }, { pagina: 3, inicio: 0 }, { pagina: 3, inicio: 10 },
    ]);
  });
  it('termo curto não busca', () => {
    expect(encontrarOcorrencias(['eeee'], 'e')).toEqual([]);
    expect(encontrarOcorrencias(['eeee'], '  e ')).toEqual([]);
  });
  it('termo com acento acha sem acento', () => {
    expect(encontrarOcorrencias(['a pagina'], 'Página')).toEqual([{ pagina: 1, inicio: 2 }]);
  });
  it('ocorrências não se sobrepõem', () => {
    expect(encontrarOcorrencias(['aaaa'], 'aa')).toEqual([{ pagina: 1, inicio: 0 }, { pagina: 1, inicio: 2 }]);
  });
});
