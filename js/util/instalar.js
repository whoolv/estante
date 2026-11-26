// Decide como oferecer a instalação do app neste aparelho.

let convite = null; // evento beforeinstallprompt guardado (Android e computador)

/** Guarda o convite de instalação do navegador assim que ele chega (chamado cedo, no app.js). */
export function escutarConvite() {
  addEventListener('beforeinstallprompt', (ev) => {
    ev.preventDefault();
    convite = ev;
    dispatchEvent(new Event('estante:convite'));
  });
  addEventListener('appinstalled', () => {
    convite = null;
    try { localStorage.setItem('estante:instalado', '1'); } catch { /* ignora */ }
    dispatchEvent(new Event('estante:convite'));
  });
}

export const temConvite = () => convite !== null;

/** Abre o convite do navegador. Devolve true se a pessoa aceitou. */
export async function usarConvite() {
  const c = convite;
  if (!c) return false;
  convite = null;
  await c.prompt();
  const escolha = await c.userChoice.catch(() => null);
  const aceitou = escolha?.outcome === 'accepted';
  if (aceitou) { try { localStorage.setItem('estante:instalado', '1'); } catch { /* ignora */ } }
  dispatchEvent(new Event('estante:convite'));
  return aceitou;
}

/** 'prompt' (o navegador instala), 'ios' (passo a passo do Compartilhar), 'menu' (pelo menu do navegador) ou null. */
export function comoInstalar({ ua = '', plataforma = '', toques = 0, standalone = false, instalado = false, temPrompt = false, janelaNotebook = false }) {
  if (standalone || instalado || janelaNotebook) return null;
  if (temPrompt) return 'prompt';
  if (/iPad|iPhone|iPod/.test(ua) || (plataforma === 'MacIntel' && toques > 1)) return 'ios';
  if (/Android|Mobi/i.test(ua)) return 'menu';
  return null;
}

/** Lê o ambiente real do navegador. */
export function ambienteAtual(temPrompt = false) {
  const standalone = globalThis.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  let instalado = false;
  try { instalado = localStorage.getItem('estante:instalado') === '1'; } catch { /* ignora */ }
  return {
    ua: navigator.userAgent, plataforma: navigator.platform, toques: navigator.maxTouchPoints || 0,
    standalone, instalado, temPrompt, janelaNotebook: location.port === '47821',
  };
}
