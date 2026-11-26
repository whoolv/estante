# Estante no notebook, como programa

Abre a Estante numa janela própria no Windows, com o ícone dela na área de trabalho e na barra de tarefas. Funciona sem internet: os arquivos do app vêm da pasta do projeto.

## Instalar

Precisa do Python 3.10 ou mais novo. Na pasta do projeto, rode no PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File desktop\criar_atalho.ps1
```

Isso cria o ambiente Python em `desktop\.venv`, instala o [pywebview](https://pywebview.flowrl.com/) e coloca o atalho **Estante** na área de trabalho.

## Como funciona

- `estante.pyw` sobe um servidor só para este computador em `http://127.0.0.1:47821/` e abre a janela nele. A porta é sempre a mesma porque o navegador guarda os livros por endereço: com outra porta, a estante apareceria vazia.
- Os livros ficam em `%LOCALAPPDATA%\Estante\webview`. Essa estante é separada da que você usa no navegador ou no celular.
- Abrir o atalho com a Estante já aberta só traz a janela para a frente.

## Testes

```powershell
desktop\.venv\Scripts\python.exe -m pip install pytest
desktop\.venv\Scripts\python.exe -m pytest tests\desktop
```
