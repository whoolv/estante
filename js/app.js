// Ponto de entrada da Estante: escolhe a tela pelo endereço (#/ ou #/livro/<id>).
import { abrirRepositorio } from './dados/repositorio.js';
import { mostrarEstante } from './estante/tela-estante.js';

const main = document.getElementById('app');
const repoPronto = abrirRepositorio();
let limpar = null;
let vez = 0;

async function rotear() {
  const minhaVez = ++vez;
  const repo = await repoPronto;
  if (limpar) { try { limpar(); } catch { /* nada */ } limpar = null; }
  const livro = location.hash.match(/^#\/livro\/([0-9a-f]{64})$/);
  let fim;
  if (livro) {
    const { mostrarLeitor } = await import('./leitor/tela-leitor.js').catch(() => ({}));
    if (mostrarLeitor) fim = await mostrarLeitor(main, repo, livro[1]);
  } else {
    fim = await mostrarEstante(main, repo);
  }
  if (minhaVez !== vez) { fim?.(); return; }
  limpar = fim ?? null;
}

window.addEventListener('hashchange', rotear);
rotear();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
}
