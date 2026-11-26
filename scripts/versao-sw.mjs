// Dá ao cache do service worker um nome que muda sempre que algum arquivo do app muda.
// Uso: npm run versao-sw (rode antes de cada commit que mexe no app; um teste confere).
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export function listaDoSw(fonte = readFileSync('sw.js', 'utf8')) {
  return JSON.parse(fonte.match(/const ARQUIVOS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
}

export function versaoDosArquivos(lista) {
  const h = createHash('sha256');
  for (const a of [...lista].filter((x) => x !== './').sort()) {
    h.update(a);
    h.update(readFileSync(a));
  }
  return `estante-${h.digest('hex').slice(0, 12)}`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const fonte = readFileSync('sw.js', 'utf8');
  const versao = versaoDosArquivos(listaDoSw(fonte));
  writeFileSync('sw.js', fonte.replace(/const VERSAO = '[^']+'/, `const VERSAO = '${versao}'`));
  console.log(versao);
}
