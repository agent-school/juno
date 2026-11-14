# Dependency-free helper contracts. This does not replace the Windows Docker Desktop smoke matrix.
$ErrorActionPreference = 'Stop'
if (-not $env:LOCALAPPDATA) { $env:LOCALAPPDATA = Join-Path ([IO.Path]::GetTempPath()) 'juno-test-localappdata' }
. "$PSScriptRoot/start-juno-chrome.ps1"
function Assert-True($Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
function Assert-Reject([scriptblock]$Action) {
  $rejected = $false
  try { & $Action | Out-Null } catch { $rejected = $true }
  Assert-True $rejected 'Expected rejection'
}
Assert-Reject { Assert-JunoPort 0 }
Assert-Reject { Assert-JunoPort 65536 }
Assert-Reject { Get-JunoCandidates 9222 @(9222) }
Assert-Reject { Get-JunoCandidates 9222 @(9223, 9224, 9225) }
Assert-Reject { Assert-JunoRemoteScope '0.0.0.0/0' }
Assert-Reject { Assert-JunoRemoteScope 'Any' }
Assert-Reject { Assert-JunoRemoteScope '' }
Assert-JunoRemoteScope '172.26.0.0/20'
Assert-Reject { Resolve-JunoChrome (Join-Path ([IO.Path]::GetTempPath()) 'does-not-exist-juno.exe') }
$profile = Join-Path ([IO.Path]::GetTempPath()) "Juno O'Brien 学习 Space"
Assert-True ((Resolve-JunoProfile $profile) -eq $profile) 'Special-character profile changed'
if ($env:OS -eq 'Windows_NT') {
  Assert-Reject { Resolve-JunoProfile (Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data') }
  Assert-Reject { Resolve-JunoProfile (Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data\Default\Nested') }
  Assert-Reject { Resolve-JunoProfile 'C:\Users\EXAMPL~1\Chrome' }
  Assert-True ((Resolve-JunoProfile ($profile + '\')) -eq $profile) 'Trailing separator changed profile'
}
$record = [pscustomobject]@{ Pid=123; CreationDate='owned-time'; Profile=$profile; Port=9222; Token='owned-run' }
$line = (Get-JunoArguments $profile 9222 'owned-run' | ForEach-Object { ConvertTo-JunoArgument $_ }) -join ' '
$observed = [pscustomobject]@{ ProcessId=123; CreationDate='owned-time'; CommandLine=$line }
Assert-True (Test-JunoIdentity $record $observed) 'Exact owned identity rejected'
$observed.ProcessId = 124
Assert-True (-not (Test-JunoIdentity $record $observed)) 'PID mismatch accepted'
$observed.ProcessId = 123; $observed.CreationDate = 'reused-pid'
Assert-True (-not (Test-JunoIdentity $record $observed)) 'PID reuse accepted'
$observed.CreationDate = 'owned-time'; $observed.CommandLine = $line.Replace('owned-run', 'wrong-run')
Assert-True (-not (Test-JunoIdentity $record $observed)) 'Run token mismatch accepted'
Write-Output 'PASS: launcher helper contracts; Windows/Chrome/Docker lifecycle smoke remains separate.'
