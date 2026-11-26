import { test, expect } from '@playwright/test';
import { adicionar, adicionarComo, abrirEstanteCom, irParaEstante } from './ajuda.js';

test('estante vazia mostra convite', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText('Sua estante está vazia. Adicione seu primeiro PDF.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adicionar PDF' })).toBeVisible();
});

test('adiciona PDF e mostra capa e título', async ({ page }) => {
  await abrirEstanteCom(page, 'livro-teste.pdf');
  const item = page.locator('.livro').first();
  await expect(item.getByText('Livro de Teste')).toBeVisible();
  await expect.poll(() => item.locator('img').evaluate((i) => i.naturalWidth)).toBeGreaterThan(0);
  await expect(item.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
});

test('usa nome do arquivo quando não há título', async ({ page }) => {
  await abrirEstanteCom(page, 'sem-titulo.pdf');
  await expect(page.locator('.livro').getByText('sem titulo')).toBeVisible();
});

test('mesmo PDF com outro nome é recusado', async ({ page }) => {
  await abrirEstanteCom(page, 'livro-teste.pdf');
  await adicionarComo(page, 'livro-teste.pdf', 'copia.pdf');
  await expect(page.getByText('“Livro de Teste” já está na estante.')).toBeVisible();
  await expect(page.locator('.livro')).toHaveCount(1);
});

test('arquivo que não é PDF', async ({ page }) => {
  await irParaEstante(page);
  await adicionar(page, 'nao-e-pdf.pdf');
  await expect(page.getByText('“nao-e-pdf.pdf” não é um PDF válido.')).toBeVisible();
  await expect(page.locator('.livro')).toHaveCount(0);
});

test('busca filtra pelo nome sem acento', async ({ page }) => {
  await abrirEstanteCom(page, 'livro-teste.pdf', 'sem-titulo.pdf');
  await page.getByRole('searchbox', { name: 'Buscar livro' }).fill('LÍVRO');
  await expect(page.locator('.livro:visible')).toHaveCount(1);
  await expect(page.locator('#anuncios')).toHaveText('1 livro');
});

test('renomear pelo menu de opções', async ({ page }) => {
  await abrirEstanteCom(page, 'livro-teste.pdf');
  await page.getByRole('button', { name: 'Opções de Livro de Teste' }).click();
  await page.getByRole('menuitem', { name: 'Renomear' }).click();
  const campo = page.getByRole('textbox', { name: 'Nome do livro' });
  await campo.fill('Meu livro favorito');
  await page.getByRole('button', { name: 'Salvar nome' }).click();
  await expect(page.locator('.livro').getByText('Meu livro favorito')).toBeVisible();
  await page.reload();
  await expect(page.locator('.livro').getByText('Meu livro favorito')).toBeVisible();
});

test('remover pede confirmação', async ({ page }) => {
  await abrirEstanteCom(page, 'livro-teste.pdf');
  await page.getByRole('button', { name: 'Opções de Livro de Teste' }).click();
  await page.getByRole('menuitem', { name: 'Remover' }).click();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('.livro')).toHaveCount(1);
  await page.getByRole('button', { name: 'Opções de Livro de Teste' }).click();
  await page.getByRole('menuitem', { name: 'Remover' }).click();
  await page.getByRole('button', { name: 'Remover da estante' }).click();
  await expect(page.locator('.livro')).toHaveCount(0);
  await expect(page.getByText('Sua estante está vazia. Adicione seu primeiro PDF.')).toBeVisible();
});

test('botão direito abre o menu', async ({ page }) => {
  test.skip(test.info().project.name !== 'computador', 'só com mouse');
  await abrirEstanteCom(page, 'livro-teste.pdf');
  await page.locator('.livro .capa').first().click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: 'Renomear' })).toBeVisible();
});

test('toque longo abre o menu', async ({ page }) => {
  test.skip(test.info().project.name === 'computador', 'só com toque');
  await abrirEstanteCom(page, 'livro-teste.pdf');
  const capa = page.locator('.livro .capa').first();
  await capa.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true, button: 0 });
  await page.waitForTimeout(700);
  await capa.dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true, button: 0 });
  await expect(page.getByRole('menuitem', { name: 'Renomear' })).toBeVisible();
});

test('clicar na capa abre o livro', async ({ page }) => {
  await abrirEstanteCom(page, 'livro-teste.pdf');
  await page.locator('.livro .capa').first().click();
  await expect(page).toHaveURL(/#\/livro\/[0-9a-f]{64}$/);
});
