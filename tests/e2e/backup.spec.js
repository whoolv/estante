import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { abrirLivro, irParaPagina, adicionar, irParaEstante } from './ajuda.js';

test('exporta e importa marcações', async ({ page }) => {
  test.setTimeout(90_000);
  await abrirLivro(page);
  await irParaPagina(page, 4);
  await page.getByRole('button', { name: 'Marcar página' }).click();
  await irParaPagina(page, 6);
  await page.getByRole('button', { name: 'Voltar para a estante' }).click();
  await expect(page.getByText('Página 6 de 12, lido hoje')).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar marcações' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^estante-marcacoes-\d{4}-\d{2}-\d{2}\.json$/);
  const caminho = test.info().outputPath('backup.json');
  await download.saveAs(caminho);
  const dados = JSON.parse(readFileSync(caminho, 'utf8'));
  expect(dados.app).toBe('estante');

  // Remove o livro (apaga progresso e marcadores) e recupera pelo backup.
  await page.getByRole('button', { name: 'Opções de Livro de Teste' }).click();
  await page.getByRole('menuitem', { name: 'Remover' }).click();
  await page.getByRole('button', { name: 'Remover da estante' }).click();
  await expect(page.locator('.livro')).toHaveCount(0);

  await page.locator('#entrada-backup').setInputFiles(caminho);
  await page.getByRole('button', { name: 'Juntar marcações' }).click();
  await expect(page.locator('#anuncios')).toHaveText('Importado: 1 livro, 1 marcador, 0 trechos.');

  await adicionar(page, 'livro-teste.pdf');
  await expect(page.getByText('Página 6 de 12, lido hoje')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Painel', exact: true }).click();
  await page.getByRole('tab', { name: 'Marcadores' }).click();
  await expect(page.locator('#painel-leitor').getByRole('button', { name: 'Página 4', exact: true })).toBeVisible();
});

test('importar arquivo inválido avisa', async ({ page }) => {
  await irParaEstante(page);
  await page.locator('#entrada-backup').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"x":1}') });
  await expect(page.getByText('Esse arquivo não é um backup da Estante.')).toBeVisible();
});

test('mostra o espaço usado', async ({ page }) => {
  await irParaEstante(page);
  await expect(page.getByText(/^Espaço usado: /)).toBeVisible();
});

test('aviso do iPhone aparece só no iPhone', async ({ browser }) => {
  const iphone = await browser.newContext({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
  });
  const p1 = await iphone.newPage();
  await irParaEstante(p1);
  const texto = /No iPhone e iPad, instale a Estante na tela de início/;
  await expect(p1.getByText(texto)).toBeVisible();
  await p1.getByRole('button', { name: 'Fechar aviso' }).click();
  await p1.reload();
  await p1.locator('main[data-pronta="estante"]').waitFor({ state: 'attached' });
  await expect(p1.getByText(texto)).toBeHidden();
  await iphone.close();

  const comum = await browser.newContext();
  const p2 = await comum.newPage();
  await irParaEstante(p2);
  await expect(p2.getByText(texto)).toBeHidden();
  await comum.close();
});
