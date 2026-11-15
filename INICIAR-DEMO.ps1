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
$sphereXPort = $null
foreach ($candidatePort in @(8766, 8765)) {
    try {
        $serviceHealth = Invoke-RestMethod -Uri "http://127.0.0.1:$candidatePort/api/health" -TimeoutSec 2 -ErrorAction Stop
        $datasetHealth = Invoke-RestMethod -Uri "http://127.0.0.1:$candidatePort/api/datasets" -TimeoutSec 3 -ErrorAction Stop
        if ($serviceHealth.ok -and $serviceHealth.service -eq 'spherex-visualizer' -and $serviceHealth.version -ge 2 -and $datasetHealth.ok -and @($datasetHealth.datasets).Count -gt 0) {
            $sphereXReady = $true
            $sphereXPort = $candidatePort
            break
        }
    } catch { }
}

if (-not $sphereXReady -and (Test-Path -LiteralPath (Join-Path $sphereXRoot 'server.py'))) {
    foreach ($candidatePort in @(8766, 8765)) {
        $listener = Get-NetTCPConnection -LocalPort $candidatePort -State Listen -ErrorAction SilentlyContinue
        if (-not $listener) {
            $sphereXPort = $candidatePort
            break
        }
    }
    if ($null -eq $sphereXPort) { throw 'Los puertos 8765 y 8766 están ocupados por servicios SPHEREx incompatibles. Cierra esos servicios y vuelve a iniciar KRONOX.' }

    $pythonLauncher = Get-Command py.exe -ErrorAction SilentlyContinue
    $pythonInterpreter = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($pythonLauncher) {
        & $pythonLauncher.Source -3 -c 'import requests, certifi' 2>$null
        if ($LASTEXITCODE -eq 0) {
            $pythonSource = $pythonLauncher.Source
            $pythonPrefix = @('-3')
        }
    }
    if (-not $pythonSource -and $pythonInterpreter) {
        & $pythonInterpreter.Source -c 'import requests, certifi' 2>$null
        if ($LASTEXITCODE -eq 0) {
            $pythonSource = $pythonInterpreter.Source
            $pythonPrefix = @()
        }
    }
    if (-not $pythonSource) { throw 'El Explorador SPHEREx requiere Python con requests y certifi. Instala las dependencias con: python -m pip install -r SphereX-Visualizations-main/requirements.txt' }

    $serverArguments = @($pythonPrefix) + @('server.py', '--host', '127.0.0.1', '--port', [string]$sphereXPort)
    Start-Process -FilePath $pythonSource -ArgumentList $serverArguments -WorkingDirectory $sphereXRoot -WindowStyle Hidden
    $sphereXStarting = $true
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        Start-Sleep -Milliseconds 500
        try {
            $serviceHealth = Invoke-RestMethod -Uri "http://127.0.0.1:$sphereXPort/api/health" -TimeoutSec 2 -ErrorAction Stop
            $datasetHealth = Invoke-RestMethod -Uri "http://127.0.0.1:$sphereXPort/api/datasets" -TimeoutSec 3 -ErrorAction Stop
            if ($serviceHealth.ok -and $serviceHealth.version -ge 2 -and $datasetHealth.ok -and @($datasetHealth.datasets).Count -gt 0) {
                $sphereXReady = $true
                $sphereXStarting = $false
                break
            }
        } catch { }
    }
    if (-not $sphereXReady) { throw "No se pudo iniciar el backend científico SPHEREx en 127.0.0.1:$sphereXPort. Revisa las dependencias de SphereX-Visualizations-main." }
}
Write-Host 'Kronox: http://127.0.0.1:5174/KRONOX/ (conservar introducción y Cronos)'
if ($sphereXReady) { Write-Host "Observatorio SPHEREx integrado: backend listo en http://127.0.0.1:$sphereXPort" }
Write-Host 'Sin Internet: selecciona productos locales o usa ?data=local&target=m101'
npm.cmd run dev -- --host 127.0.0.1 --port 5174 --strictPort
