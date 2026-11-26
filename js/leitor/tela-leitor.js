// Tela de leitura: barra de cima, páginas e (nas próximas partes) painel, busca e marca-texto.
import { carregarPdf, temTexto } from '../pdf/pdf.js';
import { criarVisualizador, ZOOM_MIN, ZOOM_MAX } from './paginas.js';
import { avisarNaEstante } from '../estante/tela-estante.js';

const el = (tag, props = {}, ...filhos) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const f of filhos) if (f != null) e.append(f);
  return e;
};

const icone = (caminho) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('width', '20');
  s.setAttribute('height', '20');
  s.innerHTML = caminho;
  return s;
};
export const ICONES = {
  voltar: '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  menos: '<path d="M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  mais: '<path d="M6 12h12M12 6v12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  largura: '<path d="M4 12h16M7 9l-3 3 3 3M17 9l3 3-3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  painel: '<rect x="3.5" y="4.5" width="17" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.5 4.5v15" stroke="currentColor" stroke-width="1.8"/>',
  buscar: '<circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 20l-4.5-4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  marcador: '<path d="M7 4h10v16l-5-4-5 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  fechar: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
};
export { icone, el };

/**
 * Abre o livro `id` em `main`. Devolve a função de limpeza.
 * Extensões (painel, busca, marca-texto) entram por `extensoes` e recebem o contexto do leitor.
 */
export async function mostrarLeitor(main, repo, id) {
  const livro = await repo.obterLivro(id);
  const arquivo = livro && (await repo.obterArquivo(id));
  if (!livro || !arquivo) {
    avisarNaEstante('Livro não encontrado.');
    location.replace('#/');
    return () => {};
  }

  main.dataset.tela = 'leitor';
  delete main.dataset.pronta;

  const voltar = el('button', { type: 'button', className: 'botao-icone voltar' }, icone(ICONES.voltar), el('span', { className: 'rotulo-voltar', textContent: 'Estante' }));
  voltar.setAttribute('aria-label', 'Voltar para a estante');
  const titulo = el('h1', { className: 'titulo-livro', textContent: livro.titulo, title: livro.titulo });

  const campo = el('input', { type: 'number', className: 'campo-pagina', min: 1, max: livro.paginas, value: livro.pagina, inputMode: 'numeric' });
  campo.setAttribute('aria-label', 'Página atual');
  const navegacao = el('div', { className: 'navegacao' }, campo, el('span', { className: 'de-total', textContent: `de ${livro.paginas}` }));

  const botaoMenos = el('button', { type: 'button', className: 'botao-icone' }, icone(ICONES.menos));
  botaoMenos.setAttribute('aria-label', 'Diminuir zoom');
  const botaoMais = el('button', { type: 'button', className: 'botao-icone' }, icone(ICONES.mais));
  botaoMais.setAttribute('aria-label', 'Aumentar zoom');
  const valorZoom = el('output', { className: 'valor-zoom', textContent: '100%' });
  valorZoom.setAttribute('aria-label', 'Zoom');
  const botaoLargura = el('button', { type: 'button', className: 'botao-icone' }, icone(ICONES.largura));
  botaoLargura.setAttribute('aria-label', 'Ajustar à largura');
  botaoLargura.title = 'Ajustar à largura';
  const zoomGrupo = el('div', { className: 'grupo-zoom' }, botaoMenos, valorZoom, botaoMais, botaoLargura);
  zoomGrupo.setAttribute('role', 'group');
  zoomGrupo.setAttribute('aria-label', 'Zoom');

  const ferramentas = el('div', { className: 'ferramentas' });
  const barra = el('header', { className: 'barra-leitor' }, voltar, titulo, navegacao, zoomGrupo, ferramentas);
  const faixas = el('div', { className: 'faixas' });
  const rolagem = el('div', { className: 'rolagem', tabIndex: 0 });
  rolagem.setAttribute('aria-label', `Páginas de ${livro.titulo}`);
  const lateral = el('div', { className: 'lateral' });
  const corpo = el('div', { className: 'corpo-leitor' }, lateral, rolagem);
  const raiz = el('div', { className: 'leitor' }, barra, faixas, corpo);
  main.replaceChildren(raiz);

  let pdf;
  try {
    pdf = await carregarPdf(arquivo);
  } catch {
    avisarNaEstante(`Não foi possível abrir “${livro.titulo}”.`);
    location.replace('#/');
    return () => {};
  }

  // Progresso: salva com atraso enquanto rola e na hora ao sair/esconder a página.
  let pendente = null;
  let espera = 0;
  const salvarAgora = () => {
    clearTimeout(espera);
    if (!pendente) return;
    Object.assign(livro, pendente);
    pendente = null;
    repo.salvarProgressoRapido(livro).then((r) => { livro.ultimaLeitura = r.ultimaLeitura; }).catch(() => {});
  };
  const aoMudarPagina = (pagina, posicao) => {
    if (document.activeElement !== campo) campo.value = String(pagina);
    pendente = { pagina, posicao };
    clearTimeout(espera);
    espera = setTimeout(salvarAgora, 800);
    raiz.dispatchEvent(new CustomEvent('pagina-mudou', { detail: { pagina } }));
  };

  const vis = await criarVisualizador(rolagem, pdf, { aoMudarPagina });
  vis.irPara(livro.pagina, livro.posicao);
  campo.value = String(vis.paginaAtual().pagina);
  if (livro.ultimaLeitura == null) {
    pendente = vis.paginaAtual();
    salvarAgora();
  }

  const irPara = (n, pos = 0) => { vis.irPara(n, pos); pendente = vis.paginaAtual(); salvarAgora(); };

  campo.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      const n = Math.min(Math.max(1, parseInt(campo.value, 10) || 1), livro.paginas);
      campo.value = String(n);
      irPara(n);
    }
  });
  campo.addEventListener('blur', () => { campo.value = String(vis.paginaAtual().pagina); });

  const mostrarZoom = () => { valorZoom.textContent = `${Math.round(vis.zoom() * 100)}%`; };
  botaoMenos.addEventListener('click', () => { vis.definirZoom(Math.max(ZOOM_MIN, vis.zoom() - 0.1)); mostrarZoom(); });
  botaoMais.addEventListener('click', () => { vis.definirZoom(Math.min(ZOOM_MAX, vis.zoom() + 0.1)); mostrarZoom(); });
  botaoLargura.addEventListener('click', () => { vis.definirZoom('largura'); mostrarZoom(); });

  const sair = () => { salvarAgora(); location.hash = '#/'; };
  voltar.addEventListener('click', sair);

  // Esc fecha primeiro o que estiver aberto (painel, busca); só depois volta para a estante.
  const camadasEsc = [];
  const teclado = (ev) => {
    if (document.querySelector('dialog[open]')) return;
    const alvo = ev.target;
    const digitando = alvo instanceof HTMLElement && (alvo.matches('input, textarea, select') || alvo.isContentEditable);
    if (ev.key === 'Escape') {
      const topo = camadasEsc.at(-1);
      if (topo) { ev.preventDefault(); topo(); return; }
      if (!digitando) { ev.preventDefault(); sair(); }
      return;
    }
    if (digitando || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const { pagina } = vis.paginaAtual();
    if (ev.key === 'PageDown' || ev.key === 'ArrowRight') { ev.preventDefault(); irPara(pagina + 1); }
    else if (ev.key === 'PageUp' || ev.key === 'ArrowLeft') { ev.preventDefault(); irPara(pagina - 1); }
  };
  document.addEventListener('keydown', teclado);

  const aoEsconder = () => { if (document.visibilityState === 'hidden') salvarAgora(); };
  document.addEventListener('visibilitychange', aoEsconder);
  addEventListener('pagehide', salvarAgora);

  function faixa(texto) {
    const fechar = el('button', { type: 'button', className: 'botao-icone' }, icone(ICONES.fechar));
    fechar.setAttribute('aria-label', 'Fechar aviso');
    const f = el('div', { className: 'faixa' }, el('p', { textContent: texto }), fechar);
    f.setAttribute('role', 'status');
    fechar.addEventListener('click', () => { f.remove(); rolagem.focus(); });
    faixas.append(f);
  }

  const contexto = {
    livro, repo, pdf, visualizador: vis, raiz, barra, ferramentas, lateral, rolagem, faixa, irPara,
    pilhaEsc: {
      empilhar: (fn) => camadasEsc.push(fn),
      tirar: (fn) => { const i = camadasEsc.lastIndexOf(fn); if (i >= 0) camadasEsc.splice(i, 1); },
    },
    semTexto: false,
  };

  const limpezas = [];
  temTexto(pdf).then((ok) => {
    contexto.semTexto = !ok;
    if (!ok) faixa('Este PDF é só imagem: a busca e o marca-texto não funcionam nele.');
  });

  for (const extensao of extensoes) {
    try { const fim = await extensao(contexto); if (fim) limpezas.push(fim); } catch (e) { console.error(e); }
  }

  rolagem.focus({ preventScroll: true });
  main.dataset.pronta = 'leitor';

  return () => {
    salvarAgora();
    for (const fim of limpezas) { try { fim(); } catch { /* nada */ } }
    document.removeEventListener('keydown', teclado);
    document.removeEventListener('visibilitychange', aoEsconder);
    removeEventListener('pagehide', salvarAgora);
    vis.destruir();
    pdf.destroy();
    delete main.dataset.pronta;
  };
}

/** Partes do leitor que se registram aqui (painel, busca, marca-texto). */
const extensoes = [];
export function registrarExtensao(fn) { extensoes.push(fn); }
