// Pequenos ajudantes de interface do leitor: criar elementos e ícones SVG.
export const el = (tag, props = {}, ...filhos) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const f of filhos) if (f != null) e.append(f);
  return e;
};

export const icone = (caminho) => {
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
