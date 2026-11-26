// Limite de pixels por canvas: acima disso o celular (principalmente o iPhone) deixa páginas em branco.
export const MAX_PIXELS_CANVAS = 2 ** 22; // 4 milhões de pixels, 16 MB por canvas

/** Densidade (pixels por px de CSS) para desenhar uma página de largura x altura sem passar do limite. */
export function densidadeDoCanvas(largura, altura, dprTela, maximo = MAX_PIXELS_CANVAS) {
  const d = Math.min(dprTela || 1, 2);
  const area = largura * altura;
  if (!area || area * d * d <= maximo) return d;
  return Math.sqrt(maximo / area);
}
