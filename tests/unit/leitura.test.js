import { describe, it, expect } from 'vitest';
import { lerPreferencias, salvarPreferencias, PADRAO } from '../../js/util/preferencias.js';
import { limparTituloSumario, achatarSumario } from '../../js/util/texto.js';
import { tituloInicial, tituloPareceArquivo, tituloCorrigido } from '../../js/util/livro.js';
import { limiteDePixels, MAX_PIXELS_CANVAS } from '../../js/util/canvas.js';
import { comoInstalar } from '../../js/util/instalar.js';

const memoria = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

describe('preferências de leitura', () => {
  it('padrão é rolagem com o tema original', () => {
    expect(PADRAO).toEqual({ modo: 'rolagem', tema: 'original' });
    expect(lerPreferencias(memoria())).toEqual(PADRAO);
  });
  it('guarda e lê de volta', () => {
    const a = memoria();
    salvarPreferencias({ modo: 'pagina', tema: 'sepia' }, a);
    expect(lerPreferencias(a)).toEqual({ modo: 'pagina', tema: 'sepia' });
  });
  it('ignora valores desconhecidos ou estragados', () => {
    const a = memoria();
    a.setItem('estante:leitura', '{"modo":"voar","tema":"preto"}');
    expect(lerPreferencias(a)).toEqual({ modo: 'rolagem', tema: 'preto' });
    a.setItem('estante:leitura', '{quebrado');
    expect(lerPreferencias(a)).toEqual(PADRAO);
  });
  it('funciona sem armazenamento', () => {
    const quebrado = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
    expect(lerPreferencias(quebrado)).toEqual(PADRAO);
    expect(salvarPreferencias({ modo: 'pagina', tema: 'escuro' }, quebrado)).toEqual({ modo: 'pagina', tema: 'escuro' });
  });
});

describe('títulos do sumário', () => {
  it('tira caracteres embaralhados de um título em português', () => {
    expect(limparTituloSumario('Capítulo 1 – Depois da enchente □恷剔娳)')).toBe('Capítulo 1 – Depois da enchente');
    expect(limparTituloSumario('Capítulo 2 – Depois do festival □\n忿㲉)')).toBe('Capítulo 2 – Depois do festival');
  });
  it('mantém títulos normais e títulos só em outra escrita', () => {
    expect(limparTituloSumario('1.1 O que é a Internet?')).toBe('1.1 O que é a Internet?');
    expect(limparTituloSumario('第一章')).toBe('第一章');
    expect(limparTituloSumario('Apêndice (opcional)')).toBe('Apêndice (opcional)');
  });
  it('achatarSumario já devolve os títulos limpos', () => {
    expect(achatarSumario([{ title: 'Parte 1 \u0000�', items: [] }])[0].titulo).toBe('Parte 1');
  });
});

describe('título que parece nome de arquivo', () => {
  it('reconhece nomes de arquivo de diagramação e de editor de texto', () => {
    for (const t of ['Kurose_menor.indb', 'livro final.indd', 'capa.pdf', 'Microsoft Word - tese.docx', 'cap1.qxd']) expect(tituloPareceArquivo(t), t).toBe(true);
    for (const t of ['It: A coisa', 'Estatística aplicada 6ª ed.', 'O Programador Pragmático']) expect(tituloPareceArquivo(t), t).toBe(false);
  });
  it('usa o nome do arquivo quando o título interno é nome de arquivo', () => {
    expect(tituloInicial('Kurose_menor.indb', 'Redes de Computadores - Kurose.pdf')).toBe('Redes de Computadores Kurose');
  });
});

describe('como instalar', () => {
  const base = { ua: 'Mozilla/5.0 (Linux; Android 14) Chrome/130', plataforma: 'Linux', toques: 5, standalone: false, instalado: false, temPrompt: false, janelaNotebook: false };
  it('Android com convite do navegador: botão que instala', () => {
    expect(comoInstalar({ ...base, temPrompt: true })).toBe('prompt');
  });
  it('Android sem convite: mostra o caminho pelo menu', () => {
    expect(comoInstalar(base)).toBe('menu');
  });
  it('iPhone e iPad no Safari: passo a passo do Compartilhar', () => {
    expect(comoInstalar({ ...base, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari' })).toBe('ios');
    expect(comoInstalar({ ...base, ua: 'Mozilla/5.0 (Macintosh) Safari', plataforma: 'MacIntel', toques: 5 })).toBe('ios');
  });
  it('já instalado ou na janela do notebook: nada', () => {
    expect(comoInstalar({ ...base, temPrompt: true, standalone: true })).toBe(null);
    expect(comoInstalar({ ...base, instalado: true })).toBe(null);
    expect(comoInstalar({ ...base, janelaNotebook: true })).toBe(null);
  });
  it('computador sem convite: nada (o navegador mostra o ícone na barra)', () => {
    expect(comoInstalar({ ...base, ua: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130', plataforma: 'Win32', toques: 0 })).toBe(null);
    expect(comoInstalar({ ...base, ua: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130', plataforma: 'Win32', toques: 0, temPrompt: true })).toBe('prompt');
  });
});

describe('revisão: sumário não estraga títulos de verdade', () => {
  it('mantém títulos que misturam escritas', () => {
    expect(limparTituloSumario('Chapter 1 はじめに')).toBe('Chapter 1 はじめに');
    expect(limparTituloSumario('TCP/IP 协议')).toBe('TCP/IP 协议');
    expect(limparTituloSumario('Python 프로그래밍')).toBe('Python 프로그래밍');
  });
  it('mantém listas com parêntese', () => {
    expect(limparTituloSumario('a) Introdução')).toBe('a) Introdução');
    expect(limparTituloSumario('1) Conceitos')).toBe('1) Conceitos');
    expect(limparTituloSumario('Intervalo [0, 1)')).toBe('Intervalo [0, 1)');
  });
});

describe('revisão: correção de títulos de arquivo', () => {
  it('usa o nome do arquivo quando ele diz algo', () => {
    expect(tituloCorrigido('Kurose_menor.indb', 'Redes de Computadores - Kurose.pdf')).toBe('Redes de Computadores Kurose');
  });
  it('com nome de arquivo genérico, só tira a extensão do título antigo', () => {
    expect(tituloCorrigido('Kurose_menor.indb', 'download (3).pdf')).toBe('Kurose menor');
    expect(tituloCorrigido('Kurose_menor.indb', '3f9a0c1d2e4b5a6f7c8d.pdf')).toBe('Kurose menor');
  });
  it('não mexe em título que não parece arquivo', () => {
    expect(tituloCorrigido('It: A coisa', 'it.pdf')).toBe(null);
  });
});

describe('revisão: limite de pixels', () => {
  it('iPhone e iPad usam o limite menor; os outros, um maior', () => {
    expect(limiteDePixels({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', plataforma: 'iPhone', toques: 5 })).toBe(MAX_PIXELS_CANVAS);
    expect(limiteDePixels({ ua: 'Mozilla/5.0 (Macintosh)', plataforma: 'MacIntel', toques: 5 })).toBe(MAX_PIXELS_CANVAS);
    expect(limiteDePixels({ ua: 'Mozilla/5.0 (Windows NT 10.0)', plataforma: 'Win32', toques: 0 })).toBe(2 ** 24);
    expect(limiteDePixels({ ua: 'Mozilla/5.0 (Linux; Android 14)', plataforma: 'Linux', toques: 5 })).toBe(2 ** 24);
  });
});

describe('revisão: instalar', () => {
  const base = { ua: 'Mozilla/5.0 (Linux; Android 14) Chrome/130', plataforma: 'Linux', toques: 5, standalone: false, instalado: false, temPrompt: false, janelaNotebook: false };
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15';
  it('o convite do navegador vale mesmo com a marca de já instalado (app foi desinstalado)', () => {
    expect(comoInstalar({ ...base, instalado: true, temPrompt: true })).toBe('prompt');
  });
  it('Chrome ou Firefox no iPhone têm outro caminho; navegador de app manda abrir no Safari', () => {
    expect(comoInstalar({ ...base, ua: `${iphone} CriOS/130 Mobile Safari` })).toBe('ios-outro');
    expect(comoInstalar({ ...base, ua: `${iphone} FxiOS/130 Mobile Safari` })).toBe('ios-outro');
    expect(comoInstalar({ ...base, ua: `${iphone} Mobile Instagram 300.0` })).toBe('abrir-no-navegador');
    expect(comoInstalar({ ...base, ua: `${iphone} Version/18.0 Mobile Safari/604.1` })).toBe('ios');
  });
});
