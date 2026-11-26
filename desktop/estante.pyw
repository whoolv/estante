"""Abre a Estante numa janela própria no notebook (duplo clique com pythonw: sem console)."""
from __future__ import annotations

import ctypes
import os
import sys
from pathlib import Path

import webview

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))

import servidor  # noqa: E402

RAIZ = AQUI.parent
ICONE = RAIZ / "icons" / "estante.ico"
TITULO = "Estante"
DADOS = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "Estante" / "webview"


def _por_icone() -> None:
    """Põe o ícone da Estante na barra de título e na barra de tarefas (o pywebview não faz isso no Windows)."""
    try:
        u = ctypes.windll.user32
        hwnd = u.FindWindowW(None, TITULO)
        if not hwnd:
            return
        LR_LOADFROMFILE, IMAGE_ICON, WM_SETICON = 0x10, 1, 0x80
        for tipo, lado in ((1, 256), (0, 32)):  # 1 = grande (barra de tarefas), 0 = pequeno (título)
            h = u.LoadImageW(None, str(ICONE), IMAGE_ICON, lado, lado, LR_LOADFROMFILE)
            if h:
                u.SendMessageW(hwnd, WM_SETICON, tipo, h)
    except Exception:
        pass


def _avisar(texto: str) -> None:
    try:
        ctypes.windll.user32.MessageBoxW(None, texto, TITULO, 0x30)
    except Exception:
        print(texto, file=sys.stderr)


def main() -> None:
    # Já aberta? Só traz a janela para a frente.
    if servidor.porta_ocupada_pela_estante():
        servidor.pedir_para_mostrar()
        return

    try:  # na barra de tarefas, a Estante aparece como ela mesma, não como "Python"
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("Estante.Leitor")
    except Exception:
        pass

    janela_ref: dict = {}

    def mostrar() -> None:
        j = janela_ref.get("janela")
        if j:
            try:
                j.restore()
                j.show()
                u = ctypes.windll.user32
                hwnd = u.FindWindowW(None, TITULO)
                if hwnd:
                    u.SetForegroundWindow(hwnd)
            except Exception:
                pass

    try:
        srv = servidor.iniciar_servidor(RAIZ, servidor.PORTA, ao_pedir_janela=mostrar)
    except OSError:
        _avisar(f"A porta {servidor.PORTA} está em uso por outro programa. Feche-o e abra a Estante de novo.")
        return

    DADOS.mkdir(parents=True, exist_ok=True)
    janela = webview.create_window(
        TITULO, f"http://{servidor.HOST}:{servidor.PORTA}/", width=1200, height=820,
        min_size=(360, 560), background_color="#141414",
    )
    janela_ref["janela"] = janela
    janela.events.shown += _por_icone
    try:
        webview.start(private_mode=False, storage_path=str(DADOS))
    finally:
        srv.shutdown()


if __name__ == "__main__":
    main()
