// Service worker da Estante: guarda o app no aparelho para abrir sem internet.
// Os livros não passam por aqui (ficam no IndexedDB).
const VERSAO = 'estante-v1';
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
  'js/leitor/painel.js',
  'js/leitor/tela-leitor.js',
  'js/pdf/pdf.js',
  'js/util/hash.js',
  'js/util/livro.js',
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
  ev.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil((async () => {
    for (const nome of await caches.keys()) if (nome !== VERSAO) await caches.delete(nome);
    await self.clients.claim();
  })());
});

// Responde do cache na hora e atualiza o cache em segundo plano quando há internet.
self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const navegacao = req.mode === 'navigate';
  ev.respondWith((async () => {
    const cache = await caches.open(VERSAO);
    const chave = navegacao ? 'index.html' : req;
    const guardado = await cache.match(chave, { ignoreSearch: navegacao });
    const daRede = fetch(req).then((resp) => {
      if (resp.ok && !navegacao && ARQUIVOS.some((a) => req.url.endsWith(`/${a}`))) cache.put(req, resp.clone());
      if (resp.ok && navegacao) cache.put('index.html', resp.clone());
      return resp;
    }).catch(() => null);
    if (guardado) { ev.waitUntil(daRede); return guardado; }
    return (await daRede) ?? new Response('Sem conexão.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});
