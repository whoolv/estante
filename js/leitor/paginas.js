// Mostra as páginas do PDF em rolagem contínua ou uma por vez (modo página), renderizando só as que estão perto da tela.
import { pdfjs } from '../pdf/pdf.js';
import { densidadeDoCanvas } from '../util/canvas.js';

const MARGEM = 16;          // espaço lateral dentro da área de rolagem
const ESPACO = 14;          // espaço entre páginas (px)
const LARGURA_MAX = 1000;   // "ajustar à largura" não passa disso em telas grandes
const RENDER_RAIO = 2;      // renderiza a página atual ±2
const LIBERA_RAIO = 5;      // libera canvas além de ±5 (no máximo 11 canvas)
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;

/**
 * @param {HTMLElement} container  elemento com rolagem (overflow: auto)
 * @param {import('../pdf/pdf.js').pdfjs.PDFDocumentProxy} pdf
 * @param {{aoMudarPagina?: (pagina:number, posicao:number) => void, modo?: 'rolagem'|'pagina'}} opcoes
 */
export async function criarVisualizador(container, pdf, { aoMudarPagina, modo: modoInicial = 'rolagem' } = {}) {
  const total = pdf.numPages;
  const primeira = await pdf.getPage(1);
  const base = primeira.getViewport({ scale: 1 });
  const proporcoes = new Map([[1, base.height / base.width]]); // altura/largura conhecidas
  const proporcaoPadrao = base.height / base.width;

  let zoom = 1;               // multiplicador sobre "ajustar à largura"
  let modo = modoInicial;     // 'rolagem' ou 'pagina'
  const emPagina = () => modo === 'pagina';
  const reduzirMovimento = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let atual = { pagina: 1, posicao: 0 };
  const renderizadas = new Map(); // n -> {tarefa, camada}

  const trilho = document.createElement('div');
  trilho.className = 'paginas';
  const elementos = [];
  for (let n = 1; n <= total; n++) {
    const div = document.createElement('div');
    div.className = 'pagina';
    div.dataset.pagina = String(n);
    div.setAttribute('role', 'region');
    div.setAttribute('aria-label', `Página ${n}`);
    trilho.append(div);
    elementos.push(div);
  }
  container.replaceChildren(trilho);

  const larguraAjustada = () => {
    if (!emPagina()) return Math.max(200, Math.min(container.clientWidth - MARGEM * 2, LARGURA_MAX));
    // modo página: a página inteira cabe na tela
    const porAltura = (container.clientHeight - MARGEM * 2) / proporcaoPadrao;
    return Math.max(120, Math.min(container.clientWidth - MARGEM * 2, porAltura));
  };
  const folga = () => (emPagina() ? Math.max(0, (container.clientWidth - larguraPagina()) / 2) : 0);
  const larguraPagina = () => Math.round(larguraAjustada() * zoom);
  const escala = () => larguraPagina() / base.width;

  function dimensionar() {
    const w = larguraPagina();
    trilho.style.setProperty('--largura', `${w}px`);
    trilho.style.setProperty('--folga', `${folga()}px`);
    container.classList.toggle('modo-pagina', emPagina());
    for (let n = 1; n <= total; n++) {
      elementos[n - 1].style.height = `${Math.round(w * (proporcoes.get(n) ?? proporcaoPadrao))}px`;
    }
  }

  function liberar(n) {
    const r = renderizadas.get(n);
    if (!r) return;
    r.tarefa?.cancel();
    r.camadaTexto?.cancel?.();
    renderizadas.delete(n);
    // zera o canvas antes de tirar da página: o Safari só devolve a memória assim
    for (const c of elementos[n - 1].querySelectorAll('canvas')) { c.width = 0; c.height = 0; }
    elementos[n - 1].replaceChildren();
    delete elementos[n - 1].dataset.renderizada;
  }

  async function renderizar(n) {
    if (renderizadas.has(n)) return;
    const registro = {};
    renderizadas.set(n, registro);
    const div = elementos[n - 1];
    try {
      const pagina = await pdf.getPage(n);
      if (renderizadas.get(n) !== registro) return;
      const v1 = pagina.getViewport({ scale: 1 });
      const prop = v1.height / v1.width;
      if (prop !== proporcoes.get(n)) {
        proporcoes.set(n, prop);
        div.style.height = `${Math.round(larguraPagina() * prop)}px`;
      }
      const viewport = pagina.getViewport({ scale: escala() * (v1.width ? base.width / v1.width : 1) });
      const dpr = densidadeDoCanvas(viewport.width, viewport.height, window.devicePixelRatio);
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.setAttribute('aria-hidden', 'true');
      const camadaMarcas = document.createElement('div');
      camadaMarcas.className = 'camada-marcas';
      const camada = document.createElement('div');
      camada.className = 'camada-texto textLayer';
      camada.style.setProperty('--scale-factor', String(viewport.scale));
      div.replaceChildren(canvas, camadaMarcas, camada);

      registro.tarefa = pagina.render({
        canvasContext: canvas.getContext('2d'),
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      });
      await registro.tarefa.promise;
      if (renderizadas.get(n) !== registro) return;
      registro.camadaTexto = new pdfjs.TextLayer({ textContentSource: pagina.streamTextContent(), container: camada, viewport });
      await registro.camadaTexto.render();
      if (renderizadas.get(n) !== registro) return;
      div.dataset.renderizada = '1';
      container.dispatchEvent(new CustomEvent('pagina-renderizada', { detail: { pagina: n } }));
    } catch (e) {
      if (e?.name !== 'RenderingCancelledException' && e?.name !== 'AbortException') console.error(e);
      if (renderizadas.get(n) === registro) renderizadas.delete(n);
    }
  }

  /** Página cujo topo está mais perto do topo visível (busca binária sobre offsetTop). */
  function calcularAtual() {
    if (emPagina()) {
      const meioTela = container.scrollLeft + container.clientWidth / 2;
      let lo = 0;
      let hi = total - 1;
      while (lo < hi) {
        const meio = (lo + hi + 1) >> 1;
        if (elementos[meio].offsetLeft - folga() <= meioTela) lo = meio; else hi = meio - 1;
      }
      return { pagina: lo + 1, posicao: 0 };
    }
    const topo = container.scrollTop + 1;
    let lo = 0;
    let hi = total - 1;
    while (lo < hi) {
      const meio = (lo + hi + 1) >> 1;
      if (elementos[meio].offsetTop <= topo) lo = meio; else hi = meio - 1;
    }
    const el = elementos[lo];
    const posicao = Math.min(1, Math.max(0, (topo - el.offsetTop) / (el.offsetHeight + ESPACO)));
    return { pagina: lo + 1, posicao };
  }

  let alvo = null;       // página para onde a animação está indo (modo página)
  let fimAlvo = 0;
  function atualizar() {
    let novo = calcularAtual();
    if (alvo !== null) {
      // durante a animação a página atual continua sendo o destino
      if (novo.pagina === alvo) { alvo = null; clearTimeout(fimAlvo); } else novo = { pagina: alvo, posicao: 0 };
    }
    for (const n of [...renderizadas.keys()]) if (Math.abs(n - novo.pagina) > LIBERA_RAIO) liberar(n);
    for (let n = Math.max(1, novo.pagina - RENDER_RAIO); n <= Math.min(total, novo.pagina + RENDER_RAIO); n++) renderizar(n);
    const mudou = novo.pagina !== atual.pagina || Math.abs(novo.posicao - atual.posicao) > 0.001;
    atual = novo;
    if (mudou) aoMudarPagina?.(atual.pagina, atual.posicao);
  }

  let quadro = 0;
  const aoRolar = () => { if (!quadro) quadro = requestAnimationFrame(() => { quadro = 0; atualizar(); }); };
  container.addEventListener('scroll', aoRolar, { passive: true });

  function irPara(pagina, posicao = 0, { suave = false } = {}) {
    const n = Math.min(Math.max(1, Math.round(pagina) || 1), total);
    const el = elementos[n - 1];
    if (emPagina()) {
      const esquerda = el.offsetLeft - folga();
      // (mexer no scrollTop aqui cancelaria a animação)
      if (suave && !reduzirMovimento()) {
        alvo = n;
        clearTimeout(fimAlvo);
        fimAlvo = setTimeout(() => { alvo = null; atualizar(); }, 1200); // se um arraste interromper a animação
        container.scrollTo({ left: esquerda, behavior: 'smooth' });
      } else { alvo = null; container.scrollTop = 0; container.scrollLeft = esquerda; }
      // a página nova já conta como atual (a animação termina sozinha)
      for (let k = Math.max(1, n - RENDER_RAIO); k <= Math.min(total, n + RENDER_RAIO); k++) renderizar(k);
      if (n !== atual.pagina) { atual = { pagina: n, posicao: 0 }; aoMudarPagina?.(n, 0); }
      if (!suave) atualizar();
      return;
    }
    container.scrollTop = el.offsetTop + posicao * (el.offsetHeight + ESPACO);
    atualizar();
  }

  // Modo página: toque nas bordas e roda do mouse viram a página
  const virar = (delta) => irPara(atual.pagina + delta, 0, { suave: true });
  const aoClicar = (ev) => {
    if (!emPagina() || ev.button !== 0) return;
    if (String(globalThis.getSelection?.() ?? '').trim()) return;
    if (ev.target instanceof Element && ev.target.closest('button, a, input, .flutuante')) return;
    const caixa = container.getBoundingClientRect();
    const x = (ev.clientX - caixa.left) / caixa.width;
    if (x < 0.3) virar(-1);
    else if (x > 0.7) virar(1);
  };
  let ultimaRoda = 0;
  const aoRodar = (ev) => {
    if (!emPagina() || ev.ctrlKey || Math.abs(ev.deltaY) <= Math.abs(ev.deltaX)) return;
    if (container.scrollHeight > container.clientHeight + 2) return; // com zoom, a roda rola a página
    ev.preventDefault();
    const agora = Date.now();
    if (agora - ultimaRoda < 350) return;
    ultimaRoda = agora;
    virar(ev.deltaY > 0 ? 1 : -1);
  };
  container.addEventListener('click', aoClicar);
  container.addEventListener('wheel', aoRodar, { passive: false });

  function refazer() {
    const guardado = { ...atual };
    for (const n of [...renderizadas.keys()]) liberar(n);
    dimensionar();
    irPara(guardado.pagina, guardado.posicao);
  }

  let larguraAnterior = container.clientWidth;
  let alturaAnterior = container.clientHeight;
  const observador = new ResizeObserver(() => {
    const mudouLargura = Math.abs(container.clientWidth - larguraAnterior) >= 2;
    const mudouAltura = emPagina() && Math.abs(container.clientHeight - alturaAnterior) >= 2;
    larguraAnterior = container.clientWidth;
    alturaAnterior = container.clientHeight;
    if (mudouLargura || mudouAltura) refazer();
  });
  observador.observe(container);

  dimensionar();
  atualizar();

  return {
    irPara,
    paginaAtual: () => ({ ...atual }),
    total,
    definirZoom(z) {
      const novo = z === 'largura' ? 1 : Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 10) / 10));
      if (novo === zoom) return;
      zoom = novo;
      refazer();
    },
    zoom: () => zoom,
    modo: () => modo,
    definirModo(m) {
      const novo = m === 'pagina' ? 'pagina' : 'rolagem';
      if (novo === modo) return;
      modo = novo;
      zoom = 1;
      refazer();
    },
    elementoDaPagina: (n) => elementos[n - 1],
    renderizadas: () => [...renderizadas.keys()].filter((n) => elementos[n - 1].dataset.renderizada),
    destruir() {
      observador.disconnect();
      container.removeEventListener('scroll', aoRolar);
      container.removeEventListener('click', aoClicar);
      container.removeEventListener('wheel', aoRodar);
      container.classList.remove('modo-pagina');
      cancelAnimationFrame(quadro);
      clearTimeout(fimAlvo);
      for (const n of [...renderizadas.keys()]) liberar(n);
    },
  };
}
