$ErrorActionPreference = 'Stop'
$taskSourceRoot = [System.IO.Path]::GetFullPath('C:\Users\OPPENHEIMER\Desktop\kronox-juan')
$taskOutputRoot = (Resolve-Path -LiteralPath 'C:\Users\OPPENHEIMER\Documents\Codex\2026-11-03\files-pasted-by-the-user-act\outputs\kronox-audio-2026-11-10').Path
$taskOutputExpected = [System.IO.Path]::GetFullPath('C:\Users\OPPENHEIMER\Documents\Codex\2026-11-03\files-pasted-by-the-user-act\outputs\kronox-audio-2026-11-10')
if ($taskOutputRoot -ne $taskOutputExpected) { throw 'Wrong output directory' }
$taskManifest = Get-Content -LiteralPath (Join-Path $taskOutputRoot 'package-files.json') -Raw | ConvertFrom-Json
if ([System.IO.Path]::GetFullPath($taskManifest.sourceRoot) -ne $taskSourceRoot) { throw 'Wrong manifest source' }
Add-Type -AssemblyName System.IO.Compression
$taskZipPath = Join-Path $taskOutputRoot 'kronox-audio-continuidad-2026-11-10.zip'
$taskZipStream = [System.IO.File]::Open($taskZipPath,[System.IO.FileMode]::CreateNew,[System.IO.FileAccess]::Write)
$taskArchive = [System.IO.Compression.ZipArchive]::new($taskZipStream,[System.IO.Compression.ZipArchiveMode]::Create,$false)
try {
  foreach ($taskItem in $taskManifest.files) {
    $taskSourceFile = [System.IO.Path]::GetFullPath((Join-Path $taskSourceRoot $taskItem.path))
    if (-not $taskSourceFile.StartsWith($taskSourceRoot + [System.IO.Path]::DirectorySeparatorChar,[System.StringComparison]::OrdinalIgnoreCase)) { throw 'Source outside project' }
    $taskEntry = $taskArchive.CreateEntry('kronox-juan/' + $taskItem.path,[System.IO.Compression.CompressionLevel]::Optimal)
    $taskEntryStream = $taskEntry.Open()
    $taskInputStream = [System.IO.File]::OpenRead($taskSourceFile)
    try { $taskInputStream.CopyTo($taskEntryStream) } finally { $taskInputStream.Dispose(); $taskEntryStream.Dispose() }
  }
} finally { $taskArchive.Dispose(); $taskZipStream.Dispose() }
$taskZipRead = [System.IO.Compression.ZipFile]::OpenRead($taskZipPath)
$taskChecked = 0
try {
  if ($taskZipRead.Entries.Count -ne $taskManifest.files.Count) { throw 'Wrong ZIP entry count' }
  foreach ($taskItem in $taskManifest.files) {
    $taskEntry = $taskZipRead.GetEntry('kronox-juan/' + $taskItem.path)
    if ($null -eq $taskEntry -or $taskEntry.Length -ne $taskItem.size) { throw ('Wrong ZIP item ' + $taskItem.path) }
    $taskEntryStream = $taskEntry.Open(); $taskHasher = [System.Security.Cryptography.SHA256]::Create()
    try { $taskActual = ([System.BitConverter]::ToString($taskHasher.ComputeHash($taskEntryStream))).Replace('-','').ToLowerInvariant() } finally { $taskEntryStream.Dispose(); $taskHasher.Dispose() }
    if ($taskActual -ne $taskItem.sha256) { throw ('ZIP hash mismatch ' + $taskItem.path) }
    $taskChecked++
  }
} finally { $taskZipRead.Dispose() }
$taskResult = [ordered]@{ path=$taskZipPath; bytes=(Get-Item -LiteralPath $taskZipPath).Length; sha256=(Get-FileHash -LiteralPath $taskZipPath -Algorithm SHA256).Hash.ToLowerInvariant(); filesVerified=$taskChecked; allEntriesVerified=$true }
$taskResult | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskOutputRoot 'integridad-zip.json') -Encoding utf8
$taskResult | ConvertTo-Json
