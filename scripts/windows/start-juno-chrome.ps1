[CmdletBinding()]
param(
  [string]$ChromePath,
  [string]$ProfileDir = (Join-Path $env:LOCALAPPDATA 'Juno\Chrome'),
  [int]$Port = 9222,
  [int[]]$RetryPorts = @(),
  [int]$FixturePort = 8931,
  [string]$DockerRemoteScope,
  [string]$RepoRoot = (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent)
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-JunoPort([int]$Value) {
  if ($Value -lt 1024 -or $Value -gt 65535) { throw 'Port must be 1024–65535.' }
}

function Get-JunoCandidates([int]$Primary, [int[]]$Retries) {
  $all = @($Primary) + @($Retries)
  if ($all.Count -gt 3 -or @($all | Select-Object -Unique).Count -ne $all.Count) {
    throw 'Use at most three distinct explicit CDP ports.'
  }
  foreach ($value in $all) { Assert-JunoPort $value }
  return $all
}

function Resolve-JunoChrome([string]$Explicit) {
  $candidates = @()
  if ($Explicit) { $candidates = @($Explicit) }
  elseif ($env:JUNO_CHROME_PATH) { $candidates = @($env:JUNO_CHROME_PATH) }
  else {
    $found = Get-Command chrome.exe -CommandType Application -ErrorAction SilentlyContinue
    if ($found) { $candidates += $found.Source }
    foreach ($root in @($env:LOCALAPPDATA, $env:ProgramFiles, ${env:ProgramFiles(x86)})) {
      if ($root) { $candidates += Join-Path $root 'Google\Chrome\Application\chrome.exe' }
    }
  }
  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { return (Get-Item -LiteralPath $candidate).FullName }
  }
  throw 'No Chrome executable found. Supply -ChromePath pointing to a real chrome.exe file.'
}

function Resolve-JunoProfile([string]$Path) {
  if (-not [IO.Path]::IsPathRooted($Path)) { throw 'Use an absolute dedicated profile path.' }
  $full = [IO.Path]::GetFullPath($Path).TrimEnd([char[]]'\/')
  if ($full -match '(?i)(^|[\\/])[^\\/]*~[0-9]+') { throw 'Use a full profile path rather than a DOS short-name alias.' }
  if (-not $full -or $full -eq [IO.Path]::GetPathRoot($full).TrimEnd([char[]]'\/')) { throw 'A filesystem root is not a profile.' }
  foreach ($tail in @('Google\Chrome\User Data', 'Google\Chrome Beta\User Data', 'Google\Chrome Dev\User Data', 'Google\Chrome SxS\User Data', 'Chromium\User Data')) {
    $daily = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA $tail)).TrimEnd([char[]]'\/')
    if ($full.Equals($daily, [StringComparison]::OrdinalIgnoreCase) -or
        $full.StartsWith($daily + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or
        $daily.StartsWith($full + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
      throw 'Daily-driver profile roots, descendants and ancestors are forbidden.'
    }
  }
  # Existing reparse points could alias a daily-driver profile. Do not resolve through them.
  $cursor = $full
  while ($cursor) {
    if (Test-Path -LiteralPath $cursor) {
      if (((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Profile paths cannot pass through reparse points.' }
    }
    $parent = Split-Path $cursor -Parent
    if ($parent -eq $cursor) { break }
    $cursor = $parent
  }
  return $full
}

function ConvertTo-JunoArgument([string]$Value) {
  # Windows CommandLineToArgvW rules, including trailing backslashes and embedded quotes.
  return '"' + [regex]::Replace([regex]::Replace($Value, '(\\*)"', '$1$1\"'), '(\\+)$', '$1$1') + '"'
}

function Get-JunoArguments([string]$Profile, [int]$DebugPort, [string]$Token) {
  return @("--user-data-dir=$Profile", "--remote-debugging-port=$DebugPort", "--juno-run-token=$Token", '--no-first-run', '--no-default-browser-check', 'about:blank')
}

function Test-JunoIdentity($Record, $Observed) {
  if (-not $Observed -or [int]$Observed.ProcessId -ne [int]$Record.Pid) { return $false }
  if ([string]$Observed.CreationDate -ne [string]$Record.CreationDate) { return $false }
  $line = [string]$Observed.CommandLine
  foreach ($argument in @("--user-data-dir=$($Record.Profile)", "--remote-debugging-port=$($Record.Port)", "--juno-run-token=$($Record.Token)")) {
    $quoted = ConvertTo-JunoArgument $argument
    # Match the exact quoted argument, with argument boundaries, never a substring/path prefix.
    if ($line -notmatch ('(?:^|\s)' + [regex]::Escape($quoted) + '(?=\s|$)')) { return $false }
  }
  return $true
}

function Assert-JunoRemoteScope([string]$Scope) {
  if (-not $Scope) { throw 'Supply -DockerRemoteScope with the known Docker/WSL source IP or subnet; unknown scopes fail closed.' }
  foreach ($entry in $Scope.Split(',')) {
    $parts = $entry.Trim().Split('/')
    $address = $null
    if ($parts.Count -gt 2 -or -not [Net.IPAddress]::TryParse($parts[0], [ref]$address)) { throw 'Remote scope must contain explicit IPs/CIDRs.' }
    if ($address.Equals([Net.IPAddress]::Any) -or $address.Equals([Net.IPAddress]::IPv6Any)) { throw 'Wildcard remote scopes are forbidden.' }
    if ($parts.Count -eq 2) {
      $prefix = 0
      $max = if ($address.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork) { 32 } else { 128 }
      if (-not [int]::TryParse($parts[1], [ref]$prefix) -or $prefix -lt 1 -or $prefix -gt $max) { throw 'Invalid remote CIDR.' }
    }
  }
}

function Get-JunoProcess([int]$ProcessId) {
  return Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction SilentlyContinue
}

function Stop-JunoOwnedChrome($Record) {
  if (-not $Record) { return }
  $observed = Get-JunoProcess $Record.Pid
  if (-not $observed) { return }
  if (-not (Test-JunoIdentity $Record $observed)) { throw 'Chrome cleanup refused: process identity changed.' }
  # taskkill /T is scoped to the exact captured and re-validated root PID; never kill by name.
  & taskkill.exe /PID $Record.Pid /T /F | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Owned Chrome tree could not be stopped.' }
  $until = [DateTime]::UtcNow.AddSeconds(5)
  while ([DateTime]::UtcNow -lt $until) {
    if (-not (Get-NetTCPConnection -State Listen -LocalPort $Record.Port -ErrorAction SilentlyContinue)) { return }
    Start-Sleep -Milliseconds 100
  }
  throw 'Owned CDP port did not release; inspect the captured process without killing unrelated Chrome.'
}

function Invoke-JunoRuntime {
  $chrome = Resolve-JunoChrome $ChromePath
  $profile = Resolve-JunoProfile $ProfileDir
  $candidates = @(Get-JunoCandidates $Port $RetryPorts)
  Assert-JunoPort $FixturePort
  if ($candidates -contains $FixturePort) { throw 'Fixture and CDP ports must differ.' }
  Assert-JunoRemoteScope $DockerRemoteScope
  if (-not (Get-Command docker.exe -ErrorAction SilentlyContinue)) { throw 'Install/start Docker Desktop with Linux containers.' }
  New-Item -ItemType Directory -Path $profile -Force | Out-Null
  $token = [guid]::NewGuid().ToString('N')
  $owner = $null; $firewall = $null
  $project = "juno-cdp-$token"
  $compose = Join-Path $RepoRoot 'docker-compose.cdp.yml'
  $oldCdp = $env:JUNO_CDP_PORT; $oldFixture = $env:JUNO_FIXTURE_PORT
  # One launcher at a time per persistent profile, without deleting it or trusting Chrome singleton reuse.
  $lock = [IO.File]::Open((Join-Path $profile '.juno-launch.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
  try {
    $marker = Join-Path $profile '.juno-profile.json'
    if (-not (Test-Path -LiteralPath $marker -PathType Leaf)) {
      if (@(Get-ChildItem -LiteralPath $profile -Force | Where-Object { $_.Name -ne '.juno-launch.lock' }).Count) {
        throw 'Existing nonempty profiles are forbidden unless originally created by this Juno launcher. Choose a new empty dedicated directory.'
      }
      '{"purpose":"juno-dedicated-chrome","version":1}' | Set-Content -LiteralPath $marker -Encoding UTF8
    } else {
      $markerData = Get-Content -LiteralPath $marker -Raw | ConvertFrom-Json
      if ($markerData.purpose -ne 'juno-dedicated-chrome' -or $markerData.version -ne 1) { throw 'Invalid Juno dedicated-profile marker.' }
    }
    if (Get-NetTCPConnection -State Listen -LocalPort $FixturePort -ErrorAction SilentlyContinue) { throw 'Fixture port is already in use; no stale reuse.' }
    foreach ($candidate in $candidates) {
      if (Get-NetTCPConnection -State Listen -LocalPort $candidate -ErrorAction SilentlyContinue) { continue }
      $ruleName = "Juno-CDP-$token-$candidate"
      New-NetFirewallRule -Name $ruleName -DisplayName 'Juno owned CDP run' -Direction Inbound -Action Allow -Protocol TCP -LocalPort $candidate -Program $chrome -RemoteAddress $DockerRemoteScope.Split(',') -Profile Any | Out-Null
      $firewall = $ruleName
      $arguments = (Get-JunoArguments $profile $candidate $token | ForEach-Object { ConvertTo-JunoArgument $_ }) -join ' '
      $process = Start-Process -FilePath $chrome -ArgumentList $arguments -PassThru
      $observed = Get-JunoProcess $process.Id
      $captureUntil = [DateTime]::UtcNow.AddSeconds(2)
      while (-not $observed -and [DateTime]::UtcNow -lt $captureUntil -and -not $process.HasExited) {
        Start-Sleep -Milliseconds 100
        $observed = Get-JunoProcess $process.Id
      }
      $owner = [pscustomobject]@{ Pid=$process.Id; CreationDate=if ($observed) { $observed.CreationDate } else { '' }; Profile=$profile; Port=$candidate; Token=$token }
      if (-not (Test-JunoIdentity $owner $observed)) { throw 'Cannot prove ownership of launched Chrome; refusing attachment.' }
      $until = [DateTime]::UtcNow.AddSeconds(15); $ready = $false
      while ([DateTime]::UtcNow -lt $until -and -not $process.HasExited) {
        try {
          $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $candidate -ErrorAction SilentlyContinue)
          if (-not $listeners.Count) { throw 'not listening' }
          foreach ($listener in $listeners) { if ([int]$listener.OwningProcess -ne $owner.Pid) { throw 'CDP listener is not owned by this Chrome process' } }
          $version = Invoke-RestMethod -Uri "http://127.0.0.1:$candidate/json/version/" -TimeoutSec 1
          if (-not $version.Browser -or -not $version.'Protocol-Version' -or $version.webSocketDebuggerUrl -notmatch '^ws://[^/]+/devtools/browser/[^/]+$') { throw 'Invalid CDP browser metadata' }
          $ready = $true; break
        } catch { Start-Sleep -Milliseconds 100 }
      }
      if ($ready) { break }
      Stop-JunoOwnedChrome $owner; $owner = $null
      Remove-NetFirewallRule -Name $firewall; $firewall = $null
    }
    if (-not $owner -or -not $ready) { throw 'No owned CDP browser became ready on the bounded candidate ports.' }
    Write-Output ("Ready: chrome.exe; owned browser; CDP port {0}; fixture port {1}" -f $owner.Port, $FixturePort)
    $env:JUNO_CDP_PORT = [string]$owner.Port; $env:JUNO_FIXTURE_PORT = [string]$FixturePort
    & docker.exe compose -p $project -f $compose up --build --abort-on-container-exit --exit-code-from cdp
    if ($LASTEXITCODE -ne 0) { throw 'Container smoke failed. Inspect CDP reachability, scoped firewall, and Docker Desktop networking.' }
  } finally {
    # PowerShell unwinds finally on errors and Ctrl-C. Forced host termination remains a manual gate.
    try { & docker.exe compose -p $project -f $compose down --remove-orphans | Out-Null }
    finally {
      try { Stop-JunoOwnedChrome $owner }
      finally {
        if ($firewall) { Remove-NetFirewallRule -Name $firewall -ErrorAction Continue }
        $lock.Dispose()
        $env:JUNO_CDP_PORT = $oldCdp; $env:JUNO_FIXTURE_PORT = $oldFixture
      }
    }
  }
}

if ($MyInvocation.InvocationName -ne '.') { Invoke-JunoRuntime }
