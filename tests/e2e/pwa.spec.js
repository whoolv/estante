import { test, expect } from '@playwright/test';
import { adicionar, irParaEstante } from './ajuda.js';

test('manifest válido e ícones existem', async ({ page, request }) => {
  test.skip(test.info().project.name !== 'computador', 'basta uma vez');
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await request.get(href)).json();
  expect(manifest).toMatchObject({
    name: 'Estante', short_name: 'Estante', start_url: './', scope: './', display: 'standalone',
    background_color: '#141414', theme_color: '#141414', lang: 'pt-BR',
  });
  const tamanhos = manifest.icons.map((i) => `${i.sizes}${i.purpose === 'maskable' ? ' maskable' : ''}`);
  expect(tamanhos).toEqual(expect.arrayContaining(['192x192', '512x512', '512x512 maskable']));
  for (const icone of manifest.icons) {
    const r = await request.get(icone.src);
    expect(r.status(), icone.src).toBe(200);
    const buf = await r.body();
    expect(buf.readUInt32BE(16), `${icone.src} largura`).toBe(Number(icone.sizes.split('x')[0]));
  }
  expect((await request.get(await page.locator('link[rel="icon"]').getAttribute('href'))).status()).toBe(200);
});

test('funciona offline', async ({ page, context }) => {
  test.skip(test.info().project.name !== 'computador', 'basta uma vez');
  await irParaEstante(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await adicionar(page, 'livro-teste.pdf');
  await expect(page.locator('.livro')).toHaveCount(1);
  await page.reload(); // garante que a página está sob controle do service worker
  await page.locator('main[data-pronta="estante"]').waitFor({ state: 'attached' });
  await context.setOffline(true);
  await page.reload();
  await page.locator('main[data-pronta="estante"]').waitFor({ state: 'attached' });
  await expect(page.locator('.livro')).toHaveCount(1);
  await page.locator('.livro .capa').first().click();
  await expect(page.locator('.pagina[data-pagina="1"] canvas')).toBeVisible();
  await context.setOffline(false);
});
