// Painel do leitor: abas Sumário, Marcadores e Marca-texto.
// Em telas estreitas vira uma gaveta por cima da página; em telas largas fica ao lado.
import { lerSumario } from '../pdf/pdf.js';
import { el, icone, ICONES } from './icones.js';

const ESTREITA = '(max-width: 599px)';
const ABAS = [
  { id: 'sumario', nome: 'Sumário' },
  { id: 'marcadores', nome: 'Marcadores' },
  { id: 'marcas', nome: 'Marca-texto' },
];

export async function instalarPainel(ctx) {
  const { livro, repo, pdf, visualizador, ferramentas, lateral, raiz, pilhaEsc } = ctx;
  const estreita = matchMedia(ESTREITA);

  // Botões na barra
  const botaoPainel = el('button', { type: 'button', className: 'botao-icone' }, icone(ICONES.painel));
  botaoPainel.setAttribute('aria-label', 'Painel');
  botaoPainel.setAttribute('aria-expanded', 'false');
  botaoPainel.setAttribute('aria-controls', 'painel-leitor');
  botaoPainel.title = 'Sumário, marcadores e marca-texto';
  const botaoMarcar = el('button', { type: 'button', className: 'botao-icone marcar-rapido' }, icone(ICONES.marcador));
  ferramentas.append(botaoMarcar, botaoPainel);

  // Estrutura do painel
  const lista = el('div', { className: 'abas' });
  lista.setAttribute('role', 'tablist');
  lista.setAttribute('aria-label', 'Seções do painel');
  const fechar = el('button', { type: 'button', className: 'botao-icone fechar-painel' }, icone(ICONES.fechar));
  fechar.setAttribute('aria-label', 'Fechar painel');
  const abas = {};
  const paineis = {};
  for (const a of ABAS) {
    const aba = el('button', { type: 'button', className: 'aba', id: `aba-${a.id}`, textContent: a.nome });
    aba.setAttribute('role', 'tab');
    aba.setAttribute('aria-controls', `conteudo-${a.id}`);
    const conteudo = el('div', { className: 'conteudo-aba', id: `conteudo-${a.id}` });
    conteudo.setAttribute('role', 'tabpanel');
    conteudo.setAttribute('aria-labelledby', `aba-${a.id}`);
    abas[a.id] = aba;
    paineis[a.id] = conteudo;
    lista.append(aba);
  }
  const painel = el('aside', { className: 'painel', id: 'painel-leitor' },
    el('div', { className: 'cabeca-painel' }, lista, fechar),
    ...Object.values(paineis));
  painel.setAttribute('aria-label', 'Painel do livro');
  painel.hidden = true;
  const fundo = el('div', { className: 'fundo-gaveta' });
  fundo.hidden = true;
  lateral.append(painel);
  raiz.append(fundo);

  let abaAtual = 'sumario';
  function selecionar(id, focar = false) {
    abaAtual = id;
    for (const a of ABAS) {
      const ativa = a.id === id;
      abas[a.id].setAttribute('aria-selected', String(ativa));
      abas[a.id].tabIndex = ativa ? 0 : -1;
      paineis[a.id].hidden = !ativa;
    }
    if (focar) abas[id].focus();
    if (id === 'sumario') marcarAtualNoSumario();
  }
  lista.addEventListener('keydown', (ev) => {
    const i = ABAS.findIndex((a) => a.id === abaAtual);
    let j = null;
    if (ev.key === 'ArrowRight') j = (i + 1) % ABAS.length;
    else if (ev.key === 'ArrowLeft') j = (i - 1 + ABAS.length) % ABAS.length;
    else if (ev.key === 'Home') j = 0;
    else if (ev.key === 'End') j = ABAS.length - 1;
    if (j != null) { ev.preventDefault(); selecionar(ABAS[j].id, true); }
  });
  for (const a of ABAS) abas[a.id].addEventListener('click', () => selecionar(a.id));

  // Abrir / fechar
  const fecharPorEsc = () => fecharPainel(true);
  function abrirPainel(aba) {
    if (aba) selecionar(aba);
    if (!painel.hidden) { if (estreita.matches) abas[abaAtual].focus(); return; }
    painel.hidden = false;
    raiz.classList.add('painel-aberto');
    botaoPainel.setAttribute('aria-expanded', 'true');
    const gaveta = estreita.matches;
    painel.classList.toggle('gaveta', gaveta);
    fundo.hidden = !gaveta;
    if (gaveta) { painel.setAttribute('role', 'dialog'); painel.setAttribute('aria-modal', 'true'); }
    else { painel.removeAttribute('role'); painel.removeAttribute('aria-modal'); }
    pilhaEsc.empilhar(fecharPorEsc);
    abas[abaAtual].focus();
  }
  function fecharPainel(devolverFoco) {
    if (painel.hidden) return;
    painel.hidden = true;
    fundo.hidden = true;
    raiz.classList.remove('painel-aberto');
    botaoPainel.setAttribute('aria-expanded', 'false');
    pilhaEsc.tirar(fecharPorEsc);
    if (devolverFoco) botaoPainel.focus();
  }
  botaoPainel.addEventListener('click', () => (painel.hidden ? abrirPainel() : fecharPainel(true)));
  fechar.addEventListener('click', () => fecharPainel(true));
  fundo.addEventListener('click', () => fecharPainel(true));

  // Foco preso dentro da gaveta
  painel.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Tab' || !painel.classList.contains('gaveta')) return;
    const focaveis = [...painel.querySelectorAll('button, input, [tabindex="0"]')]
      .filter((e) => !e.disabled && e.offsetParent !== null && e.tabIndex >= 0);
    if (!focaveis.length) return;
    const primeiro = focaveis[0];
    const ultimo = focaveis.at(-1);
    if (ev.shiftKey && document.activeElement === primeiro) { ev.preventDefault(); ultimo.focus(); }
    else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primeiro.focus(); }
  });

  /** Ao escolher um destino: vai para a página e, na gaveta, fecha. */
  function irPara(pagina) {
    ctx.irPara(pagina);
    if (painel.classList.contains('gaveta')) fecharPainel(false);
  }

  // ---- Sumário ----
  const sumario = await lerSumario(pdf).catch(() => []);
  const listaSumario = el('ul', { className: 'lista-sumario' });
  const itensSumario = [];
  if (sumario.length) {
    for (const item of sumario) {
      const b = el('button', { type: 'button', className: 'item-lista', textContent: item.titulo });
      b.style.setProperty('--nivel', item.nivel);
      b.dataset.pagina = String(item.pagina);
      b.addEventListener('click', () => irPara(item.pagina));
      itensSumario.push(b);
      listaSumario.append(el('li', {}, b));
    }
  } else {
    paineis.sumario.append(el('p', { className: 'nota', textContent: 'Este PDF não tem sumário. Escolha uma página.' }));
    for (let n = 1; n <= livro.paginas; n++) {
      const b = el('button', { type: 'button', className: 'item-lista', textContent: `Página ${n}` });
      b.dataset.pagina = String(n);
      b.addEventListener('click', () => irPara(n));
      itensSumario.push(b);
      listaSumario.append(el('li', {}, b));
    }
  }
  paineis.sumario.append(listaSumario);

  function marcarAtualNoSumario() {
    const { pagina } = visualizador.paginaAtual();
    let atual = null;
    for (const b of itensSumario) {
      b.removeAttribute('aria-current');
      if (Number(b.dataset.pagina) <= pagina) atual = b;
    }
    if (atual) atual.setAttribute('aria-current', 'location');
  }

  // ---- Marcadores ----
  const nome = el('input', { type: 'text', maxLength: 120, placeholder: 'Ex.: fórmula da média', autocomplete: 'off' });
  nome.setAttribute('aria-label', 'Nome do marcador (opcional)');
  const botaoNovo = el('button', { type: 'submit', className: 'botao primario', textContent: 'Marcar esta página' });
  const form = el('form', { className: 'novo-marcador' }, nome, botaoNovo);
  const listaMarcadores = el('ul', { className: 'lista-marcadores' });
  const vazioMarcadores = el('p', { className: 'nota', textContent: 'Nenhum marcador ainda.' });
  paineis.marcadores.append(form, vazioMarcadores, listaMarcadores);

  let marcadores = [];
  async function recarregarMarcadores() {
    marcadores = await repo.listarMarcadores(livro.id);
    vazioMarcadores.hidden = marcadores.length > 0;
    listaMarcadores.replaceChildren(...marcadores.map((m) => {
      const ir = el('button', { type: 'button', className: 'item-lista item-marcador' },
        el('span', { className: 'item-pagina', textContent: `Página ${m.pagina}` }),
        m.nome ? el('span', { className: 'item-detalhe', textContent: m.nome }) : null);
      ir.setAttribute('aria-label', m.nome ? `Página ${m.pagina}, ${m.nome}` : `Página ${m.pagina}`);
      ir.addEventListener('click', () => irPara(m.pagina));
      const remover = el('button', { type: 'button', className: 'botao-icone' }, icone(ICONES.fechar));
      remover.setAttribute('aria-label', `Remover marcador da página ${m.pagina}`);
      remover.addEventListener('click', async () => {
        await repo.removerMarcador(m.id);
        await recarregarMarcadores();
        ctx.anunciar?.('Marcador removido.');
        (listaMarcadores.querySelector('button') ?? nome).focus();
      });
      return el('li', { className: 'linha-lista' }, ir, remover);
    }));
    atualizarBotaoMarcar();
  }

  function atualizarBotaoMarcar() {
    const { pagina } = visualizador.paginaAtual();
    const marcada = marcadores.some((m) => m.pagina === pagina);
    botaoMarcar.setAttribute('aria-pressed', String(marcada));
    botaoMarcar.setAttribute('aria-label', marcada ? 'Remover marcador desta página' : 'Marcar página');
    botaoMarcar.title = marcada ? 'Remover marcador desta página' : 'Marcar esta página';
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const { pagina } = visualizador.paginaAtual();
    await repo.adicionarMarcador(livro.id, pagina, nome.value);
    nome.value = '';
    await recarregarMarcadores();
    ctx.anunciar?.(`Página ${pagina} marcada.`);
  });

  botaoMarcar.addEventListener('click', async () => {
    const { pagina } = visualizador.paginaAtual();
    const daPagina = marcadores.filter((m) => m.pagina === pagina);
    if (daPagina.length) {
      for (const m of daPagina) await repo.removerMarcador(m.id);
      ctx.anunciar?.(`Marcador da página ${pagina} removido.`);
    } else {
      await repo.adicionarMarcador(livro.id, pagina);
      ctx.anunciar?.(`Página ${pagina} marcada.`);
    }
    await recarregarMarcadores();
  });

  // ---- Marca-texto (a lista; os destaques na página ficam em marca-texto.js) ----
  const listaMarcas = el('ul', { className: 'lista-marcas' });
  const vazioMarcas = el('p', { className: 'nota', textContent: 'Nenhum trecho marcado. Selecione um texto na página e toque em Marcar.' });
  paineis.marcas.append(vazioMarcas, listaMarcas);

  async function recarregarMarcas() {
    const marcas = await repo.listarMarcas(livro.id);
    vazioMarcas.hidden = marcas.length > 0;
    listaMarcas.replaceChildren(...marcas.map((m) => {
      const trecho = m.texto.length > 120 ? `${m.texto.slice(0, 119).trimEnd()}…` : m.texto;
      const ir = el('button', { type: 'button', className: 'item-lista item-marcador' },
        el('span', { className: 'item-pagina', textContent: `Página ${m.pagina}` }),
        el('span', { className: 'item-detalhe trecho', textContent: `“${trecho}”` }));
      ir.setAttribute('aria-label', `Página ${m.pagina}, ${trecho}`);
      ir.addEventListener('click', () => irPara(m.pagina));
      const remover = el('button', { type: 'button', className: 'botao-icone' }, icone(ICONES.fechar));
      remover.setAttribute('aria-label', `Remover trecho marcado da página ${m.pagina}`);
      remover.addEventListener('click', async () => {
        await repo.removerMarca(m.id);
        await recarregarMarcas();
        raiz.dispatchEvent(new CustomEvent('marcas-mudaram'));
        ctx.anunciar?.('Trecho desmarcado.');
      });
      return el('li', { className: 'linha-lista' }, ir, remover);
    }));
  }

  const aoMudarPagina = () => {
    atualizarBotaoMarcar();
    if (!painel.hidden && abaAtual === 'sumario') marcarAtualNoSumario();
  };
  raiz.addEventListener('pagina-mudou', aoMudarPagina);

  const aoMudarTela = () => { if (!painel.hidden) { fecharPainel(false); } };
  estreita.addEventListener('change', aoMudarTela);

  selecionar('sumario');
  await Promise.all([recarregarMarcadores(), recarregarMarcas()]);

  ctx.painel = { abrir: abrirPainel, fechar: () => fecharPainel(true), recarregarMarcas };

  return () => {
    raiz.removeEventListener('pagina-mudou', aoMudarPagina);
    estreita.removeEventListener('change', aoMudarTela);
    pilhaEsc.tirar(fecharPorEsc);
  };
}
