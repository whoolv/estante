import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const fonte = readFileSync('sw.js', 'utf8');
const lista = JSON.parse(fonte.match(/const ARQUIVOS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));

const arquivosDe = (pasta) => readdirSync(pasta).flatMap((n) => {
  const p = join(pasta, n);
  return statSync(p).isDirectory() ? arquivosDe(p) : [p.replace(/\\/g, '/')];
});

describe('service worker', () => {
  it('todo arquivo da lista existe', () => {
    for (const a of lista) if (a !== './') expect(existsSync(a), a).toBe(true);
  });
  it('todo código e estilo do app está na lista', () => {
    const doApp = [...arquivosDe('js'), ...arquivosDe('css'), 'vendor/pdfjs/pdf.min.mjs', 'vendor/pdfjs/pdf.worker.min.mjs', 'index.html', 'manifest.webmanifest'];
    for (const a of doApp) expect(lista, a).toContain(a);
  });
  it('não guarda testes nem PDFs', () => {
    expect(lista.some((a) => a.startsWith('tests/') || a.endsWith('.pdf'))).toBe(false);
  });
});

import { versaoDosArquivos } from '../../scripts/versao-sw.mjs';

describe('atualização do service worker', () => {
  it('a versão do cache muda sempre que um arquivo do app muda', () => {
    const versao = fonte.match(/const VERSAO = '([^']+)'/)[1];
    expect(versao, 'rode: npm run versao-sw').toBe(versaoDosArquivos(lista));
  });
  it('baixa os arquivos sem passar pelo cache do navegador', () => {
    expect(fonte).toMatch(/cache: 'reload'/);
  });
  it('não troca arquivos soltos no cache durante o uso', () => {
    expect(fonte).not.toMatch(/cache\.put/);
  });
  it('versaoDosArquivos depende do conteúdo', () => {
    expect(versaoDosArquivos(['index.html'])).toMatch(/^estante-[0-9a-f]{12}$/);
    expect(versaoDosArquivos(['index.html'])).not.toBe(versaoDosArquivos(['index.html', 'css/base.css']));
  });
});
