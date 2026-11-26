"""Servidor local da Estante para a janela do notebook.

Serve os arquivos do app só para este computador (127.0.0.1), numa porta fixa:
o navegador guarda os livros por endereço, então mudar a porta "esconderia" a estante.
"""
from __future__ import annotations

import http.client
import json
import socket
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import unquote, urlsplit

PORTA = 47821
HOST = "127.0.0.1"

# No notebook os arquivos já vêm da pasta: a cópia offline do app só atrapalharia as atualizações.
# Este service worker substitui o do site, apaga a cópia guardada, se desliga e recarrega a janela.
SW_LIMPEZA = b"""// Estante no notebook: sem copia offline (os arquivos ja sao locais).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (ev) => {
  ev.waitUntil((async () => {
    for (const nome of await caches.keys()) await caches.delete(nome);
    await self.registration.unregister();
    for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url);
  })());
});
"""


# Só o que o app usa; o resto da pasta (código-fonte, testes, .git) não sai daqui.
ARQUIVOS_SOLTOS = {"", "index.html", "manifest.webmanifest"}
PASTAS_DO_APP = ("css/", "js/", "vendor/", "icons/")


def _do_app(caminho: str) -> bool:
    c = caminho.lstrip("/")
    return c in ARQUIVOS_SOLTOS or c.startswith(PASTAS_DO_APP)


class _Servidor(ThreadingHTTPServer):
    allow_reuse_address = False  # no Windows, reaproveitar a porta deixaria dois programas na mesma
    daemon_threads = True

    def server_bind(self):
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


class _Pedidos(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".mjs": "text/javascript",
        ".js": "text/javascript",
        ".webmanifest": "application/manifest+json",
        ".svg": "image/svg+xml",
        ".json": "application/json",
    }

    def __init__(self, *args, raiz: Path, ao_pedir_janela: Optional[Callable[[], None]], **kwargs):
        self._raiz = raiz.resolve()
        self._ao_pedir_janela = ao_pedir_janela
        super().__init__(*args, directory=str(self._raiz), **kwargs)

    def log_message(self, *args):  # silencioso
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def _dentro_da_raiz(self) -> bool:
        caminho = unquote(urlsplit(self.path).path)
        if ".." in caminho.replace("\\", "/").split("/") or not _do_app(caminho):
            return False
        destino = (self._raiz / caminho.lstrip("/\\")).resolve()
        return destino == self._raiz or self._raiz in destino.parents

    def list_directory(self, path):
        self.send_error(404)
        return None

    def do_GET(self):
        if urlsplit(self.path).path == "/sw.js":
            self.send_response(200)
            self.send_header("Content-Type", "text/javascript; charset=utf-8")
            self.send_header("Content-Length", str(len(SW_LIMPEZA)))
            self.end_headers()
            self.wfile.write(SW_LIMPEZA)
            return
        if not self._dentro_da_raiz():
            self.send_error(404)
            return
        super().do_GET()

    def do_HEAD(self):
        if not self._dentro_da_raiz():
            self.send_error(404)
            return
        super().do_HEAD()

    def do_POST(self):
        if urlsplit(self.path).path == "/__mostrar" and self._ao_pedir_janela:
            self._ao_pedir_janela()
            self.send_response(204)
            self.end_headers()
            return
        self.send_error(404)


def iniciar_servidor(raiz: Path, porta: int = PORTA, ao_pedir_janela: Optional[Callable[[], None]] = None) -> ThreadingHTTPServer:
    """Sobe o servidor em segundo plano e devolve o objeto (use .shutdown() para parar)."""
    tratador = partial(_Pedidos, raiz=Path(raiz), ao_pedir_janela=ao_pedir_janela)
    srv = _Servidor((HOST, porta), tratador)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def porta_ocupada_pela_estante(porta: int = PORTA) -> bool:
    """A porta já está servindo a Estante (outra janela aberta)?"""
    try:
        c = http.client.HTTPConnection(HOST, porta, timeout=1.5)
        c.request("GET", "/manifest.webmanifest")
        r = c.getresponse()
        corpo = r.read()
        c.close()
        return r.status == 200 and json.loads(corpo.decode("utf-8")).get("name") == "Estante"
    except (OSError, ValueError, http.client.HTTPException):
        return False


def pedir_para_mostrar(porta: int = PORTA) -> None:
    """Pede à janela já aberta para aparecer na frente."""
    try:
        c = http.client.HTTPConnection(HOST, porta, timeout=2)
        c.request("POST", "/__mostrar")
        c.getresponse().read()
        c.close()
    except (OSError, http.client.HTTPException):
        pass
