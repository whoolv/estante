// Marca-texto: selecionar um trecho e marcar; os destaques ficam guardados por livro.
import { normalizarRetangulos } from '../util/retangulos.js';
import { el } from './icones.js';

export async function instalarMarcaTexto(ctx) {
  const { livro, repo, visualizador, rolagem, raiz, painel, anunciar } = ctx;

  let marcas = await repo.listarMarcas(livro.id);

  // Botão flutuante único: "Marcar" para uma seleção ou "Remover marca" para um destaque tocado.
  const flutuante = el('button', { type: 'button', className: 'botao primario flutuante' });
  flutuante.hidden = true;
  raiz.append(flutuante);
  let acao = null;

  function esconder() { flutuante.hidden = true; acao = null; }
  function mostrarPerto(retangulo, texto, fn) {
    flutuante.textContent = texto;
    acao = fn;
    flutuante.hidden = false;
    const largura = flutuante.offsetWidth;
    const x = Math.min(Math.max(8, retangulo.left + retangulo.width / 2 - largura / 2), innerWidth - largura - 8);
    const abaixo = retangulo.bottom + 10 + 48 < innerHeight;
    const y = abaixo ? retangulo.bottom + 10 : Math.max(8, retangulo.top - 58);
    flutuante.style.left = `${x}px`;
    flutuante.style.top = `${y}px`;
  }
  flutuante.addEventListener('pointerdown', (ev) => ev.preventDefault()); // não perde a seleção
  flutuante.addEventListener('click', async () => { const fn = acao; esconder(); await fn?.(); });

  function desenhar(n) {
    const div = visualizador.elementoDaPagina(n);
    const camada = div?.querySelector('.camada-marcas');
    if (!camada) return;
    camada.replaceChildren(...marcas.filter((m) => m.pagina === n).flatMap((m) => m.rects.map((r) => {
      const d = el('div', { className: 'marca' });
      d.dataset.id = m.id;
      Object.assign(d.style, { left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` });
      return d;
    })));
  }
  const desenharTudo = () => { for (const n of visualizador.renderizadas()) desenhar(n); };

  async function recarregar() {
    marcas = await repo.listarMarcas(livro.id);
    desenharTudo();
  }

  const paginaDe = (no) => (no instanceof Element ? no : no?.parentElement)?.closest('.pagina');

  /** Lê a seleção atual: página, retângulos e texto (só a parte da primeira página). */
  function lerSelecao() {
    const sel = getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    const inicio = paginaDe(range.startContainer);
    if (!inicio || !rolagem.contains(inicio)) return null;
    const fim = paginaDe(range.endContainer);
    let cruzou = false;
    const parcial = range.cloneRange();
    if (fim !== inicio) {
      cruzou = true;
      const camada = inicio.querySelector('.textLayer');
      parcial.setEnd(camada, camada.childNodes.length);
    }
    const texto = parcial.toString().replace(/\s+/g, ' ').trim();
    if (!texto) return null;
    const rects = normalizarRetangulos([...parcial.getClientRects()], inicio.getBoundingClientRect());
    if (!rects.length) return null;
    return { pagina: Number(inicio.dataset.pagina), rects, texto, cruzou, caixa: parcial.getBoundingClientRect() };
  }

  async function marcarSelecao() {
    const s = lerSelecao();
    if (!s) return;
    await repo.adicionarMarca(livro.id, { pagina: s.pagina, rects: s.rects, texto: s.texto });
    getSelection().removeAllRanges();
    await recarregar();
    await painel?.recarregarMarcas();
    anunciar(s.cruzou ? 'Marque um trecho por página. Só a primeira parte foi marcada.' : 'Trecho marcado.');
  }

  let espera = 0;
  const aoMudarSelecao = () => {
    clearTimeout(espera);
    espera = setTimeout(() => {
      if (ctx.semTexto) return;
      const s = lerSelecao();
      if (s) mostrarPerto(s.caixa, 'Marcar', marcarSelecao);
      else if (acao === marcarSelecao) esconder();
    }, 120);
  };
  document.addEventListener('selectionchange', aoMudarSelecao);

  // Tocar/clicar num destaque (sem selecionar) oferece removê-lo.
  const aoClicar = (ev) => {
    if (getSelection()?.isCollapsed === false) return;
    const pagina = ev.target.closest?.('.pagina');
    if (!pagina) { if (acao && acao !== marcarSelecao) esconder(); return; }
    const caixa = pagina.getBoundingClientRect();
    const px = (ev.clientX - caixa.left) / caixa.width;
    const py = (ev.clientY - caixa.top) / caixa.height;
    const n = Number(pagina.dataset.pagina);
    const tocada = marcas.find((m) => m.pagina === n && m.rects.some((r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h));
    if (!tocada) { if (acao && acao !== marcarSelecao) esconder(); return; }
    ev.preventDefault(); // o toque foi no trecho marcado: não vira a página
    mostrarPerto({ left: ev.clientX, top: ev.clientY, width: 0, bottom: ev.clientY }, 'Remover marca', async () => {
      await repo.removerMarca(tocada.id);
      await recarregar();
      await painel?.recarregarMarcas();
      anunciar('Trecho desmarcado.');
    });
  };
  rolagem.addEventListener('click', aoClicar);

  // Atalho: M marca a seleção atual.
  const atalho = (ev) => {
    if (ev.key.toLowerCase() !== 'm' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.target instanceof HTMLElement && ev.target.matches('input, textarea')) return;
    if (lerSelecao()) { ev.preventDefault(); marcarSelecao(); }
  };
  document.addEventListener('keydown', atalho);

  const aoRenderizar = (ev) => desenhar(ev.detail.pagina);
  rolagem.addEventListener('pagina-renderizada', aoRenderizar);
  const aoRolar = () => { if (acao && acao !== marcarSelecao) esconder(); };
  rolagem.addEventListener('scroll', aoRolar, { passive: true });
  raiz.addEventListener('marcas-mudaram', recarregar);

  desenharTudo();

  return () => {
    clearTimeout(espera);
    document.removeEventListener('selectionchange', aoMudarSelecao);
    document.removeEventListener('keydown', atalho);
    rolagem.removeEventListener('pagina-renderizada', aoRenderizar);
    rolagem.removeEventListener('click', aoClicar);
    rolagem.removeEventListener('scroll', aoRolar);
    raiz.removeEventListener('marcas-mudaram', recarregar);
    flutuante.remove();
  };
}
