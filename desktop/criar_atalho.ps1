# Prepara a Estante para abrir como programa no Windows e cria o atalho na área de trabalho.
# Uso: powershell -ExecutionPolicy Bypass -File desktop\criar_atalho.ps1
$ErrorActionPreference = 'Stop'
$projeto = Split-Path -Parent $PSScriptRoot
$venv = Join-Path $PSScriptRoot '.venv'

if (-not (Test-Path (Join-Path $venv 'Scripts\pythonw.exe'))) {
    Write-Host 'Criando o ambiente Python da Estante...'
    py -3 -m venv $venv
}
& (Join-Path $venv 'Scripts\python.exe') -m pip install --quiet --disable-pip-version-check -r (Join-Path $PSScriptRoot 'requirements.txt')

$areaDeTrabalho = [Environment]::GetFolderPath('Desktop')
$atalho = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $areaDeTrabalho 'Estante.lnk'))
$atalho.TargetPath = Join-Path $venv 'Scripts\pythonw.exe'
$atalho.Arguments = '"' + (Join-Path $PSScriptRoot 'estante.pyw') + '"'
$atalho.WorkingDirectory = $projeto
$atalho.IconLocation = (Join-Path $projeto 'icons\estante.ico') + ',0'
$atalho.Description = 'Estante: seus PDFs numa estante'
$atalho.Save()
Write-Host "Atalho criado em $areaDeTrabalho\Estante.lnk"
