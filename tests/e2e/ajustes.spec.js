import { test, expect } from '@playwright/test';
import { abrirLivro, abrirEstanteCom, campoPagina } from './ajuda.js';

test('setas nas abas do painel trocam a aba sem virar a página', async ({ page }) => {
  await abrirLivro(page);
  await page.getByRole('button', { name: 'Painel', exact: true }).click();
  await page.getByRole('tab', { name: 'Sumário' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Marcadores' })).toHaveAttribute('aria-selected', 'true');
  await expect(campoPagina(page)).toHaveValue('1');
});

test('na gaveta do celular, escolher um item leva o foco para as páginas', async ({ page }) => {
  test.skip(test.info().project.name !== 'celular');
  await abrirLivro(page);
  await page.getByRole('button', { name: 'Painel', exact: true }).click();
  await page.locator('#painel-leitor').getByRole('button', { name: 'Página 5', exact: true }).click();
  await expect(campoPagina(page)).toHaveValue('5');
  await expect(page.locator('.rolagem')).toBeFocused();
});

test('depois de remover um livro o foco não se perde', async ({ page }) => {
  await abrirEstanteCom(page, 'livro-teste.pdf', 'sem-titulo.pdf');
  const primeiro = page.locator('.livro').first();
  await primeiro.getByRole('button', { name: /^Opções de / }).click();
  await page.getByRole('menuitem', { name: 'Remover' }).click();
  await page.getByRole('button', { name: 'Remover da estante' }).click();
  await expect(page.locator('.livro')).toHaveCount(1);
  const foco = await page.evaluate(() => document.activeElement?.tagName);
  expect(foco).not.toBe('BODY');
});

test('as páginas não viram uma região cada para o leitor de tela', async ({ page }) => {
  await abrirLivro(page);
  await expect(page.locator('.pagina[role="region"]')).toHaveCount(0);
  await expect(page.locator('.pagina').first()).toHaveAttribute('aria-label', 'Página 1');
  await expect(page.locator('.pagina').first()).toHaveAttribute('role', 'group');
});

test('importar um arquivo que quebra mostra uma mensagem', async ({ page }) => {
  await abrirEstanteCom(page);
  // backup válido no formato, mas o banco falha na gravação
  await page.evaluate(() => {
    const orig = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...a) { if (this.name === 'marcadores') throw new DOMException('falhou', 'UnknownError'); return orig.apply(this, a); };
  });
  await page.locator('#entrada-backup').setInputFiles({
    name: 'b.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ app: 'estante', versao: 1, exportadoEm: 1, livros: [], marcadores: [{ id: 'm', livroId: 'a'.repeat(64), pagina: 1, nome: '', criadoEm: 1 }], marcas: [] })),
  });
  await page.getByRole('button', { name: 'Juntar marcações' }).click();
  await expect(page.locator('.aviso.erro')).toContainText('Não foi possível importar');
});

test.describe('sem service worker', () => {
  // o service worker responderia pelo arquivo; aqui a falha precisa chegar ao app
  test.use({ serviceWorkers: 'block' });
  test('se o leitor não carregar, a estante avisa e continua funcionando', async ({ page }) => {
  await abrirEstanteCom(page, 'livro-teste.pdf');
  await page.route('**/js/leitor/tela-leitor.js', (r) => r.abort());
  await page.locator('.livro .capa').first().click();
  await expect(page.locator('.aviso.erro')).toContainText('Não foi possível abrir o leitor');
  await expect(page.locator('main[data-pronta="estante"]')).toBeAttached();
  await expect(page.locator('.livro')).toHaveCount(1);
  });
});

test('voltar enquanto o livro carrega guarda onde parou antes de mostrar a estante', async ({ page }) => {
  await abrirEstanteCom(page, 'livro-teste.pdf');
  await page.locator('.livro .capa').first().click();
  await page.locator('main[data-pronta="leitor"]').waitFor({ state: 'attached' });
  const campo = page.getByRole('spinbutton', { name: 'Página atual' });
  await campo.fill('6');
  await campo.press('Enter');
  await page.evaluate(() => { location.hash = '#/'; });
  await expect(page.locator('.area-continuar')).toContainText('Página 6');
});
