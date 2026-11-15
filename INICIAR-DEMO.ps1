$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath 'package.json')) { throw 'Ejecuta desde la copia kronox-juan.' }
if (-not (Test-Path -LiteralPath 'node_modules/vite')) {
    npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias.' }
}
$sphereXRoot = Join-Path $PSScriptRoot 'SphereX-Visualizations-main'
$sphereXReady = $false
$sphereXStarting = $false
try {
    $sphereXHealth = Invoke-RestMethod -Uri 'http://127.0.0.1:8765/api/datasets' -TimeoutSec 2 -ErrorAction Stop
    $sphereXReady = $sphereXHealth.ok -and @($sphereXHealth.datasets).Count -gt 0
} catch { }

if (-not $sphereXReady -and (Test-Path -LiteralPath (Join-Path $sphereXRoot 'server.py'))) {
    $pythonLauncher = Get-Command py.exe -ErrorAction SilentlyContinue
    $pythonInterpreter = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($pythonLauncher) {
        & $pythonLauncher.Source -3 -c 'import requests' 2>$null
        if ($LASTEXITCODE -eq 0) {
            Start-Process -FilePath $pythonLauncher.Source -ArgumentList @('-3', 'server.py', '--host', '127.0.0.1', '--port', '8765') -WorkingDirectory $sphereXRoot -WindowStyle Hidden
            $sphereXStarting = $true
        }
    } elseif ($pythonInterpreter) {
        & $pythonInterpreter.Source -c 'import requests' 2>$null
        if ($LASTEXITCODE -eq 0) {
            Start-Process -FilePath $pythonInterpreter.Source -ArgumentList @('server.py', '--host', '127.0.0.1', '--port', '8765') -WorkingDirectory $sphereXRoot -WindowStyle Hidden
            $sphereXStarting = $true
        }
    }
}
Write-Host 'Kronox: http://127.0.0.1:5174/KRONOX/ (conservar introducción y Cronos)'
if ($sphereXReady) { Write-Host 'Archivo SPHEREx avanzado: http://127.0.0.1:8765 (ya disponible)' }
elseif ($sphereXStarting) { Write-Host 'Iniciando el archivo SPHEREx local para el explorador avanzado...' }
else { Write-Host 'El Explorador DR1 requiere Python y requests. Instala sus dependencias con: python -m pip install -r SphereX-Visualizations-main/requirements.txt' }
Write-Host 'Sin Internet: selecciona productos locales o usa ?data=local&target=m101'
Write-Host 'Si hay otro servidor abierto, ciérralo antes para cargar el backend reparado.'
npm.cmd run dev -- --host 127.0.0.1 --port 5174 --strictPort
