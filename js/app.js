// Ponto de entrada da Estante: escolhe a tela pelo endereço (#/ ou #/livro/<id>).
import { abrirRepositorio } from './dados/repositorio.js';
import { mostrarEstante, avisarNaEstante } from './estante/tela-estante.js';
import { escutarConvite } from './util/instalar.js';

escutarConvite();

const main = document.getElementById('app');
const repoPronto = abrirRepositorio();
let limpar = null;
let vez = 0;
let emCurso = Promise.resolve();

async function rotear() {
  const minhaVez = ++vez;
  const anterior = emCurso;
  let terminou;
  emCurso = new Promise((ok) => { terminou = ok; });
  try {
    // Espera a tela anterior terminar de abrir (e guardar onde parou) antes de trocar de tela.
    await anterior;
    if (minhaVez !== vez) return;
    const repo = await repoPronto;
    if (limpar) { try { limpar(); } catch { /* nada */ } limpar = null; }
    const livro = location.hash.match(/^#\/livro\/([0-9a-f]{64})$/);
    let fim;
    if (livro) {
      const modulo = await import('./leitor/tela-leitor.js').catch(() => null);
      if (!modulo) {
        avisarNaEstante('Não foi possível abrir o leitor. Verifique a internet e tente de novo.');
        location.replace('#/');
        return;
      }
      fim = await modulo.mostrarLeitor(main, repo, livro[1]);
    } else {
      fim = await mostrarEstante(main, repo);
    }
    if (minhaVez !== vez) { fim?.(); return; }
    limpar = fim ?? null;
  } finally {
    terminou();
  }
}

window.addEventListener('hashchange', rotear);
rotear();

// No notebook (janela própria) os arquivos vêm da pasta do projeto: sem cópia offline, sempre a versão mais nova.
const naJanelaDoNotebook = location.hostname === '127.0.0.1' && location.port === '47821';
if ('serviceWorker' in navigator && !naJanelaDoNotebook) {
  const tinhaVersao = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js', { scope: './' }).then((reg) => {
    // Versão nova esperando: troca quando o app vai para o fundo e recarrega sem ninguém ver.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && reg.waiting) reg.waiting.postMessage('trocar-versao');
    });
  }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!tinhaVersao) return; // primeira instalação: nada a recarregar
    if (document.visibilityState === 'hidden') location.reload();
    else document.addEventListener('visibilitychange', () => location.reload(), { once: true });
  });
}
