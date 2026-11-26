import { test, expect } from '@playwright/test';
import { abrirLivro, esperarLeitor, irParaPagina } from './ajuda.js';

async function selecionar(page, n, texto) {
  await expect(page.locator(`.pagina[data-pagina="${n}"] .textLayer span`).first()).toBeAttached();
  await page.evaluate(([n, texto]) => {
    const spans = [...document.querySelectorAll(`.pagina[data-pagina="${n}"] .textLayer span`)];
    const alvo = spans.find((s) => s.textContent.includes(texto));
    const range = document.createRange();
    range.selectNodeContents(alvo);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }, [n, texto]);
}

const marcasDaPagina = (page, n) => page.locator(`.pagina[data-pagina="${n}"] .camada-marcas .marca`);

test('marca, persiste e remove', async ({ page }) => {
  await abrirLivro(page);
  await irParaPagina(page, 2);
  await selecionar(page, 2, 'Capítulo 2');
  await page.getByRole('button', { name: 'Marcar', exact: true }).click();
  await expect(marcasDaPagina(page, 2).first()).toBeVisible();
  await expect(page.locator('#anuncios')).toHaveText('Trecho marcado.');

  await page.reload();
  await esperarLeitor(page);
  await expect(marcasDaPagina(page, 2).first()).toBeVisible();

  await page.getByRole('button', { name: 'Painel', exact: true }).click();
  await page.getByRole('tab', { name: 'Marca-texto' }).click();
  const painel = page.locator('#painel-leitor');
  await expect(painel.getByRole('button', { name: 'Página 2, Capítulo 2' })).toBeVisible();
  await painel.getByRole('button', { name: 'Remover trecho marcado da página 2' }).click();
  await expect(painel.getByText('Nenhum trecho marcado.', { exact: false })).toBeVisible();
  await expect(marcasDaPagina(page, 2)).toHaveCount(0);
});

test('tocar no destaque oferece remover', async ({ page }) => {
  await abrirLivro(page);
  await irParaPagina(page, 2);
  await selecionar(page, 2, 'Capítulo 2');
  await page.getByRole('button', { name: 'Marcar', exact: true }).click();
  await expect(marcasDaPagina(page, 2).first()).toBeVisible();
  await page.evaluate(() => getSelection().removeAllRanges());
  const caixa = await marcasDaPagina(page, 2).first().boundingBox();
  await page.mouse.click(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await page.getByRole('button', { name: 'Remover marca' }).click();
  await expect(marcasDaPagina(page, 2)).toHaveCount(0);
});

test('PDF só imagem não oferece marcar', async ({ page }) => {
  await abrirLivro(page, 'so-imagem.pdf');
  await expect(page.locator('.pagina[data-pagina="1"] canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Marcar', exact: true })).toBeHidden();
});
