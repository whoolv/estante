import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { abrirEstanteCom, irParaEstante, abrirLivro } from './ajuda.js';

async function semViolacoes(page, onde) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const resumo = r.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  expect(resumo, onde).toEqual([]);
}

const semRolagemHorizontal = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('axe sem violações na estante', async ({ page }) => {
  await irParaEstante(page);
  await semViolacoes(page, 'estante vazia');
  await abrirEstanteCom(page, 'livro-teste.pdf', 'sem-titulo.pdf');
  await semViolacoes(page, 'estante com livros');
  await page.getByRole('button', { name: 'Opções de Livro de Teste' }).click();
  await semViolacoes(page, 'menu aberto');
});

test('axe sem violações no leitor', async ({ page }) => {
  await abrirLivro(page);
  await semViolacoes(page, 'leitor');
  await page.getByRole('button', { name: 'Painel', exact: true }).click();
  await semViolacoes(page, 'painel aberto');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Buscar no livro' }).click();
  await semViolacoes(page, 'busca aberta');
});

test('sem rolagem horizontal, inclusive em 320 px', async ({ page }) => {
  await abrirEstanteCom(page, 'livro-teste.pdf');
  expect(await semRolagemHorizontal(page)).toBe(true);
  await page.setViewportSize({ width: 320, height: 640 });
  expect(await semRolagemHorizontal(page)).toBe(true);
  await page.locator('.livro .capa').first().click();
  await page.locator('main[data-pronta="leitor"]').waitFor({ state: 'attached' });
  expect(await semRolagemHorizontal(page)).toBe(true);
});

test('texto a 200% não quebra', async ({ page }) => {
  await abrirEstanteCom(page, 'livro-teste.pdf');
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await semRolagemHorizontal(page)).toBe(true);
  await page.locator('.livro .capa').first().click();
  await page.locator('main[data-pronta="leitor"]').waitFor({ state: 'attached' });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await semRolagemHorizontal(page)).toBe(true);
  const sobrepostos = await page.evaluate(() => {
    const caixas = [...document.querySelectorAll('.barra-leitor button, .barra-leitor input')]
      .map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height);
    let n = 0;
    for (let i = 0; i < caixas.length; i++) for (let j = i + 1; j < caixas.length; j++) {
      const a = caixas[i]; const b = caixas[j];
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) n++;
    }
    return n;
  });
  expect(sobrepostos).toBe(0);
});

test('alvos de toque com pelo menos 44 px', async ({ page }) => {
  await abrirEstanteCom(page, 'livro-teste.pdf');
  const pequenos = async () => page.evaluate(() => [...document.querySelectorAll('button, a[href], input:not([type="file"])')]
    .filter((e) => e.offsetParent !== null)
    .map((e) => ({ e, r: e.getBoundingClientRect() }))
    .filter(({ r }) => r.width && (r.width < 43.5 || r.height < 43.5))
    .map(({ e, r }) => `${e.getAttribute('aria-label') || e.textContent.trim() || e.className} ${Math.round(r.width)}x${Math.round(r.height)}`));
  expect(await pequenos(), 'estante').toEqual([]);
  await page.locator('.livro .capa').first().click();
  await page.locator('main[data-pronta="leitor"]').waitFor({ state: 'attached' });
  expect(await pequenos(), 'leitor').toEqual([]);
});

test('movimento reduzido desliga transições', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await abrirEstanteCom(page, 'livro-teste.pdf');
  const duracao = await page.locator('.livro .capa img').first().evaluate((e) => getComputedStyle(e).transitionDuration);
  expect(duracao).toBe('0s');
});

test('navegação só por teclado', async ({ page }) => {
  test.skip(test.info().project.name !== 'computador', 'teclado físico');
  await abrirEstanteCom(page, 'livro-teste.pdf');
  await page.locator('body').focus();
  let chegou = false;
  for (let i = 0; i < 12 && !chegou; i++) {
    await page.keyboard.press('Tab');
    chegou = await page.evaluate(() => document.activeElement?.textContent === 'Adicionar PDF');
  }
  expect(chegou).toBe(true);
  let naCapa = false;
  for (let i = 0; i < 12 && !naCapa; i++) {
    await page.keyboard.press('Tab');
    naCapa = await page.evaluate(() => document.activeElement?.classList.contains('capa'));
  }
  expect(naCapa).toBe(true);
  await page.keyboard.press('Enter');
  await page.locator('main[data-pronta="leitor"]').waitFor({ state: 'attached' });
  await page.keyboard.press('Escape');
  await page.locator('main[data-pronta="estante"]').waitFor({ state: 'attached' });
});
