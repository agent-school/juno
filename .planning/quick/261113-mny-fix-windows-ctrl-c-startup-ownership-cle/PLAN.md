# Windows startup interruption cleanup

## Goal

Close the real Windows Ctrl-C window between Chrome launch and CIM ownership capture without weakening process identity checks. Record Windows evidence honestly, including the unverified firewall enforcement boundary.

## Tasks

1. Allocate the process object and record the selected port in cleanup scope before invoking its .NET Start method. If interrupted before ownership capture, reconstruct the candidate record and pass it through the existing fresh PID/creation/profile/port/token check before stopping anything. An allocated object that never started must be harmless to clean up.
2. Rerun helper contracts and the actual Windows readiness-interruption reproducer and full Docker Desktop semantic run on the pushed implementation.
3. Update runtime docs, requirements, roadmap and state with actual Windows observations and remaining firewall/backend gates. Settle PR checks.

## Acceptance

- Startup Ctrl-C no longer leaves the owned Chrome, CDP listener, firewall rule, profile lock or container behind.
- Persistent dedicated profile and unrelated Chrome survive.
- Launcher works without host Node/pnpm; exact process identity remains mandatory.
- Docker Desktop loopback forwarding is distinguished from firewall source-range enforcement. No claim of enforced filtering from a VM with firewall profiles disabled.
- Hosted research/memory behavior is preserved; no deployment is needed for this Windows-only fix.

## Evidence baseline

Windows verification session: https://app.devin.ai/sessions/8d866a58935d49ae8736fc5b4e00f0f3

Windows Server 2022 + Chrome Stable 157 + Docker Desktop 4.98 / WSL2: baseline startup interruption leaked owned Chrome 3/3 times. Proposed child patch leaked 0/3; the integrated variant must be retested by commit. Other documented real Windows lifecycle/discovery/profile/semantic cases passed. Firewall enforcement remains unverified.
