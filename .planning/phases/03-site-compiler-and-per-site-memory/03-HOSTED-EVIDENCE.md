# Hosted typed-knowledge validation — 2026-11-13

Implementation e2aa22df49800d50a10f0bd4ba279b142401037d deployed through Coolify to https://juno.agentschool.io. Deployment nzrhs3ncrwb3okfgrtgbdb3w finished; the pinned commit, HTTPS health, app.js SHA-256 and unchanged /data volume were checked. Coolify's cached unhealthy badge still differs from successful public checks; it is not treated as outage evidence.

Recorded UI run in isolated synthetic workspaces passed typed contract inspection, model persistence after reload, five-action verified replay with value-free audit, reordered-field replay, renamed-label failure before mutation, explicit recompile with new revision, site history, forgetting with receipts retained, post-forget rejection, recompile recovery and 390px verified replay. Research/remember/refresh, note correction/history and recovery in fresh browser profiles passed. Prior synthetic data survived the upgrade; the old test passphrase was unavailable, so recovery used a newly protected synthetic workspace rather than reauthenticating the old one.

Primary recording: https://app.devin.ai/sessions/d0f8409f16a04d4eb9746c4504fc750c?testRecording=48fc0b89-26ef-4fa0-ad00-9a7add1e397e

CI verify, Windows PowerShell helper contracts and GitGuardian passed on e2aa22d. The Windows helper CI found hidden AppData ancestors require Get-Item -Force; the fix passed the Windows rerun. This is helper evidence, not actual Windows Chrome/Docker Desktop lifecycle evidence. The automated review service skipped its correctness check due its configured per-review budget; no budget setting was changed.

Still untested in this UI run: Windows Desktop, physical mobile, external accounts/sites, destructive confirmation UI, duplicate/no-effect variants, nonzero research diffs and interruption. The standard browser/API suite covers duplicate/no-effect behavior. The known feedback-confirmation handler remains excluded pending separate approval. No real-user data was changed.

Final follow-up 095481119b579979c5c19f4d68c70380b32d43da adds stricter malformed-contract validation and roadmap copy. Eight knowledge unit tests, Browser lab API replay, typechecks and final CI pass (92 total unit tests, 20 standard browser/API tests). Deployment uvkvvrbshe0f3bvdcvtwp8sb finished with unchanged /data volume, HTTPS health and matching app.js/index.html hashes. The recorded UI evidence above remains on e2aa22d; this follow-up did not change valid fixture execution.
