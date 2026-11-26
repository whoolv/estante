import { test, expect } from '@playwright/test';
import { abrirLivro, esperarLeitor, campoPagina, irParaPagina, irParaEstante } from './ajuda.js';

test('abre na página 1 e vai para a 5', async ({ page }) => {
  await abrirLivro(page);
  await expect(campoPagina(page)).toHaveValue('1');
  await expect(page.locator('.pagina[data-pagina="1"] canvas')).toBeVisible();
  await irParaPagina(page, 5);
  await expect(page.locator('.pagina[data-pagina="5"] canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Voltar para a estante' }).click();
  await expect(page.getByText('Página 5 de 12, lido hoje')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await esperarLeitor(page);
  await expect(campoPagina(page)).toHaveValue('5');
  await expect(page.locator('.pagina[data-pagina="5"]')).toBeInViewport();
});

test('retoma após recarregar logo depois de rolar', async ({ page }) => {
  await abrirLivro(page);
  const rolagem = page.locator('.rolagem');
  await rolagem.evaluate((r) => {
    const alvo = r.querySelector('.pagina[data-pagina="8"]');
    r.scrollTop = alvo.offsetTop;
  });
  await expect(campoPagina(page)).toHaveValue('8');
  await page.reload();
  await esperarLeitor(page);
  await expect(campoPagina(page)).toHaveValue('8');
});

test('livro grande não cria canvas demais', async ({ page }) => {
  await abrirLivro(page, 'grande.pdf');
  for (const n of [60, 150, 260, 399, 400]) await irParaPagina(page, n);
  await expect(page.locator('.pagina[data-pagina="400"] canvas')).toBeVisible();
  expect(await page.locator('canvas').count()).toBeLessThanOrEqual(12);
});

test('teclado troca de página', async ({ page }) => {
  await abrirLivro(page);
  await page.locator('.rolagem').focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press('PageDown');
  await expect(campoPagina(page)).toHaveValue('4');
  await page.keyboard.press('PageUp');
  await expect(campoPagina(page)).toHaveValue('3');
});

test('zoom muda o tamanho da página', async ({ page }) => {
  await abrirLivro(page);
  const largura = () => page.locator('.pagina[data-pagina="1"]').evaluate((e) => e.getBoundingClientRect().width);
  const antes = await largura();
  await page.getByRole('button', { name: 'Aumentar zoom' }).click();
  await expect.poll(largura).toBeGreaterThan(antes * 1.05);
  await page.getByRole('button', { name: 'Ajustar à largura' }).click();
  await expect.poll(largura).toBeCloseTo(antes, 0);
});

test('PDF só imagem mostra aviso', async ({ page }) => {
  await abrirLivro(page, 'so-imagem.pdf');
  await expect(page.getByText('Este PDF é só imagem: a busca e o marca-texto não funcionam nele.')).toBeVisible();
});

test('rota de livro inexistente volta para a estante', async ({ page }) => {
  await irParaEstante(page);
  await page.goto(`./#/livro/${'0'.repeat(64)}`);
  await expect(page.getByText('Livro não encontrado.')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Estante' })).toBeVisible();
});
