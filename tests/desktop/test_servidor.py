import http.client
import socket
import sys
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "desktop"))

import servidor  # noqa: E402


def porta_livre():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def pedir(porta, caminho, metodo="GET"):
    c = http.client.HTTPConnection("127.0.0.1", porta, timeout=5)
    c.request(metodo, caminho)
    r = c.getresponse()
    corpo = r.read()
    c.close()
    return r.status, r.getheader("Content-Type") or "", corpo


def subir(porta):
    srv = servidor.iniciar_servidor(RAIZ, porta)
    return srv


def test_serve_index():
    porta = porta_livre()
    srv = subir(porta)
    try:
        status, _, corpo = pedir(porta, "/")
        assert status == 200
        assert b"<title>Estante</title>" in corpo
    finally:
        srv.shutdown()


def test_mjs_tem_tipo_javascript():
    porta = porta_livre()
    srv = subir(porta)
    try:
        status, tipo, _ = pedir(porta, "/vendor/pdfjs/pdf.min.mjs")
        assert status == 200
        assert tipo.startswith("text/javascript")
        _, tipo_manifest, _ = pedir(porta, "/manifest.webmanifest")
        assert tipo_manifest.startswith("application/manifest+json")
    finally:
        srv.shutdown()


def test_recusa_sair_da_raiz():
    porta = porta_livre()
    srv = subir(porta)
    try:
        status, _, corpo = pedir(porta, "/..%2f..%2fREADME.md")
        assert status in (403, 404)
        status2, _, _ = pedir(porta, "/../desktop/servidor.py")
        assert status2 in (403, 404) or b"def iniciar_servidor" not in corpo
    finally:
        srv.shutdown()


def test_nao_lista_pastas():
    porta = porta_livre()
    srv = subir(porta)
    try:
        status, _, _ = pedir(porta, "/js/")
        assert status in (403, 404)
    finally:
        srv.shutdown()


def test_so_escuta_no_proprio_computador():
    porta = porta_livre()
    srv = subir(porta)
    try:
        assert srv.server_address[0] == "127.0.0.1"
    finally:
        srv.shutdown()


def test_detecta_estante_na_porta():
    porta = porta_livre()
    srv = subir(porta)
    try:
        assert servidor.porta_ocupada_pela_estante(porta) is True
    finally:
        srv.shutdown()

    outra = porta_livre()

    class Outro(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"{}")

        def log_message(self, *a):
            pass

    estranho = HTTPServer(("127.0.0.1", outra), Outro)
    threading.Thread(target=estranho.serve_forever, daemon=True).start()
    try:
        assert servidor.porta_ocupada_pela_estante(outra) is False
    finally:
        estranho.shutdown()

    assert servidor.porta_ocupada_pela_estante(porta_livre()) is False


def test_pedido_para_mostrar_janela_chama_funcao():
    porta = porta_livre()
    chamadas = []
    srv = servidor.iniciar_servidor(RAIZ, porta, ao_pedir_janela=lambda: chamadas.append(1))
    try:
        status, _, _ = pedir(porta, "/__mostrar", "POST")
        assert status == 204
        assert chamadas == [1]
    finally:
        srv.shutdown()


def test_sw_no_notebook_limpa_a_copia_guardada():
    porta = porta_livre()
    srv = subir(porta)
    try:
        status, tipo, corpo = pedir(porta, "/sw.js")
        assert status == 200
        assert tipo.startswith("text/javascript")
        texto = corpo.decode("utf-8")
        assert "unregister" in texto and "caches.delete" in texto and "skipWaiting" in texto
        assert "ARQUIVOS" not in texto
    finally:
        srv.shutdown()
