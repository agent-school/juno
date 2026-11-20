# Dedicated Windows Chrome runtime

Juno's attach client runs in a Linux container. Windows owns a separate persistent Chrome profile and process; the container contains no browser binary and needs no host Node.js or pnpm. This is a CDP transport, not a desktop viewer or an anti-bot bypass.

Prerequisites: Windows, Chrome Stable, Docker Desktop with Linux containers/Compose, and Windows PowerShell 5.1+ or PowerShell 7. Run the launcher from an elevated PowerShell because it creates and removes a temporary Windows Firewall rule. Supply an explicit source IP/CIDR based on your actual backend; there is no universal Docker/WSL subnet. An unknown scope fails closed. Never expose the CDP port to the Internet.

The tested Windows Server 2022 / Docker Desktop 4.98 WSL2 backend proxies `host.docker.internal` to Chrome's loopback listener through `com.docker.backend`. Chrome sees source `127.0.0.1`, rather than the WSL subnet, on that configuration. Both a WSL-subnet rule and a loopback rule allowed the tested connection, but all firewall profiles on the test VM were disabled: this proves connectivity and rule lifecycle, **not firewall enforcement**. The observed isolation boundary is Chrome's loopback listener and Docker Desktop's host proxy. Same-machine processes and containers able to use that proxy are inside the trust boundary. Do not generalize these observations to another backend or expose CDP on a LAN address.

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

Compose uses a bridge network. The fixture is owned by Playwright inside the container, binds to `0.0.0.0` inside that container, and publishes only `127.0.0.1:<fixture-port>` on the Windows host. Host Chrome visits that loopback address. `reuseExistingServer: false` rejects stale servers. CDP uses `http://host.docker.internal:<cdp-port>`. A successful host probe with a failed container probe can indicate Docker Desktop routing, backend, Host-header or filtering differences. Inspect the actual listener, proxy/source addresses and metadata response rather than changing to host networking or allowing all sources. The scoped rule remains required by the current launcher; its presence alone does not establish a filtering boundary.

Playwright client disconnect does **not** shut down the host browser. The launcher owns browser shutdown: `finally` runs Compose teardown, re-validates the root process identity before stopping only that process tree, removes only this run's firewall rule, restores environment variables and releases the lock. A `System.Diagnostics.Process` object is retained before its .NET `Start()` call: cleanup does not depend on a cancellable `Start-Process` cmdlet returning its object. If Ctrl-C interrupts the initial CIM ownership capture, cleanup reconstructs the candidate record and still performs the fresh exact identity check. An allocated object that never started is harmless; owned process handles are disposed after cleanup. It waits for the CDP port to release. Persistent profiles are never deleted. If ownership changes, cleanup refuses to kill the process. Forced PowerShell/host termination cannot guarantee `finally`; inspect the run-specific rule, Compose project and exact recorded Chrome identity manually. Never kill all processes named Chrome.

## Evidence and remaining Windows gates

Linux evidence: real dedicated Chrome attach → semantic read/fill/click → observed list item; disconnect and failed-navigation cleanup; browser-free metadata/deadline tests; PowerShell helper contracts on Linux.

Actual Windows evidence now exists from Windows Server 2022 build 20348.5622, Windows PowerShell 5.1, Chrome Stable 157.0.8103.79 and Docker Desktop 4.98 / Engine 29.9.2 / Compose 5.6.1 / WSL2. Discovery, real junction/symlink/8.3 rejection, special-character profile reuse, occupied-port retries, real identity-mismatch refusal, container bridge semantics, disconnect survival and normal/error/build-interrupt/test-interrupt/container-stop cleanup passed. The launcher ran with Node and pnpm absent from host PATH. The original startup Ctrl-C case leaked Chrome 3/3 times; final correction `67b6098` passed 12/12 real Chrome interruption trials, full semantic execution, bounded port retries/refusal, actual native launch failure and the later interruption/container-stop cases. See `01.1-WINDOWS-EVIDENCE.md` for the probe and harness limitations.

Chrome inherits the launcher's standard streams with the direct .NET launch, so its diagnostics may appear in the console. If forced host termination leaves Chrome alive, it may also keep a redirected pipe open; inspect and stop only the recorded owned browser. Graceful Ctrl-C and the tested failure paths cleaned up both processes and resources.

An independent observed list item verifies the action's consequence, rather than trusting that click resolved. A second CDP client is not required by this semantic tracer; this is still a synthetic-fixture check, not verification against an external application API. Windows 10/11, other Docker backends and enabled-firewall enforcement remain unverified. Keep RUNTIME-03 open.

Repeat and record this matrix when validating another Windows/browser/backend configuration:

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
