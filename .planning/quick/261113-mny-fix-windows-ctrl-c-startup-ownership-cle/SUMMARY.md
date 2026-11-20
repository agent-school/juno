# Windows runtime verification and interruption cleanup

## Result

Actual Windows Server 2022 / Chrome Stable 157 / Docker Desktop 4.98 WSL2 verification is recorded in the phase's `01.1-WINDOWS-EVIDENCE.md`. The hosted service is unchanged by these launcher corrections.

Two independently reproduced Windows races were fixed:

1. Ctrl-C after Chrome starts but before CIM ownership capture previously skipped browser cleanup (3/3 baseline leaks). Cleanup now reconstructs ownership from the retained process and selected port, then performs the unchanged fresh exact identity check.
2. Start-Process itself could be cancelled after spawning but before returning its process object (30/30 mechanism-probe trials). A preallocated .NET Process is now retained before Start(), so cleanup does not depend on the cmdlet returning. Never-started objects are handled safely and handles are disposed.

Final functional commit: `67b6098fe2197c3c08c1a598004f2657d3400a2a`.

## Verification

- Real Chrome startup interruption sweep: 12/12 passed, with owned Chrome observed before interruption and absent after cleanup.
- Final full special-character-profile run: both semantic/cleanup tests passed with Node and pnpm absent from Windows PATH.
- Actual port retry/refusal, native launch failure, build/test Ctrl-C and container stop passed, preserving the original error on failed launch.
- Dedicated profile/marker remained; lock released; unrelated Chrome survived. No run-owned Chrome, rule, container, network or tested listener remained.
- .NET mechanism stress probe: no orphaned process across two trials with 2,027 starts. This is distinct from the 12 actual Chrome trials; it does not directly target Chrome's exact native instruction.
- Linux PowerShell 7.4.22 helper contracts and functional-commit CI passed. Final documentation-only CI is checked separately before reporting completion.

## Remaining scope

RUNTIME-01/02/04/05/06 are verified for the tested configuration and documented paths. RUNTIME-03 remains open: every firewall profile on the Windows VM was disabled. Rule lifecycle/connectivity do not establish allow/deny enforcement, and the tested Docker Desktop backend forwards through loopback rather than presenting the WSL subnet to Chrome.

Forced PowerShell/host kill, Windows 10/11 and other Docker backends remain unverified. Inherited Chrome stdio and the test harness's initial Unicode-path false-negative columns are documented in the phase evidence. No external accounts or real mutations were used.

## Reusable setup

The existing Linux blueprint already retains Node 24.22.2, pnpm 11.24.0 and verified PowerShell 7.4.22; it needs no additional tooling for this fix. Windows prerequisites are elevated PowerShell 5.1, explicit Chrome Stable and Docker Desktop with a working WSL2 Linux-container backend. The Windows session attached a reproducible prerequisite checklist and harness. An unattended fresh Windows bootstrap was not validated, so no speculative Windows installer commands were added to the blueprint. Persistent profiles are deliberately retained.
