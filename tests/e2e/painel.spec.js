import { test, expect } from '@playwright/test';
import { abrirLivro, esperarLeitor, campoPagina, irParaPagina } from './ajuda.js';

const abrirPainel = (page) => page.getByRole('button', { name: 'Painel', exact: true }).click();
const painel = (page) => page.locator('#painel-leitor');

test('sem sumário lista as páginas', async ({ page }) => {
  await abrirLivro(page);
  await abrirPainel(page);
  await expect(page.getByRole('tab', { name: 'Sumário' })).toHaveAttribute('aria-selected', 'true');
  await painel(page).getByRole('button', { name: 'Página 7', exact: true }).click();
  await expect(campoPagina(page)).toHaveValue('7');
  await expect(page.locator('.pagina[data-pagina="7"]')).toBeInViewport();
});

test('cria, usa e remove marcador', async ({ page }) => {
  await abrirLivro(page);
  await irParaPagina(page, 4);
  await abrirPainel(page);
  await page.getByRole('tab', { name: 'Marcadores' }).click();
  await page.getByRole('textbox', { name: 'Nome do marcador (opcional)' }).fill('Fórmula');
  await page.getByRole('button', { name: 'Marcar esta página' }).click();
  const item = painel(page).getByRole('button', { name: 'Página 4, Fórmula' });
  await expect(item).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(painel(page)).toBeHidden();
  await expect(page.getByRole('button', { name: 'Remover marcador desta página' })).toHaveAttribute('aria-pressed', 'true');

  await irParaPagina(page, 1);
  await expect(page.getByRole('button', { name: 'Marcar página' })).toHaveAttribute('aria-pressed', 'false');
  await abrirPainel(page);
  await item.click();
  await expect(campoPagina(page)).toHaveValue('4');

  await page.reload();
  await esperarLeitor(page);
  await abrirPainel(page);
  await page.getByRole('tab', { name: 'Marcadores' }).click();
  await expect(item).toBeVisible();
  await painel(page).getByRole('button', { name: 'Remover marcador da página 4' }).click();
  await expect(item).toBeHidden();
  await expect(painel(page).getByText('Nenhum marcador ainda.')).toBeVisible();
});

test('marcador rápido pela barra', async ({ page }) => {
  await abrirLivro(page);
  await irParaPagina(page, 3);
  await page.getByRole('button', { name: 'Marcar página' }).click();
  await expect(page.getByRole('button', { name: 'Remover marcador desta página' })).toHaveAttribute('aria-pressed', 'true');
  await abrirPainel(page);
  await page.getByRole('tab', { name: 'Marcadores' }).click();
  await expect(painel(page).getByRole('button', { name: 'Página 3', exact: true })).toBeVisible();
});

test('Esc fecha o painel antes de sair do livro', async ({ page }) => {
  await abrirLivro(page);
  await abrirPainel(page);
  await expect(painel(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(painel(page)).toBeHidden();
  await expect(page.getByRole('button', { name: 'Painel', exact: true })).toBeFocused();
  await expect(page.locator('main[data-tela="leitor"]')).toBeAttached();
});

test('gaveta no celular prende o foco', async ({ page }) => {
  test.skip(test.info().project.name !== 'celular', 'só no celular');
  await abrirLivro(page);
  await abrirPainel(page);
  await expect(page.getByRole('tab', { name: 'Sumário' })).toBeFocused();
  for (let i = 0; i < 40; i++) await page.keyboard.press('Tab');
  const dentro = await page.evaluate(() => document.getElementById('painel-leitor').contains(document.activeElement));
  expect(dentro).toBe(true);
  await painel(page).getByRole('button', { name: 'Página 2', exact: true }).click();
  await expect(painel(page)).toBeHidden();
});
