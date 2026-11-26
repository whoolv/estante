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
