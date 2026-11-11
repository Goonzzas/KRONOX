$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath 'package.json')) { throw 'Ejecuta desde la copia kronox-juan.' }
if (-not (Test-Path -LiteralPath 'node_modules/vite')) {
    npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias.' }
}
Write-Host 'Kronox: http://127.0.0.1:5174/KRONOX/ (conservar introducción y Cronos)'
Write-Host 'Sin Internet: selecciona productos locales o usa ?data=local&target=m101'
Write-Host 'Si hay otro servidor abierto, ciérralo antes para cargar el backend reparado.'
npm.cmd run dev -- --host 127.0.0.1 --port 5174 --strictPort
