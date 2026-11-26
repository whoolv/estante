import { test, expect } from '@playwright/test';

test.describe('módulo PDF', () => {
  test.beforeEach(() => test.skip(test.info().project.name !== 'computador', 'lógica: basta um tamanho de tela'));

  test('lê informações, capa, texto e erros', async ({ page }) => {
    await page.goto('./');
    const r = await page.evaluate(async () => {
      const m = await import('/js/pdf/pdf.js');
      const buscar = async (n) => (await fetch(`/tests/fixtures/${n}`)).blob();
      const pdf = await m.carregarPdf(await buscar('livro-teste.pdf'));
      const info = await m.lerInfo(pdf);
      const capa = await m.gerarCapa(pdf);
      const texto3 = await m.textoDaPagina(pdf, 3);
      const temTexto = await m.temTexto(pdf);
      const sumario = await m.lerSumario(pdf);
      const img = await m.carregarPdf(await buscar('so-imagem.pdf'));
      const imgTemTexto = await m.temTexto(img);
      let erro = null;
      try { await m.carregarPdf(await buscar('nao-e-pdf.pdf')); } catch (e) { erro = e.name; }
      return { info, capaTam: capa.size, capaTipo: capa.type, texto3, temTexto, sumario, imgTemTexto, erro };
    });
    expect(r.info).toEqual({ paginas: 12, tituloMeta: 'Livro de Teste' });
    expect(r.capaTam).toBeGreaterThan(1000);
    expect(r.capaTipo).toMatch(/^image\//);
    expect(r.texto3).toContain('estante');
    expect(r.temTexto).toBe(true);
    expect(r.sumario).toEqual([]);
    expect(r.imgTemTexto).toBe(false);
    expect(r.erro).toBe('ErroNaoEPdf');
  });
});
