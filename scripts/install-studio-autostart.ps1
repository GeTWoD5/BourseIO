$projectRoot = Split-Path -Parent $PSScriptRoot
$taskName = "BourseIO Studio - Autostart"
$starter = Join-Path $projectRoot "scripts\start-studio.ps1"
$powershell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"

$action = New-ScheduledTaskAction -Execute $powershell -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$starter`""
$localUser = "$env:COMPUTERNAME\$env:USERNAME"
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $localUser
$principal = New-ScheduledTaskPrincipal -UserId $localUser -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Description "Démarre Bourse.IO Studio sur le PC maison au démarrage de session." -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Host "Autostart installed: $taskName"
