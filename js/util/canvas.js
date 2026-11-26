// Limite de pixels por canvas: acima disso o celular (principalmente o iPhone) deixa páginas em branco.
export const MAX_PIXELS_CANVAS = 2 ** 22; // 4 milhões de pixels, 16 MB por canvas (limite do iPhone/iPad)
const MAX_PIXELS_OUTROS = 2 ** 24;          // nos outros aparelhos dá para ter zoom nítido

/** Limite de pixels por canvas para este aparelho. */
export function limiteDePixels({ ua = '', plataforma = '', toques = 0 } = {}) {
  const ios = /iPad|iPhone|iPod/.test(ua) || (plataforma === 'MacIntel' && toques > 1);
  return ios ? MAX_PIXELS_CANVAS : MAX_PIXELS_OUTROS;
}

/** Densidade (pixels por px de CSS) para desenhar uma página de largura x altura sem passar do limite. */
export function densidadeDoCanvas(largura, altura, dprTela, maximo = MAX_PIXELS_CANVAS) {
  const d = Math.min(dprTela || 1, 2);
  const area = largura * altura;
  if (!area || area * d * d <= maximo) return d;
  return Math.sqrt(maximo / area);
}
