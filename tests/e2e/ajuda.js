import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';

export const fixture = (nome) => `tests/fixtures/${nome}`;

/** Adiciona PDFs pelo seletor de arquivos e espera aparecerem na estante. */
export async function adicionar(page, ...nomes) {
  await page.locator('#entrada-pdf').setInputFiles(nomes.map(fixture));
}

/** Adiciona com outro nome de arquivo (mesmo conteúdo). */
export async function adicionarComo(page, nome, novoNome) {
  await page.locator('#entrada-pdf').setInputFiles({ name: novoNome, mimeType: 'application/pdf', buffer: readFileSync(fixture(nome)) });
}

export async function irParaEstante(page) {
  await page.goto('./');
  await page.locator('main[data-pronta="estante"]').waitFor({ state: 'attached' });
}

export async function abrirEstanteCom(page, ...nomes) {
  await irParaEstante(page);
  if (nomes.length) {
    await adicionar(page, ...nomes);
    await expect(page.locator('.livro')).toHaveCount(nomes.length);
  }
}

export const projeto = () => (globalThis.__projeto ?? '');

/** Abre na estante, adiciona o PDF e abre o livro no leitor. */
export async function abrirLivro(page, nome = 'livro-teste.pdf') {
  await abrirEstanteCom(page, nome);
  await page.locator('.livro .capa').first().click();
  await esperarLeitor(page);
}

export async function esperarLeitor(page) {
  await page.locator('main[data-pronta="leitor"]').waitFor({ state: 'attached' });
}

export const campoPagina = (page) => page.getByRole('spinbutton', { name: 'Página atual' });

export async function irParaPagina(page, n) {
  const campo = campoPagina(page);
  await campo.fill(String(n));
  await campo.press('Enter');
  await expect(page.locator(`.pagina[data-pagina="${n}"]`)).toBeInViewport();
}
