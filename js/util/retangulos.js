/** @typedef {{x:number,y:number,w:number,h:number}} Retangulo  (0..1 relativo à página) */

const MINIMO = 0.002;
const MESMA_LINHA = 0.005;
const VAO = 0.01;

const limitar = (v) => Math.min(1, Math.max(0, v));

/**
 * Converte retângulos da tela (getClientRects) para frações da página, cortando o que sai dela,
 * descartando os minúsculos e juntando os pedaços vizinhos da mesma linha.
 * @returns {Retangulo[]} ordenados de cima para baixo, da esquerda para a direita
 */
export function normalizarRetangulos(rects, pagina) {
  const relativos = [];
  for (const r of rects) {
    const x1 = limitar((r.left - pagina.left) / pagina.width);
    const y1 = limitar((r.top - pagina.top) / pagina.height);
    const x2 = limitar((r.left + r.width - pagina.left) / pagina.width);
    const y2 = limitar((r.top + r.height - pagina.top) / pagina.height);
    const w = x2 - x1;
    const h = y2 - y1;
    if (w < MINIMO || h < MINIMO) continue;
    relativos.push({ x: x1, y: y1, w, h });
  }
  relativos.sort((a, b) => a.y - b.y || a.x - b.x);

  const juntos = [];
  for (const r of relativos) {
    const anterior = juntos.find((j) => Math.abs(j.y - r.y) < MESMA_LINHA && Math.abs(j.h - r.h) < MESMA_LINHA
      && r.x <= j.x + j.w + VAO && r.x + r.w >= j.x - VAO);
    if (anterior) {
      const x = Math.min(anterior.x, r.x);
      const fim = Math.max(anterior.x + anterior.w, r.x + r.w);
      const y = Math.min(anterior.y, r.y);
      const base = Math.max(anterior.y + anterior.h, r.y + r.h);
      Object.assign(anterior, { x, y, w: fim - x, h: base - y });
    } else {
      juntos.push({ ...r });
    }
  }
  return juntos.sort((a, b) => a.y - b.y || a.x - b.x);
}
