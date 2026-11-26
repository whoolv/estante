// Menu de opções de um livro (Renomear / Remover): botão ⋯, botão direito ou toque longo.

let aberto = null;

function fecharMenu(devolverFoco = true) {
  if (!aberto) return;
  const { menu, foco, limpar } = aberto;
  aberto = null;
  limpar();
  menu.remove();
  if (devolverFoco && foco?.isConnected) foco.focus();
}

export function abrirMenuLivro(ancora, { livro, renomear, remover, foco }) {
  fecharMenu(false);
  const menu = document.createElement('div');
  menu.className = 'menu-livro';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', `Opções de ${livro.titulo}`);

  const item = (texto, acao) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
    b.textContent = texto;
    b.addEventListener('click', () => { fecharMenu(true); acao(); });
    return b;
  };
  const itens = [item('Renomear', renomear), item('Remover', remover)];
  menu.append(...itens);
  document.body.append(menu);

  // Posiciona perto da âncora, sem sair da tela.
  const r = ancora.getBoundingClientRect();
  const largura = menu.offsetWidth;
  const altura = menu.offsetHeight;
  const x = Math.min(Math.max(8, r.right - largura), innerWidth - largura - 8);
  const abaixo = r.bottom + 6 + altura < innerHeight;
  const y = abaixo ? r.bottom + 6 : Math.max(8, r.top - altura - 6);
  menu.style.left = `${x + scrollX}px`;
  menu.style.top = `${y + scrollY}px`;

  const teclado = (ev) => {
    const i = itens.indexOf(document.activeElement);
    if (ev.key === 'Escape') { ev.preventDefault(); fecharMenu(true); }
    else if (ev.key === 'ArrowDown') { ev.preventDefault(); itens[(i + 1) % itens.length].focus(); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); itens[(i - 1 + itens.length) % itens.length].focus(); }
    else if (ev.key === 'Tab') fecharMenu(false);
  };
  const fora = (ev) => { if (!menu.contains(ev.target)) fecharMenu(false); };
  menu.addEventListener('keydown', teclado);
  setTimeout(() => document.addEventListener('pointerdown', fora), 0);
  const aoRolar = () => fecharMenu(false);
  addEventListener('resize', aoRolar);

  aberto = {
    menu, foco,
    limpar: () => {
      document.removeEventListener('pointerdown', fora);
      removeEventListener('resize', aoRolar);
    },
  };
  itens[0].focus();
}
