import { test, expect } from '@playwright/test';
import { abrirLivro, esperarLeitor, campoPagina, irParaEstante } from './ajuda.js';

const pagina = (page, n) => page.locator(`.pagina[data-pagina="${n}"]`);
const abrirOpcoes = (page) => page.getByRole('button', { name: 'Opções de leitura' }).click();

test('o painel abre do mesmo lado do botão (direita)', async ({ page }) => {
  await abrirLivro(page);
  await page.getByRole('button', { name: 'Painel', exact: true }).click();
  const painel = page.locator('#painel-leitor');
  await expect(painel).toBeVisible();
  const caixa = await painel.boundingBox();
  const largura = page.viewportSize().width;
  expect(caixa.x + caixa.width).toBeGreaterThan(largura - 4);
  if (caixa.width < largura / 2) expect(caixa.x).toBeGreaterThan(largura / 2);
});

test('o leitor tem uma barra de rolagem só', async ({ page }) => {
  await abrirLivro(page);
  const sobra = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  expect(sobra).toBeLessThanOrEqual(0);
});

test('modo página por página: vira com setas, toque nas bordas e lembra a escolha', async ({ page }) => {
  await abrirLivro(page);
  await abrirOpcoes(page);
  await page.getByRole('radio', { name: 'Página por página' }).check();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('radio', { name: 'Página por página' })).toBeHidden();
  const rolagem = page.locator('.rolagem');
  await expect(rolagem).toHaveClass(/modo-pagina/);

  await expect(pagina(page, 1)).toBeInViewport({ ratio: 0.95 });
  await expect(pagina(page, 2)).not.toBeInViewport();
  const caixaPag = await pagina(page, 1).boundingBox();
  const caixaRol = await rolagem.boundingBox();
  expect(caixaPag.height).toBeLessThanOrEqual(caixaRol.height + 1);

  await rolagem.focus();
  await page.keyboard.press('ArrowRight');
  await expect(campoPagina(page)).toHaveValue('2');
  await expect(pagina(page, 2)).toBeInViewport({ ratio: 0.95 });
  await expect(pagina(page, 1)).not.toBeInViewport();

  await page.mouse.click(caixaRol.x + caixaRol.width - 10, caixaRol.y + caixaRol.height / 2);
  await expect(campoPagina(page)).toHaveValue('3');
  await page.mouse.click(caixaRol.x + 10, caixaRol.y + caixaRol.height / 2);
  await expect(campoPagina(page)).toHaveValue('2');

  await page.reload();
  await esperarLeitor(page);
  await expect(page.locator('.rolagem')).toHaveClass(/modo-pagina/);
  await expect(campoPagina(page)).toHaveValue('2');
  await expect(pagina(page, 2)).toBeInViewport({ ratio: 0.95 });
});

test('modo página: a roda do mouse vira a página', async ({ page }) => {
  test.skip(test.info().project.name !== 'computador');
  await abrirLivro(page);
  await abrirOpcoes(page);
  await page.getByRole('radio', { name: 'Página por página' }).check();
  await page.keyboard.press('Escape');
  const caixa = await page.locator('.rolagem').boundingBox();
  await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await page.mouse.wheel(0, 400);
  await expect(campoPagina(page)).toHaveValue('2');
});

test('temas mudam a página e ficam guardados', async ({ page }) => {
  await abrirLivro(page);
  const canvas = page.locator('.pagina[data-pagina="1"] canvas');
  await expect(canvas).toBeAttached();
  await expect(canvas).toHaveCSS('filter', 'none');
  await abrirOpcoes(page);
  for (const nome of ['Original', 'Sépia', 'Escuro', 'Preto']) await expect(page.getByRole('radio', { name: nome })).toBeVisible();
  await page.getByRole('radio', { name: 'Escuro' }).check();
  await expect(page.locator('.leitor')).toHaveAttribute('data-tema', 'escuro');
  await expect(canvas).not.toHaveCSS('filter', 'none');

  await page.reload();
  await esperarLeitor(page);
  await expect(page.locator('.leitor')).toHaveAttribute('data-tema', 'escuro');
  await abrirOpcoes(page);
  await page.getByRole('radio', { name: 'Original' }).check();
  await expect(page.locator('.pagina[data-pagina="1"] canvas')).toHaveCSS('filter', 'none');
});

test('botão de instalar usa o convite do navegador', async ({ page }) => {
  await irParaEstante(page);
  const botao = page.getByRole('button', { name: 'Instalar app' });
  if (test.info().project.name === 'computador') await expect(botao).toBeHidden();
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = () => { window.__pediuInstalar = true; return Promise.resolve(); };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });
  await expect(botao).toBeVisible();
  await botao.click();
  expect(await page.evaluate(() => window.__pediuInstalar)).toBe(true);
  await expect(botao).toBeHidden();
});

test.describe('no iPhone', () => {
  test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  test('mostra o passo a passo para instalar', async ({ page }) => {
    test.skip(test.info().project.name !== 'celular');
    await irParaEstante(page);
    await page.getByRole('button', { name: 'Instalar app' }).click();
    const dlg = page.getByRole('dialog', { name: 'Instalar o app' });
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText('Compartilhar');
    await expect(dlg).toContainText('Adicionar à Tela de Início');
    await dlg.getByRole('button', { name: 'Entendi' }).click();
    await expect(dlg).toBeHidden();
  });
});
