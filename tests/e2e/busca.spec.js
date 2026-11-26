import { test, expect } from '@playwright/test';
import { abrirLivro, campoPagina } from './ajuda.js';

const campoBusca = (page) => page.getByRole('searchbox', { name: 'Buscar no livro' });

test('busca acha com e sem acento', async ({ page }) => {
  await abrirLivro(page);
  await page.getByRole('button', { name: 'Buscar no livro' }).click();
  await campoBusca(page).fill('estante');
  await campoBusca(page).press('Enter');
  await expect(page.locator('.contador-busca')).toHaveText('1 de 3');
  await expect(page.locator('#anuncios')).toHaveText('3 resultados');
  await expect(campoPagina(page)).toHaveValue('3');
  await expect(page.locator('.pagina[data-pagina="3"] .achado-atual')).toBeVisible();
  await page.getByRole('button', { name: 'Próximo resultado' }).click();
  await expect(page.locator('.contador-busca')).toHaveText('2 de 3');
  await expect(campoPagina(page)).toHaveValue('9');
  await expect(page.locator('.pagina[data-pagina="9"] .achado-atual')).toBeVisible();
  await page.getByRole('button', { name: 'Resultado anterior' }).click();
  await expect(page.locator('.contador-busca')).toHaveText('1 de 3');
});

test('Ctrl+F abre a busca do app e Esc fecha', async ({ page }) => {
  await abrirLivro(page);
  await page.locator('.rolagem').focus();
  await page.keyboard.press('Control+f');
  await expect(campoBusca(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(campoBusca(page)).toBeHidden();
  await expect(page.locator('main[data-tela="leitor"]')).toBeAttached();
  await expect(page.locator('.achado')).toHaveCount(0);
});

test('sem resultados avisa', async ({ page }) => {
  await abrirLivro(page);
  await page.getByRole('button', { name: 'Buscar no livro' }).click();
  await campoBusca(page).fill('xyzw');
  await campoBusca(page).press('Enter');
  await expect(page.locator('.contador-busca')).toHaveText('Nenhum resultado');
});
