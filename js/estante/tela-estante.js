// Tela inicial: "Continuar lendo" + a estante com as capas.
import { hashArquivo } from '../util/hash.js';
import { tempoRelativo } from '../util/tempo.js';
import { percentualLido, tituloInicial } from '../util/livro.js';
import { normalizarBusca } from '../util/texto.js';
import { ErroLivroRepetido, ErroSemEspaco } from '../dados/repositorio.js';
import { carregarPdf, lerInfo, gerarCapa, ErroNaoEPdf, ErroPdfComSenha } from '../pdf/pdf.js';
import { abrirMenuLivro } from './menu-livro.js';
import { validarBackup, ErroBackupInvalido } from '../dados/backup.js';

const el = (tag, props = {}, ...filhos) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const f of filhos) if (f != null) e.append(f);
  return e;
};

export function anunciar(texto) {
  const regiao = document.getElementById('anuncios');
  regiao.textContent = '';
  // Pequeno atraso para leitores de tela perceberem a troca.
  setTimeout(() => { regiao.textContent = texto; }, 30);
}

const motivoDoErro = (e, arquivo) => {
  if (e instanceof ErroLivroRepetido) return `“${e.livro.titulo}” já está na estante.`;
  if (e instanceof ErroNaoEPdf) return `“${arquivo}” não é um PDF válido.`;
  if (e instanceof ErroPdfComSenha) return `“${arquivo}” tem senha e não pode ser aberto.`;
  if (e instanceof ErroSemEspaco) return `Não há espaço no aparelho para “${arquivo}”.`;
  return `Não foi possível adicionar “${arquivo}”.`;
};

let pediuPersistencia = false;
let avisoPendente = null;

/** Mostra um aviso na próxima vez que a estante abrir (ex.: livro não encontrado). */
export function avisarNaEstante(texto) { avisoPendente = texto; }

/** Adiciona arquivos à estante. Nunca lança: devolve o que entrou e o que falhou. */
export async function adicionarArquivos(files, repo) {
  const adicionados = [];
  const erros = [];
  for (const arquivo of files) {
    try {
      const buffer = await arquivo.arrayBuffer();
      const id = await hashArquivo(buffer);
      const existente = await repo.obterLivro(id);
      if (existente) throw new ErroLivroRepetido(existente);
      const pdf = await carregarPdf(buffer.slice(0));
      try {
        const { paginas, tituloMeta } = await lerInfo(pdf);
        const capa = await gerarCapa(pdf);
        const livro = await repo.adicionarLivro({
          id, paginas, capa,
          titulo: tituloInicial(tituloMeta, arquivo.name),
          arquivoNome: arquivo.name,
          arquivo: new Blob([buffer], { type: 'application/pdf' }),
        });
        adicionados.push(livro);
      } finally {
        pdf.destroy();
      }
      if (!pediuPersistencia) {
        pediuPersistencia = true;
        navigator.storage?.persist?.().catch(() => {});
      }
    } catch (e) {
      if (!(e instanceof ErroLivroRepetido || e instanceof ErroNaoEPdf || e instanceof ErroPdfComSenha || e instanceof ErroSemEspaco)) console.error(e);
      erros.push({ arquivo: arquivo.name, motivo: motivoDoErro(e, arquivo.name) });
    }
  }
  return { adicionados, erros };
}

function barraProgresso(livro, rotulo) {
  const p = percentualLido(livro);
  const barra = el('div', { className: 'progresso' }, el('span', { className: 'progresso-preenchido' }));
  barra.style.setProperty('--p', `${p}%`);
  barra.setAttribute('role', 'progressbar');
  barra.setAttribute('aria-valuemin', '0');
  barra.setAttribute('aria-valuemax', '100');
  barra.setAttribute('aria-valuenow', String(p));
  barra.setAttribute('aria-label', rotulo);
  return barra;
}

const abrirLivro = (id) => { location.hash = `#/livro/${id}`; };

/**
 * Mostra a estante em `main`. Devolve a função de limpeza (libera as imagens das capas).
 */
export async function mostrarEstante(main, repo) {
  const urls = new Map();
  const urlDaCapa = async (id) => {
    if (!urls.has(id)) {
      const blob = await repo.obterCapa(id);
      urls.set(id, blob ? URL.createObjectURL(blob) : '');
    }
    return urls.get(id);
  };

  const entrada = document.getElementById('entrada-pdf');
  const busca = el('input', { type: 'search', className: 'busca', placeholder: 'Buscar livro', autocomplete: 'off' });
  busca.setAttribute('aria-label', 'Buscar livro');
  const botaoAdicionar = el('button', { type: 'button', className: 'botao primario', textContent: 'Adicionar PDF' });
  const avisos = el('div', { className: 'avisos' });
  avisos.setAttribute('role', 'status');
  const areaContinuar = el('div', { className: 'area-continuar' });
  const lista = el('ul', { className: 'livros' });
  const vazio = el('p', { className: 'vazio', textContent: 'Sua estante está vazia. Adicione seu primeiro PDF.' });
  const tituloTodos = el('h2', { className: 'titulo-secao', id: 'titulo-todos', textContent: 'Todos os livros' });
  const prateleira = el('section', { className: 'prateleira' }, tituloTodos, vazio, lista);
  prateleira.setAttribute('aria-labelledby', 'titulo-todos');

  const espaco = el('p', { className: 'espaco' });
  const botaoExportar = el('button', { type: 'button', className: 'botao', textContent: 'Exportar marcações' });
  const botaoImportar = el('button', { type: 'button', className: 'botao', textContent: 'Importar marcações' });
  const rodape = el('footer', { className: 'rodape-estante' },
    espaco,
    el('p', { className: 'explica-backup', textContent: 'O backup guarda onde você parou, os marcadores e o marca-texto. Os PDFs não entram nele.' }),
    el('div', { className: 'acoes-backup' }, botaoExportar, botaoImportar));

  main.replaceChildren(
    el('header', { className: 'topo-estante' },
      el('h1', { className: 'marca', textContent: 'Estante' }),
      el('div', { className: 'acoes-topo' }, busca, botaoAdicionar)),
    avisoIos(),
    avisos,
    areaContinuar,
    prateleira,
    rodape,
  );
  main.dataset.tela = 'estante';
  delete main.dataset.pronta;

  let livros = [];

  async function desenharContinuar() {
    const ultimo = await repo.ultimoLido();
    areaContinuar.replaceChildren();
    if (!ultimo) return;
    const titulo = el('h2', { className: 'titulo-secao', id: 'titulo-continuar', textContent: 'Continuar lendo' });
    const img = el('img', { src: await urlDaCapa(ultimo.id), alt: '' });
    const cartao = el('section', { className: 'continuar' },
      el('div', { className: 'continuar-capa' }, img),
      el('div', { className: 'continuar-texto' },
        titulo,
        el('p', { className: 'continuar-livro', textContent: ultimo.titulo }),
        el('p', { className: 'continuar-onde', textContent: `Página ${ultimo.pagina} de ${ultimo.paginas}, lido ${tempoRelativo(ultimo.ultimaLeitura)}` }),
        barraProgresso(ultimo, `Progresso de ${ultimo.titulo}`),
        el('button', { type: 'button', className: 'botao primario', textContent: 'Continuar', onclick: () => abrirLivro(ultimo.id) })));
    cartao.setAttribute('aria-labelledby', 'titulo-continuar');
    areaContinuar.append(cartao);
  }

  async function itemDoLivro(livro) {
    const p = percentualLido(livro);
    const capa = el('button', { type: 'button', className: 'capa' },
      el('img', { src: await urlDaCapa(livro.id), alt: '', loading: 'lazy', draggable: false }));
    capa.setAttribute('aria-label', `${livro.titulo}, ${livro.ultimaLeitura ? livro.pagina : 0} de ${livro.paginas} páginas, ${p}% lido`);
    capa.addEventListener('click', (ev) => {
      if (capa.dataset.segurou) { delete capa.dataset.segurou; ev.preventDefault(); return; }
      abrirLivro(livro.id);
    });

    const opcoes = el('button', { type: 'button', className: 'opcoes', textContent: '⋯' });
    opcoes.setAttribute('aria-label', `Opções de ${livro.titulo}`);
    opcoes.setAttribute('aria-haspopup', 'menu');
    const menu = (ancora) => abrirMenuLivro(ancora, {
      livro,
      renomear: () => renomear(livro),
      remover: () => remover(livro),
      foco: opcoes,
    });
    opcoes.addEventListener('click', () => menu(opcoes));
    capa.addEventListener('contextmenu', (ev) => { ev.preventDefault(); menu(capa); });

    // Toque longo (celular/tablet) abre o mesmo menu.
    let timer = null;
    capa.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType === 'mouse') return;
      timer = setTimeout(() => { timer = null; capa.dataset.segurou = '1'; menu(capa); }, 500);
    });
    for (const fim of ['pointerup', 'pointercancel', 'pointerleave']) {
      capa.addEventListener(fim, () => { if (timer) { clearTimeout(timer); timer = null; } });
    }

    const li = el('li', { className: 'livro' },
      el('div', { className: 'nicho' }, capa),
      el('div', { className: 'tabua' }),
      barraProgresso(livro, `Progresso de ${livro.titulo}`),
      el('div', { className: 'rotulo' },
        el('span', { className: 'nome', textContent: livro.titulo, title: livro.titulo }),
        opcoes));
    li.dataset.busca = normalizarBusca(livro.titulo);
    li.dataset.id = livro.id;
    return li;
  }

  function filtrar(anunciarResultado) {
    const termo = normalizarBusca(busca.value.trim());
    let visiveis = 0;
    for (const li of lista.children) {
      const mostra = !termo || li.dataset.busca.includes(termo);
      li.hidden = !mostra;
      if (mostra) visiveis++;
    }
    if (anunciarResultado) anunciar(visiveis === 1 ? '1 livro' : `${visiveis} livros`);
  }

  async function mostrarEspaco() {
    const uso = await repo.espacoUsado().catch(() => null);
    espaco.hidden = !uso;
    if (uso) espaco.textContent = `Espaço usado: ${formatarTamanho(uso.usado)}`;
  }

  async function desenhar() {
    mostrarEspaco();
    livros = await repo.listarLivros();
    lista.replaceChildren(...(await Promise.all(livros.map(itemDoLivro))));
    vazio.hidden = livros.length > 0;
    filtrar(false);
    await desenharContinuar();
  }

  function mostrarAvisos(erros, adicionados) {
    avisos.replaceChildren(...erros.map((e) => el('p', { className: 'aviso erro', textContent: e.motivo })));
    if (adicionados.length && !erros.length) {
      anunciar(adicionados.length === 1 ? `“${adicionados[0].titulo}” entrou na estante.` : `${adicionados.length} livros entraram na estante.`);
    }
  }

  async function receber(files) {
    const pdfs = [...files];
    if (!pdfs.length) return;
    avisos.replaceChildren(el('p', { className: 'aviso', textContent: pdfs.length === 1 ? 'Adicionando o livro…' : `Adicionando ${pdfs.length} livros…` }));
    const { adicionados, erros } = await adicionarArquivos(pdfs, repo);
    await desenhar();
    mostrarAvisos(erros, adicionados);
  }

  async function renomear(livro) {
    const dlg = document.getElementById('dlg-renomear');
    const campo = dlg.querySelector('input[name="nome"]');
    campo.value = livro.titulo;
    const valor = await abrirDialogo(dlg, () => campo.select());
    if (valor !== 'salvar' || !campo.value.trim()) return;
    await repo.renomearLivro(livro.id, campo.value);
    await desenhar();
    anunciar('Nome salvo.');
  }

  async function remover(livro) {
    const dlg = document.getElementById('dlg-remover');
    dlg.querySelector('#dlg-remover-texto').textContent =
      `“${livro.titulo}” sai deste aparelho junto com o progresso, os marcadores e o marca-texto dele.`;
    if ((await abrirDialogo(dlg)) !== 'remover') return;
    await repo.removerLivro(livro.id);
    const url = urls.get(livro.id);
    if (url) URL.revokeObjectURL(url);
    urls.delete(livro.id);
    await desenhar();
    anunciar(`“${livro.titulo}” foi removido.`);
  }

  const entradaBackup = document.getElementById('entrada-backup');
  botaoExportar.addEventListener('click', async () => {
    const dados = await repo.exportarDados();
    const hoje = new Date();
    const data = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
    const a = el('a', { href: url, download: `estante-marcacoes-${data}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    anunciar('Marcações exportadas.');
  });
  botaoImportar.addEventListener('click', () => entradaBackup.click());
  const aoEscolherBackup = async () => {
    const arquivo = entradaBackup.files[0];
    entradaBackup.value = '';
    if (!arquivo) return;
    let dados = null;
    try { dados = JSON.parse(await arquivo.text()); } catch { /* inválido */ }
    try {
      validarBackup(dados); // avisa logo se o arquivo for outro, antes de perguntar
    } catch {
      avisos.replaceChildren(el('p', { className: 'aviso erro', textContent: new ErroBackupInvalido().message }));
      return;
    }
    if ((await abrirDialogo(document.getElementById('dlg-importar'))) !== 'juntar') return;
    const r = await repo.importarDados(dados);
    await desenhar();
    const n = (q, um, varios) => `${q} ${q === 1 ? um : varios}`;
    const texto = `Importado: ${n(r.livros, 'livro', 'livros')}, ${n(r.marcadores, 'marcador', 'marcadores')}, ${n(r.marcas, 'trecho', 'trechos')}.`;
    avisos.replaceChildren(el('p', { className: 'aviso', textContent: texto }));
    anunciar(texto);
  };
  entradaBackup.addEventListener('change', aoEscolherBackup);

  botaoAdicionar.addEventListener('click', () => entrada.click());
  const aoEscolher = () => { const f = [...entrada.files]; entrada.value = ''; receber(f); };
  entrada.addEventListener('change', aoEscolher);
  busca.addEventListener('input', () => filtrar(true));

  const aoArrastar = (ev) => { if (ev.dataTransfer?.types?.includes('Files')) { ev.preventDefault(); main.classList.add('arrastando'); } };
  const aoSair = () => main.classList.remove('arrastando');
  const aoSoltar = (ev) => {
    ev.preventDefault();
    main.classList.remove('arrastando');
    receber([...(ev.dataTransfer?.files ?? [])].filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)));
  };
  main.addEventListener('dragover', aoArrastar);
  main.addEventListener('dragleave', aoSair);
  main.addEventListener('drop', aoSoltar);

  await desenhar();
  if (avisoPendente) {
    avisos.replaceChildren(el('p', { className: 'aviso erro', textContent: avisoPendente }));
    avisoPendente = null;
  }
  main.dataset.pronta = 'estante';

  return () => {
    delete main.dataset.pronta;
    entrada.removeEventListener('change', aoEscolher);
    entradaBackup.removeEventListener('change', aoEscolherBackup);
    main.removeEventListener('dragover', aoArrastar);
    main.removeEventListener('dragleave', aoSair);
    main.removeEventListener('drop', aoSoltar);
    for (const url of urls.values()) if (url) URL.revokeObjectURL(url);
  };
}

function formatarTamanho(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${Math.round(bytes / 1024 / 1024)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1).replace('.', ',')} GB`;
}

const CHAVE_IOS = 'estante:aviso-ios-fechado';
function ehIosNoNavegador() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && !navigator.standalone;
}

/** No iPhone/iPad fora do app instalado, o Safari pode apagar os dados: orienta a instalar. */
function avisoIos() {
  if (!ehIosNoNavegador()) return '';
  try { if (localStorage.getItem(CHAVE_IOS)) return ''; } catch { /* sem armazenamento: mostra */ }
  const fechar = el('button', { type: 'button', className: 'botao-icone', textContent: '×' });
  fechar.setAttribute('aria-label', 'Fechar aviso');
  const faixa = el('div', { className: 'aviso aviso-ios' },
    el('p', { textContent: 'No iPhone e iPad, instale a Estante na tela de início (Compartilhar, depois Adicionar à Tela de Início) para o Safari não apagar seus livros.' }),
    fechar);
  fechar.addEventListener('click', () => {
    faixa.remove();
    try { localStorage.setItem(CHAVE_IOS, '1'); } catch { /* ignora */ }
  });
  return faixa;
}

/** Abre um <dialog> com formulário e resolve com o `value` do botão usado. */
export function abrirDialogo(dlg, aoAbrir) {
  return new Promise((ok) => {
    const anterior = document.activeElement;
    const cancelar = dlg.querySelectorAll('[data-fechar]');
    const fechar = () => dlg.close('cancelar');
    cancelar.forEach((b) => b.addEventListener('click', fechar, { once: true }));
    dlg.addEventListener('close', () => {
      cancelar.forEach((b) => b.removeEventListener('click', fechar));
      if (anterior?.isConnected) anterior.focus();
      ok(dlg.returnValue);
    }, { once: true });
    dlg.returnValue = '';
    dlg.showModal();
    aoAbrir?.();
  });
}
