"""Servidor local da Estante para a janela do notebook.

Serve os arquivos do app só para este computador (127.0.0.1), numa porta fixa:
o navegador guarda os livros por endereço, então mudar a porta "esconderia" a estante.
"""
from __future__ import annotations

import http.client
import json
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import unquote, urlsplit

PORTA = 47821
HOST = "127.0.0.1"


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
        if ".." in caminho.replace("\\", "/").split("/"):
            return False
        destino = (self._raiz / caminho.lstrip("/\\")).resolve()
        return destino == self._raiz or self._raiz in destino.parents

    def list_directory(self, path):
        self.send_error(404)
        return None

    def do_GET(self):
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
    srv = ThreadingHTTPServer((HOST, porta), tratador)
    srv.daemon_threads = True
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
