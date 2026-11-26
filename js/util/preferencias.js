// Preferências de leitura (modo e tema), guardadas neste aparelho.
const CHAVE = 'estante:leitura';
export const MODOS = ['rolagem', 'pagina'];
export const TEMAS = ['original', 'sepia', 'escuro', 'preto'];
export const PADRAO = Object.freeze({ modo: 'rolagem', tema: 'original' });

function normalizar(p) {
  return {
    modo: MODOS.includes(p?.modo) ? p.modo : PADRAO.modo,
    tema: TEMAS.includes(p?.tema) ? p.tema : PADRAO.tema,
  };
}

export function lerPreferencias(armazenamento = globalThis.localStorage) {
  try { return normalizar(JSON.parse(armazenamento?.getItem(CHAVE) ?? 'null')); } catch { return { ...PADRAO }; }
}

export function salvarPreferencias(p, armazenamento = globalThis.localStorage) {
  const n = normalizar(p);
  try { armazenamento?.setItem(CHAVE, JSON.stringify(n)); } catch { /* sem armazenamento: vale só agora */ }
  return n;
}
