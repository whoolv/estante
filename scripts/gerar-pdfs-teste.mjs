// Gera PDFs de teste com texto original (nunca usar livros reais nos testes).
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFileSync, mkdirSync } from 'node:fs';

mkdirSync('tests/fixtures', { recursive: true });
const salvar = async (nome, doc) => writeFileSync(`tests/fixtures/${nome}`, await doc.save({ useObjectStreams: false }));

async function livroDeTexto({ paginas, titulo, extra = () => [] }) {
  const doc = await PDFDocument.create();
  if (titulo) doc.setTitle(titulo);
  doc.setCreator('Estante (testes)');
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let i = 1; i <= paginas; i++) {
    const p = doc.addPage([420, 595]);
    p.drawRectangle({ x: 0, y: 0, width: 420, height: 595, color: rgb(1, 1, 1) });
    p.drawText(`Capítulo ${i}`, { x: 40, y: 530, size: 22, font: negrito, color: rgb(0.1, 0.1, 0.1) });
    const linhas = [
      `Esta é a página ${i} de um livro de teste.`,
      'O texto existe só para conferir a leitura,',
      'a busca, os marcadores e o marca-texto.',
      ...extra(i),
    ];
    linhas.forEach((t, j) => p.drawText(t, { x: 40, y: 480 - j * 22, size: 13, font: fonte, color: rgb(0.15, 0.15, 0.15) }));
  }
  return doc;
}

await salvar('livro-teste.pdf', await livroDeTexto({
  paginas: 12, titulo: 'Livro de Teste',
  extra: (i) => (i === 3 ? ['Uma estante cheia de livros.'] : i === 9 ? ['Estânte com acento e outra estante.'] : []),
}));
await salvar('sem-titulo.pdf', await livroDeTexto({ paginas: 3 }));
await salvar('grande.pdf', await livroDeTexto({ paginas: 400, titulo: 'Livro Grande' }));

const imagem = await PDFDocument.create();
imagem.setTitle('Somente Imagem');
for (let i = 0; i < 2; i++) {
  const p = imagem.addPage([420, 595]);
  p.drawRectangle({ x: 0, y: 0, width: 420, height: 595, color: rgb(0.95, 0.92, 0.85) });
  p.drawRectangle({ x: 60, y: 200, width: 300, height: 200, color: rgb(0.23, 0.21, 0.17) });
}
await salvar('so-imagem.pdf', imagem);

// Capa mais larga que as páginas de dentro (comum em livros escaneados)
const tamanhos = await PDFDocument.create();
tamanhos.setTitle('Tamanhos Variados');
const fonteT = await tamanhos.embedFont(StandardFonts.Helvetica);
for (let i = 1; i <= 6; i++) {
  const [w, h] = i === 1 ? [500, 595] : [420, 595];
  const p = tamanhos.addPage([w, h]);
  p.drawRectangle({ x: 0, y: 0, width: w, height: h, color: rgb(1, 1, 1) });
  p.drawText(`Folha ${i}`, { x: 40, y: 530, size: 20, font: fonteT, color: rgb(0.1, 0.1, 0.1) });
  p.drawText('Rodapé da folha', { x: 40, y: 20, size: 12, font: fonteT, color: rgb(0.1, 0.1, 0.1) });
}
await salvar('tamanhos.pdf', tamanhos);

// PNG 1×1 com extensão .pdf
writeFileSync('tests/fixtures/nao-e-pdf.pdf', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
console.log('PDFs de teste gerados em tests/fixtures');
