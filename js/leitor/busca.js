// Busca dentro do livro: barra de busca, contador, próximo/anterior e destaque na página.
import { textoDaPagina } from '../pdf/pdf.js';
import { normalizarBusca } from '../util/texto.js';
import { encontrarOcorrencias } from './busca-logica.js';
import { el, icone, ICONES } from './icones.js';

const LOTE = 20;
const SETA_CIMA = '<path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
const SETA_BAIXO = '<path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';

export function instalarBusca(ctx) {
  const { pdf, visualizador, ferramentas, barra, rolagem, pilhaEsc, anunciar } = ctx;

  const botao = el('button', { type: 'button', className: 'botao-icone' }, icone(ICONES.buscar));
  botao.setAttribute('aria-label', 'Buscar no livro');
  botao.setAttribute('aria-expanded', 'false');
  botao.title = 'Buscar no livro (Ctrl+F)';
  ferramentas.prepend(botao);

  const campo = el('input', { type: 'search', className: 'campo-busca', placeholder: 'Buscar no livro', autocomplete: 'off', enterKeyHint: 'search' });
  campo.setAttribute('aria-label', 'Buscar no livro');
  const contador = el('output', { className: 'contador-busca' });
  const anterior = el('button', { type: 'button', className: 'botao-icone' }, icone(SETA_CIMA));
  anterior.setAttribute('aria-label', 'Resultado anterior');
  const proximo = el('button', { type: 'button', className: 'botao-icone' }, icone(SETA_BAIXO));
  proximo.setAttribute('aria-label', 'Próximo resultado');
  const fechar = el('button', { type: 'button', className: 'botao-icone' }, icone(ICONES.fechar));
  fechar.setAttribute('aria-label', 'Fechar busca');
  const barraBusca = el('div', { className: 'barra-busca' }, campo, contador, anterior, proximo, fechar);
  barraBusca.setAttribute('role', 'search');
  barraBusca.hidden = true;
  barra.after(barraBusca);

  let resultados = [];
  let indice = -1;
  let termoAtual = '';
  let geracao = 0;

  function limparDestaques() {
    for (const span of rolagem.querySelectorAll('.textLayer span[data-original]')) {
      span.textContent = span.dataset.original;
      delete span.dataset.original;
    }
  }

  /** Marca o termo dentro dos trechos de texto de uma página já desenhada. */
  function destacarPagina(n) {
    const camada = visualizador.elementoDaPagina(n)?.querySelector('.textLayer');
    if (!camada || !termoAtual) return;
    const alvo = normalizarBusca(termoAtual);
    const atualNaPagina = resultados[indice]?.pagina === n
      ? resultados.slice(0, indice).filter((r) => r.pagina === n).length : -1;
    let k = 0;
    for (const span of camada.querySelectorAll('span:not(.markedContent)')) {
      const original = span.dataset.original ?? span.textContent;
      const norm = normalizarBusca(original);
      if (!norm.includes(alvo)) continue;
      span.dataset.original = original;
      const partes = [];
      let de = 0;
      for (;;) {
        const i = norm.indexOf(alvo, de);
        if (i < 0) break;
        partes.push(document.createTextNode(original.slice(de, i)));
        const marca = el('mark', { className: 'achado', textContent: original.slice(i, i + alvo.length) });
        if (k === atualNaPagina) marca.classList.add('achado-atual');
        k++;
        partes.push(marca);
        de = i + alvo.length;
      }
      partes.push(document.createTextNode(original.slice(de)));
      span.replaceChildren(...partes);
    }
  }

  function destacarVisiveis() {
    limparDestaques();
    for (const n of visualizador.renderizadas()) destacarPagina(n);
  }

  function mostrar(i) {
    if (!resultados.length) return;
    indice = (i + resultados.length) % resultados.length;
    contador.textContent = `${indice + 1} de ${resultados.length}`;
    ctx.irPara(resultados[indice].pagina);
    destacarVisiveis();
  }

  async function buscar() {
    const termo = campo.value.trim();
    const minha = ++geracao;
    termoAtual = termo;
    resultados = [];
    indice = -1;
    limparDestaques();
    if (ctx.semTexto) {
      contador.textContent = 'Este PDF não tem texto para buscar.';
      anunciar(contador.textContent);
      return;
    }
    if (termo.length < 2) { contador.textContent = 'Digite pelo menos 2 letras'; return; }
    contador.textContent = 'Buscando…';
    const textos = [];
    for (let n = 1; n <= pdf.numPages; n += LOTE) {
      const fim = Math.min(pdf.numPages, n + LOTE - 1);
      const lote = await Promise.all(Array.from({ length: fim - n + 1 }, (_, j) => textoDaPagina(pdf, n + j)));
      if (minha !== geracao) return;
      textos.push(...lote);
      await new Promise((r) => setTimeout(r, 0));
    }
    resultados = encontrarOcorrencias(textos, termo);
    if (!resultados.length) {
      contador.textContent = 'Nenhum resultado';
      anunciar('Nenhum resultado');
      return;
    }
    anunciar(resultados.length === 1 ? '1 resultado' : `${resultados.length} resultados`);
    // Começa no primeiro resultado a partir da página atual.
    const { pagina } = visualizador.paginaAtual();
    const primeiro = resultados.findIndex((r) => r.pagina >= pagina);
    mostrar(primeiro >= 0 ? primeiro : 0);
  }

  const fecharPorEsc = () => fecharBusca();
  function abrirBusca() {
    if (barraBusca.hidden) {
      barraBusca.hidden = false;
      botao.setAttribute('aria-expanded', 'true');
      pilhaEsc.empilhar(fecharPorEsc);
    }
    campo.focus();
    campo.select();
  }
  function fecharBusca() {
    if (barraBusca.hidden) return;
    barraBusca.hidden = true;
    botao.setAttribute('aria-expanded', 'false');
    pilhaEsc.tirar(fecharPorEsc);
    geracao++;
    termoAtual = '';
    resultados = [];
    limparDestaques();
    contador.textContent = '';
    botao.focus();
  }

  botao.addEventListener('click', () => (barraBusca.hidden ? abrirBusca() : fecharBusca()));
  fechar.addEventListener('click', fecharBusca);
  campo.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      if (resultados.length && campo.value.trim() === termoAtual) mostrar(indice + (ev.shiftKey ? -1 : 1));
      else buscar();
    } else if (ev.key === 'ArrowDown') { ev.preventDefault(); mostrar(indice + 1); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); mostrar(indice - 1); }
  });
  anterior.addEventListener('click', () => mostrar(indice - 1));
  proximo.addEventListener('click', () => mostrar(indice + 1));

  const atalho = (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && ev.key.toLowerCase() === 'f') {
      if (document.querySelector('dialog[open]')) return;
      ev.preventDefault();
      abrirBusca();
    }
  };
  document.addEventListener('keydown', atalho);

  const aoRenderizar = (ev) => { if (termoAtual && resultados.length) destacarPagina(ev.detail.pagina); };
  rolagem.addEventListener('pagina-renderizada', aoRenderizar);

  return () => {
    document.removeEventListener('keydown', atalho);
    rolagem.removeEventListener('pagina-renderizada', aoRenderizar);
    pilhaEsc.tirar(fecharPorEsc);
  };
}
