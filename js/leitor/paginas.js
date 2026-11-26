// Mostra as páginas do PDF em rolagem contínua ou uma por vez (modo página), renderizando só as que estão perto da tela.
import { pdfjs } from '../pdf/pdf.js';
import { densidadeDoCanvas, limiteDePixels } from '../util/canvas.js';

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
  const limitePixels = limiteDePixels({ ua: navigator.userAgent, plataforma: navigator.platform, toques: navigator.maxTouchPoints || 0 });
  let atual = { pagina: 1, posicao: 0 };
  const renderizadas = new Map(); // n -> {tarefa, camada}

  const trilho = document.createElement('div');
  trilho.className = 'paginas';
  const elementos = [];
  for (let n = 1; n <= total; n++) {
    const div = document.createElement('div');
    div.className = 'pagina';
    div.dataset.pagina = String(n);
    div.setAttribute('role', 'group');
    div.setAttribute('aria-label', `Página ${n}`);
    trilho.append(div);
    elementos.push(div);
  }
  container.replaceChildren(trilho);

  const proporcaoDe = (n) => proporcoes.get(n) ?? proporcaoPadrao;
  // Rolagem: todas as páginas com a mesma largura ("ajustar à largura").
  const larguraRolagem = () => Math.round(Math.max(200, Math.min(container.clientWidth - MARGEM * 2, LARGURA_MAX)) * zoom);
  // Modo página: cada página cabe inteira na tela, conforme o formato dela.
  const larguraDe = (n) => {
    if (!emPagina()) return larguraRolagem();
    const porAltura = (container.clientHeight - MARGEM * 2) / proporcaoDe(n);
    return Math.round(Math.max(120, Math.min(container.clientWidth - MARGEM * 2, porAltura)) * zoom);
  };
  const folgaDe = (n) => (emPagina() ? Math.max(0, (container.clientWidth - larguraDe(n)) / 2) : 0);

  function ajustarElemento(n) {
    const el = elementos[n - 1];
    const w = larguraDe(n);
    el.style.height = `${Math.round(w * proporcaoDe(n))}px`;
    if (emPagina()) {
      el.style.width = `${w}px`;
      el.style.marginLeft = el.style.marginRight = `${folgaDe(n)}px`;
    } else {
      el.style.width = el.style.marginLeft = el.style.marginRight = '';
    }
  }

  function dimensionar() {
    trilho.style.setProperty('--largura', `${larguraRolagem()}px`);
    container.classList.toggle('modo-pagina', emPagina());
    for (let n = 1; n <= total; n++) ajustarElemento(n);
  }

  function liberar(n) {
    const r = renderizadas.get(n);
    if (!r) return;
    r.tarefa?.cancel();
    r.camadaTexto?.cancel?.();
    renderizadas.delete(n);
    // zera o canvas antes de tirar da página: o Safari só devolve a memória assim
    for (const c of elementos[n - 1].querySelectorAll('canvas')) { c.width = 0; c.height = 0; }
    r.pagina?.cleanup(); // devolve a memória que o PDF.js guarda da página
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
      registro.pagina = pagina;
      if (renderizadas.get(n) !== registro) { pagina.cleanup(); return; }
      const v1 = pagina.getViewport({ scale: 1 });
      const prop = v1.height / v1.width;
      if (prop !== proporcoes.get(n)) {
        proporcoes.set(n, prop);
        ajustarElemento(n);
      }
      const viewport = pagina.getViewport({ scale: larguraDe(n) / (v1.width || base.width) });
      const dpr = densidadeDoCanvas(viewport.width, viewport.height, window.devicePixelRatio, limitePixels);
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
        if (elementos[meio].offsetLeft - folgaDe(meio + 1) <= meioTela) lo = meio; else hi = meio - 1;
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
      const esquerda = el.offsetLeft - folgaDe(n);
      // (mexer só no scrollTop aqui cancelaria a animação: vai tudo num scrollTo só)
      if (suave && !reduzirMovimento()) {
        alvo = n;
        clearTimeout(fimAlvo);
        fimAlvo = setTimeout(() => { alvo = null; atualizar(); }, 1200); // se um arraste interromper a animação
        container.scrollTo({ left: esquerda, top: 0, behavior: 'smooth' });
      } else { alvo = null; container.scrollTop = 0; container.scrollLeft = esquerda; }
      // a página nova já conta como atual (a animação termina sozinha)
      for (let k = Math.max(1, n - RENDER_RAIO); k <= Math.min(total, n + RENDER_RAIO); k++) renderizar(k);
      if (n !== atual.pagina) { atual = { pagina: n, posicao: 0 }; aoMudarPagina?.(n, 0); }
      if (!suave) atualizar();
      return;
    }
    alvo = null;
    clearTimeout(fimAlvo);
    container.scrollTop = el.offsetTop + posicao * (el.offsetHeight + ESPACO);
    atualizar();
  }

  // Modo página: toque nas bordas e roda do mouse viram a página
  const virar = (delta) => irPara(atual.pagina + delta, 0, { suave: true });
  const temSelecao = () => String(globalThis.getSelection?.() ?? '').trim() !== '';
  let selecaoNoToque = false;
  let toquePendente = 0;
  const aoApertar = () => { selecaoNoToque = temSelecao(); };
  const aoClicar = (ev) => {
    clearTimeout(toquePendente);
    if (!emPagina() || ev.button !== 0 || ev.detail > 1) return;
    if (selecaoNoToque || temSelecao()) return; // o clique só desfez uma seleção
    if (ev.target instanceof Element && ev.target.closest('button, a, input, .flutuante')) return;
    const caixa = container.getBoundingClientRect();
    const x = (ev.clientX - caixa.left) / caixa.width;
    const delta = x < 0.3 ? -1 : x > 0.7 ? 1 : 0;
    if (!delta) return;
    // Espera um instante: duplo clique (selecionar palavra) ou toque num trecho marcado não viram a página.
    toquePendente = setTimeout(() => {
      if (ev.defaultPrevented || temSelecao()) return;
      virar(delta);
    }, 260);
  };
  const aoDuploClique = () => clearTimeout(toquePendente);
  let ultimoGiro = 0;
  const aoRodar = (ev) => {
    if (!emPagina() || ev.ctrlKey || Math.abs(ev.deltaY) <= Math.abs(ev.deltaX)) return;
    const el = elementos[atual.pagina - 1];
    if (el.offsetHeight + MARGEM * 2 > container.clientHeight + 2) return; // página maior que a tela (zoom): a roda rola
    ev.preventDefault();
    // Um gesto (inclusive a inércia do touchpad) vira só uma página: precisa de uma pausa antes do próximo.
    const agora = Date.now();
    const parado = agora - ultimoGiro > 250;
    ultimoGiro = agora;
    if (parado) virar(ev.deltaY > 0 ? 1 : -1);
  };
  container.addEventListener('pointerdown', aoApertar);
  container.addEventListener('click', aoClicar);
  container.addEventListener('dblclick', aoDuploClique);
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
      container.dispatchEvent(new CustomEvent('zoom-mudou'));
    },
    zoom: () => zoom,
    modo: () => modo,
    definirModo(m) {
      const novo = m === 'pagina' ? 'pagina' : 'rolagem';
      if (novo === modo) return;
      modo = novo;
      zoom = 1;
      refazer();
      container.dispatchEvent(new CustomEvent('zoom-mudou'));
    },
    elementoDaPagina: (n) => elementos[n - 1],
    renderizadas: () => [...renderizadas.keys()].filter((n) => elementos[n - 1].dataset.renderizada),
    destruir() {
      observador.disconnect();
      container.removeEventListener('scroll', aoRolar);
      container.removeEventListener('pointerdown', aoApertar);
      container.removeEventListener('click', aoClicar);
      container.removeEventListener('dblclick', aoDuploClique);
      clearTimeout(toquePendente);
      container.removeEventListener('wheel', aoRodar);
      container.classList.remove('modo-pagina');
      cancelAnimationFrame(quadro);
      clearTimeout(fimAlvo);
      for (const n of [...renderizadas.keys()]) liberar(n);
    },
  };
}
