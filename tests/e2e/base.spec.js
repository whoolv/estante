import { test, expect } from '@playwright/test';

test('abre com o título Estante', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle('Estante');
  await expect(page.getByRole('heading', { level: 1, name: 'Estante' })).toBeVisible();
});

test('sem rolagem horizontal', async ({ page }) => {
  await page.goto('./');
  const cabe = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(cabe).toBe(true);
});
