$projectRoot = Split-Path -Parent $PSScriptRoot
$serverScript = Join-Path $projectRoot "scripts\dashboard-server.mjs"
$logDirectory = Join-Path $projectRoot "outputs\.dashboard\logs"

if (Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -like '*dashboard-server.mjs*' }) {
  exit 0
}

New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
$node = (Get-Command node.exe -ErrorAction Stop).Source
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"

Start-Process -FilePath $node `
  -ArgumentList @($serverScript) `
  -WorkingDirectory $projectRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $logDirectory "studio-$stamp.log") `
  -RedirectStandardError (Join-Path $logDirectory "studio-$stamp.error.log")
