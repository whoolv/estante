// Tudo que a Estante precisa do PDF.js passa por aqui.
import * as pdfjs from '../../vendor/pdfjs/pdf.min.mjs';
import { achatarSumario } from '../util/texto.js';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('../../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;

export { pdfjs };

export class ErroNaoEPdf extends Error {
  constructor() { super('O arquivo não é um PDF válido.'); this.name = 'ErroNaoEPdf'; }
}
export class ErroPdfComSenha extends Error {
  constructor() { super('O PDF tem senha.'); this.name = 'ErroPdfComSenha'; }
}

const textos = new WeakMap();

/** @param {Blob|ArrayBuffer} dados */
export async function carregarPdf(dados) {
  const buffer = dados instanceof Blob ? await dados.arrayBuffer() : dados;
  const bytes = new Uint8Array(buffer);
  const cabecalho = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  if (!cabecalho.includes('%PDF-')) throw new ErroNaoEPdf();
  try {
    return await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
  } catch (e) {
    if (e?.name === 'PasswordException') throw new ErroPdfComSenha();
    throw new ErroNaoEPdf();
  }
}

export async function lerInfo(pdf) {
  let tituloMeta = null;
  try {
    const meta = await pdf.getMetadata();
    tituloMeta = meta?.info?.Title ? String(meta.info.Title) : null;
  } catch { /* sem metadados */ }
  return { paginas: pdf.numPages, tituloMeta };
}

function canvasParaBlob(canvas) {
  return new Promise((ok) => canvas.toBlob((b) => {
    if (b && b.type === 'image/webp') ok(b);
    else canvas.toBlob(ok, 'image/png');
  }, 'image/webp', 0.85));
}

/** Primeira página como imagem pequena (capa da estante). */
export async function gerarCapa(pdf, largura = 240) {
  const pagina = await pdf.getPage(1);
  const base = pagina.getViewport({ scale: 1 });
  const viewport = pagina.getViewport({ scale: largura / base.width });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await pagina.render({ canvasContext: ctx, viewport }).promise;
  pagina.cleanup();
  return canvasParaBlob(canvas);
}

async function paginaDoDestino(pdf, dest) {
  try {
    const explicito = typeof dest === 'string' ? await pdf.getDestination(dest) : dest;
    if (!Array.isArray(explicito)) return null;
    const ref = explicito[0];
    const indice = typeof ref === 'number' ? ref : await pdf.getPageIndex(ref);
    return indice + 1;
  } catch {
    return null;
  }
}

/** Sumário do PDF com o número da página de cada item; itens sem destino são descartados. */
export async function lerSumario(pdf) {
  const itens = achatarSumario(await pdf.getOutline());
  const saida = [];
  for (const item of itens) {
    const pagina = await paginaDoDestino(pdf, item.dest);
    if (pagina) saida.push({ titulo: item.titulo || `Página ${pagina}`, nivel: item.nivel, pagina });
  }
  return saida;
}

export async function textoDaPagina(pdf, n) {
  let cache = textos.get(pdf);
  if (!cache) textos.set(pdf, (cache = new Map()));
  if (!cache.has(n)) {
    cache.set(n, pdf.getPage(n)
      .then((p) => p.getTextContent())
      .then((c) => c.items.map((i) => i.str).join(' ')));
  }
  return cache.get(n);
}

/** Há algum texto nas primeiras páginas? (PDF escaneado não tem.) */
export async function temTexto(pdf, amostra = 5) {
  for (let n = 1; n <= Math.min(amostra, pdf.numPages); n++) {
    if ((await textoDaPagina(pdf, n)).trim()) return true;
  }
  return false;
}
