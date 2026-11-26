// Service worker da Estante: guarda o app no aparelho para abrir sem internet.
// Os livros não passam por aqui (ficam no IndexedDB).
const VERSAO = 'estante-95f5e550c773';
const ARQUIVOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/base.css',
  'css/estante.css',
  'css/leitor.css',
  'js/app.js',
  'js/dados/backup.js',
  'js/dados/repositorio.js',
  'js/estante/menu-livro.js',
  'js/estante/tela-estante.js',
  'js/leitor/busca-logica.js',
  'js/leitor/busca.js',
  'js/leitor/icones.js',
  'js/leitor/marca-texto.js',
  'js/leitor/paginas.js',
  'js/leitor/opcoes.js',
  'js/leitor/painel.js',
  'js/leitor/tela-leitor.js',
  'js/pdf/pdf.js',
  'js/util/canvas.js',
  'js/util/hash.js',
  'js/util/instalar.js',
  'js/util/livro.js',
  'js/util/preferencias.js',
  'js/util/retangulos.js',
  'js/util/tempo.js',
  'js/util/texto.js',
  'vendor/pdfjs/pdf.min.mjs',
  'vendor/pdfjs/pdf.worker.min.mjs',
  'icons/favicon.svg',
  'icons/icone-192.png',
  'icons/icone-512.png',
  'icons/icone-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (ev) => {
  // Baixa o conjunto inteiro direto do servidor (sem o cache do navegador), para nunca misturar versões.
  // A versão nova só entra quando o app é fechado e aberto de novo.
  ev.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS.map((a) => new Request(a, { cache: 'reload' })))));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil((async () => {
    for (const nome of await caches.keys()) if (nome !== VERSAO) await caches.delete(nome);
    await self.clients.claim();
  })());
});

// Responde com os arquivos desta versão; só vai à rede o que não faz parte do app.
self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const navegacao = req.mode === 'navigate';
  ev.respondWith((async () => {
    const cache = await caches.open(VERSAO);
    const guardado = await cache.match(navegacao ? 'index.html' : req, { ignoreSearch: navegacao });
    if (guardado) return guardado;
    try {
      return await fetch(req);
    } catch {
      return new Response('Sem conexão.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
