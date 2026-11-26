import { test, expect } from '@playwright/test';
import { abrirLivro, abrirEstanteCom, campoPagina } from './ajuda.js';

const modoPagina = async (page) => {
  await page.getByRole('button', { name: 'Opções de leitura' }).click();
  await page.getByRole('radio', { name: 'Página por página' }).check();
  await page.keyboard.press('Escape');
  await expect(page.locator('.rolagem')).toHaveClass(/modo-pagina/);
};
const caixaRolagem = (page) => page.locator('.rolagem').boundingBox();

test('modo página: páginas de tamanhos diferentes cabem inteiras na tela', async ({ page }) => {
  await abrirLivro(page, 'tamanhos.pdf');
  await modoPagina(page);
  const rol = await caixaRolagem(page);
  for (const n of [1, 2, 3]) {
    if (n > 1) await page.keyboard.press('ArrowRight');
    await expect(campoPagina(page)).toHaveValue(String(n));
    const pag = page.locator(`.pagina[data-pagina="${n}"]`);
    await expect(pag).toHaveAttribute('data-renderizada', '1');
    await expect(pag).toBeInViewport({ ratio: 0.99 });
    const c = await pag.boundingBox();
    expect(c.y).toBeGreaterThanOrEqual(rol.y - 1);
    expect(c.y + c.height).toBeLessThanOrEqual(rol.y + rol.height + 1);
  }
  const sobra = await page.evaluate(() => { const r = document.querySelector('.rolagem'); return r.scrollHeight - r.clientHeight; });
  expect(sobra).toBeLessThanOrEqual(2);
});

test('modo página: um gesto longo no touchpad vira só uma página', async ({ page }) => {
  test.skip(test.info().project.name !== 'computador');
  await abrirLivro(page);
  await modoPagina(page);
  const rol = await caixaRolagem(page);
  await page.mouse.move(rol.x + rol.width / 2, rol.y + rol.height / 2);
  for (let i = 0; i < 20; i++) { await page.mouse.wheel(0, 60); await page.waitForTimeout(40); }
  await page.waitForTimeout(600);
  await expect(campoPagina(page)).toHaveValue('2');
});

test('modo página: duplo clique na borda seleciona sem virar a página', async ({ page }) => {
  test.skip(test.info().project.name !== 'computador');
  await abrirLivro(page);
  await modoPagina(page);
  const pag = await page.locator('.pagina[data-pagina="1"]').boundingBox();
  const rol = await caixaRolagem(page);
  // ponto dentro da página e dentro da faixa da esquerda (30%)
  const x = Math.max(pag.x + 45, rol.x + 5);
  test.skip(x >= rol.x + rol.width * 0.3, 'nesta tela a página não chega à faixa da borda');
  await page.locator('.pagina[data-pagina="1"]').waitFor();
  await page.mouse.dblclick(x, pag.y + pag.height * 0.19);
  await page.waitForTimeout(500);
  await expect(campoPagina(page)).toHaveValue('1');
});

test('modo página: com zoom, a próxima página começa do topo', async ({ page }) => {
  await abrirLivro(page);
  await modoPagina(page);
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Aumentar zoom' }).click();
  await page.locator('.rolagem').evaluate((r) => { r.scrollTop = r.scrollHeight; });
  await page.locator('.rolagem').focus();
  await page.keyboard.press('ArrowRight');
  await expect(campoPagina(page)).toHaveValue('2');
  await expect.poll(() => page.locator('.rolagem').evaluate((r) => r.scrollTop)).toBe(0);
});

test('trocar o modo atualiza o zoom mostrado', async ({ page }) => {
  await abrirLivro(page);
  await page.getByRole('button', { name: 'Aumentar zoom' }).click();
  await expect(page.locator('.valor-zoom')).toHaveText('110%');
  await modoPagina(page);
  await expect(page.locator('.valor-zoom')).toHaveText('100%');
});

test('as opções de leitura fecham quando o foco sai delas', async ({ page }) => {
  await abrirLivro(page);
  await page.getByRole('button', { name: 'Opções de leitura' }).click();
  await expect(page.getByRole('dialog', { name: 'Opções de leitura' })).toBeVisible();
  await page.getByRole('button', { name: 'Diminuir zoom' }).focus();
  await expect(page.getByRole('dialog', { name: 'Opções de leitura' })).toBeHidden();
});

test('nome escolhido à mão que termina em .pdf não é trocado', async ({ page }) => {
  await abrirEstanteCom(page, 'livro-teste.pdf');
  await page.locator('.livro').first().getByRole('button', { name: /^Opções de / }).click();
  await page.getByRole('menuitem', { name: 'Renomear' }).click();
  await page.getByRole('textbox', { name: 'Nome do livro' }).fill('Apostila.pdf');
  await page.getByRole('button', { name: 'Salvar nome' }).click();
  await expect(page.locator('.livro').first()).toContainText('Apostila.pdf');
  await page.reload();
  await page.locator('main[data-pronta="estante"]').waitFor({ state: 'attached' });
  await expect(page.locator('.livro').first()).toContainText('Apostila.pdf');
});

test('modo página: tocar num trecho marcado perto da borda oferece remover, sem virar', async ({ page }) => {
  await abrirLivro(page);
  await modoPagina(page);
  // marca o título "Capítulo 1" (fica perto da borda esquerda da página)
  const span = page.locator('.pagina[data-pagina="1"] .textLayer span', { hasText: 'Capítulo 1' }).first();
  await span.waitFor();
  await span.evaluate((s) => { const r = document.createRange(); r.selectNodeContents(s); getSelection().removeAllRanges(); getSelection().addRange(r); });
  await page.getByRole('button', { name: 'Marcar', exact: true }).click();
  await expect(page.locator('.pagina[data-pagina="1"] .camada-marcas .marca')).toHaveCount(1);
  await page.evaluate(() => getSelection().removeAllRanges());
  const marca = await page.locator('.pagina[data-pagina="1"] .camada-marcas .marca').first().boundingBox();
  const rol = await caixaRolagem(page);
  const x = marca.x + 4;
  test.skip(x > rol.x + rol.width * 0.3, 'a marca não ficou na faixa da borda neste tamanho de tela');
  await page.mouse.click(x, marca.y + marca.height / 2);
  await expect(page.getByRole('button', { name: 'Remover marca' })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(campoPagina(page)).toHaveValue('1');
});
