// Gera os PNGs (e o .ico do notebook) a partir de icons/icone.svg, usando o navegador do Playwright.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const svg = readFileSync('icons/icone.svg', 'utf8');
// Versão "maskable": fundo cheio e desenho dentro dos 80% centrais.
const miolo = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<rect width="512" height="512" rx="112" fill="#141414"\/>/, '');
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#141414"/><g transform="translate(51.2 51.2) scale(.8)">${miolo}</g></svg>`;

const navegador = await chromium.launch({ channel: 'msedge' });
const pagina = await navegador.newPage();

async function png(conteudo, tamanho, destino, transparente = true) {
  await pagina.setViewportSize({ width: tamanho, height: tamanho });
  await pagina.setContent(`<html><body style="margin:0;background:transparent">${conteudo.replace('<svg ', `<svg width="${tamanho}" height="${tamanho}" `)}</body></html>`);
  const buf = await pagina.screenshot({ omitBackground: transparente, clip: { x: 0, y: 0, width: tamanho, height: tamanho } });
  if (destino) writeFileSync(destino, buf);
  return buf;
}

await png(svg, 192, 'icons/icone-192.png');
await png(svg, 512, 'icons/icone-512.png');
await png(maskable, 512, 'icons/icone-maskable-512.png', false);
await png(svg, 180, 'icons/apple-touch-icon.png');
copyFileSync('icons/icone.svg', 'icons/favicon.svg');

// .ico com PNGs embutidos (16, 32, 48, 256) para o atalho do Windows.
const tamanhos = [16, 32, 48, 256];
const imagens = [];
for (const t of tamanhos) imagens.push(await png(svg, t, null));
const cabecalho = Buffer.alloc(6 + 16 * imagens.length);
cabecalho.writeUInt16LE(0, 0);
cabecalho.writeUInt16LE(1, 2);
cabecalho.writeUInt16LE(imagens.length, 4);
let deslocamento = cabecalho.length;
imagens.forEach((img, i) => {
  const t = tamanhos[i];
  const p = 6 + 16 * i;
  cabecalho.writeUInt8(t === 256 ? 0 : t, p);
  cabecalho.writeUInt8(t === 256 ? 0 : t, p + 1);
  cabecalho.writeUInt8(0, p + 2);
  cabecalho.writeUInt8(0, p + 3);
  cabecalho.writeUInt16LE(1, p + 4);
  cabecalho.writeUInt16LE(32, p + 6);
  cabecalho.writeUInt32LE(img.length, p + 8);
  cabecalho.writeUInt32LE(deslocamento, p + 12);
  deslocamento += img.length;
});
writeFileSync('icons/estante.ico', Buffer.concat([cabecalho, ...imagens]));

await navegador.close();
console.log('Ícones gerados em icons/');
