// Opções de leitura (botão Aa): rolagem ou página por página, e o tema das páginas.
import { el } from './icones.js';
import { lerPreferencias, salvarPreferencias } from '../util/preferencias.js';

const MODOS = [
  { valor: 'rolagem', nome: 'Rolagem' },
  { valor: 'pagina', nome: 'Página por página' },
];
const TEMAS = [
  { valor: 'original', nome: 'Original' },
  { valor: 'sepia', nome: 'Sépia' },
  { valor: 'escuro', nome: 'Escuro' },
  { valor: 'preto', nome: 'Preto' },
];

function grupo(legenda, nome, itens, atual, classe, conteudo) {
  const escolhas = el('div', { className: `escolhas ${classe}` });
  for (const item of itens) {
    const radio = el('input', { type: 'radio', name: nome, value: item.valor, checked: item.valor === atual });
    radio.setAttribute('aria-label', item.nome);
    escolhas.append(el('label', { className: 'escolha' }, radio, ...conteudo(item)));
  }
  return el('fieldset', {}, el('legend', { textContent: legenda }), escolhas);
}

export function instalarOpcoes(ctx) {
  const { raiz, barra, ferramentas, visualizador, pilhaEsc, anunciar } = ctx;
  let prefs = lerPreferencias();

  const botao = el('button', { type: 'button', className: 'botao-icone botao-aa', textContent: 'Aa' });
  botao.setAttribute('aria-label', 'Opções de leitura');
  botao.setAttribute('aria-expanded', 'false');
  botao.setAttribute('aria-controls', 'opcoes-leitura');
  botao.title = 'Modo de leitura e tema';

  const caixa = el('div', { className: 'opcoes-leitura', id: 'opcoes-leitura', hidden: true },
    grupo('Modo de leitura', 'modo-leitura', MODOS, prefs.modo, 'modos',
      (m) => [el('span', { className: 'cartao', textContent: m.nome })]),
    grupo('Tema', 'tema-leitura', TEMAS, prefs.tema, 'temas',
      (t) => [el('span', { className: `cartao amostra amostra-${t.valor}`, textContent: 'Aa' }), el('span', { className: 'nome-tema', textContent: t.nome })]),
  );
  caixa.setAttribute('role', 'dialog');
  caixa.setAttribute('aria-label', 'Opções de leitura');

  ferramentas.append(botao);
  barra.append(caixa);

  const fechar = (devolverFoco = true) => {
    if (caixa.hidden) return;
    caixa.hidden = true;
    botao.setAttribute('aria-expanded', 'false');
    pilhaEsc.tirar(fechar);
    document.removeEventListener('pointerdown', foraDaCaixa, true);
    if (devolverFoco) botao.focus();
  };
  const foraDaCaixa = (ev) => {
    if (!caixa.contains(ev.target) && !botao.contains(ev.target)) fechar(false);
  };
  const abrir = () => {
    caixa.hidden = false;
    botao.setAttribute('aria-expanded', 'true');
    pilhaEsc.empilhar(fechar);
    document.addEventListener('pointerdown', foraDaCaixa, true);
    caixa.querySelector('input:checked')?.focus();
  };
  botao.addEventListener('click', () => (caixa.hidden ? abrir() : fechar()));

  caixa.addEventListener('change', (ev) => {
    const alvo = ev.target;
    if (!(alvo instanceof HTMLInputElement)) return;
    if (alvo.name === 'modo-leitura') {
      prefs = salvarPreferencias({ ...prefs, modo: alvo.value });
      visualizador.definirModo(prefs.modo);
      anunciar?.(prefs.modo === 'pagina' ? 'Página por página' : 'Rolagem');
    } else if (alvo.name === 'tema-leitura') {
      prefs = salvarPreferencias({ ...prefs, tema: alvo.value });
      raiz.dataset.tema = prefs.tema;
    }
  });

  return () => {
    document.removeEventListener('pointerdown', foraDaCaixa, true);
  };
}
