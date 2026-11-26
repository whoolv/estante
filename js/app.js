// Ponto de entrada da Estante: escolhe a tela pelo endereço (#/ ou #/livro/<id>).
const main = document.getElementById('app');

function rotear() {
  main.textContent = '';
}

window.addEventListener('hashchange', rotear);
rotear();
