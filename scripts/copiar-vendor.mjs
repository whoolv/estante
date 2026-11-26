import { copyFileSync, mkdirSync } from 'node:fs';
const origem = 'node_modules/pdfjs-dist';
mkdirSync('vendor/pdfjs', { recursive: true });
for (const [de, para] of [
  ['build/pdf.min.mjs', 'pdf.min.mjs'],
  ['build/pdf.worker.min.mjs', 'pdf.worker.min.mjs'],
  ['LICENSE', 'LICENSE'],
]) copyFileSync(`${origem}/${de}`, `vendor/pdfjs/${para}`);
console.log('PDF.js copiado para vendor/pdfjs');
