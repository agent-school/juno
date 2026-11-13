# Dedicated Windows Chrome runtime

Juno's attach client runs in a Linux container. Windows owns a separate persistent Chrome profile and process; the container contains no browser binary and needs no host Node.js or pnpm. This is a CDP transport, not a desktop viewer or an anti-bot bypass.

Prerequisites: Windows, Chrome Stable, Docker Desktop with Linux containers/Compose, and Windows PowerShell 5.1+ or PowerShell 7. Run the launcher from an elevated PowerShell because it creates and removes a temporary Windows Firewall rule. Obtain the Docker/WSL source IP or subnet from your actual network configuration; there is no safe universal subnet. An unknown scope fails closed. Never expose the CDP port to the Internet.

```powershell
./scripts/windows/test-start-juno-chrome.ps1
./scripts/windows/start-juno-chrome.ps1 `
  -ChromePath 'C:\Program Files\Google\Chrome\Application\chrome.exe' `
  -ProfileDir "C:\Juno O'Brien 学习\Chrome" `
  -Port 9222 -RetryPorts 9223,9224 -FixturePort 8931 `
  -DockerRemoteScope '<your actual Docker/WSL IP or CIDR>'
```

The launcher discovers Chrome in this order: explicit path, `JUNO_CHROME_PATH`, `Get-Command chrome.exe`, user and system Stable installation candidates. An explicit invalid override fails rather than silently selecting something else. It normalizes the profile, rejects normal Chrome/Chromium profiles and their ancestors/descendants, and rejects reparse-point and DOS short-name aliases. A profile lock prevents simultaneous launcher ownership. Choose an empty directory on first use; the launcher marks it as a dedicated Juno profile and refuses existing unmarked profiles. Chrome 136+ requires this non-default user-data directory for remote debugging. Spaces, apostrophes, Unicode and trailing separators are handled with Windows argument quoting.

At most three explicit CDP ports are tried, each after checking there is no existing listener. The launcher never attaches to an occupied port. It records the launched PID, creation time, exact profile/port arguments and run token, correlates the CDP listener with that owner, then checks `/json/version/`. Diagnostics report status and ports, without profile contents. The container validates metadata again and rewrites only the websocket authority to the trusted `host.docker.internal` route.

Compose uses a bridge network. The fixture is owned by Playwright inside the container, binds to `0.0.0.0` inside that container, and publishes only `127.0.0.1:<fixture-port>` on the Windows host. Host Chrome visits that loopback address. `reuseExistingServer: false` rejects stale servers. CDP uses `http://host.docker.internal:<cdp-port>`. A successful host probe with a failed container probe indicates a Docker Desktop/WSL routing or firewall problem; verify that boundary rather than changing to host networking or allowing all sources.

Playwright client disconnect does **not** shut down the host browser. The launcher owns browser shutdown: `finally` runs Compose teardown, re-validates the root process identity before stopping only that process tree, removes only this run's firewall rule, restores environment variables and releases the lock. It waits for the CDP port to release. Persistent profiles are never deleted. If ownership changes, cleanup refuses to kill the process. Forced PowerShell/host termination cannot guarantee `finally`; inspect the run-specific rule, Compose project and exact recorded Chrome identity manually. Never kill all processes named Chrome.

## Evidence and remaining Windows gates

Linux evidence: real dedicated Chrome attach → semantic read/fill/click → observed list item; disconnect and failed-navigation cleanup; browser-free metadata/deadline tests; PowerShell helper contracts on Linux. These do not establish Windows compatibility.

Run and record this matrix on Windows before marking RUNTIME-01/02/03/04/06 complete:

| Gate | Required observation |
|---|---|
| Discovery | Explicit, environment, PATH, user/system candidates; missing file rejection |
| Profiles | Daily-driver/ancestor/descendant/reparse rejection; non-default profile retained |
| Quoting | Spaces, apostrophes, Unicode and trailing separator all launch the exact profile |
| Ownership | Occupied port refused; bounded retries; PID/run-token mismatch cannot terminate unrelated Chrome |
| Networking | Local and container metadata probes; narrowly scoped rule; host-loopback fixture |
| Semantics | Default page attach, semantic read/benign action, independently observed list item |
| Normal/error | Compose exits; fixture/CDP ports release; temporary rule removed; profile retained |
| Interrupt | Ctrl-C during readiness, build and test; same cleanup and retained profile |
| Container stop | Stop the owned container during the run; launcher tears down only its resources |

There is no noVNC, stealth, CAPTCHA automation, daily-driver attachment, real-account workflow or general-site execution claim here.
