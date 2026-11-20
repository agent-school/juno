# Hosted UI verification and corrections

Date: 2026-11-13. User approved the offered **Test research & memory** action. Testing ran against `https://juno.agentschool.io` in isolated synthetic workspaces; no real-user workspace contents were changed.

## Findings and corrections

1. Fresh empty Research originally threw `Cannot read properties of undefined (reading 'status')`: both `task?.id` and `announcedTaskId` were undefined. This prevented Memory/default initialization. Commit `64ad9519a5d56a28ad94067d9d2ee558516e3a8b` requires a task before completion announcements. Two client-boundary unit checks execute the shipped JavaScript against a minimal DOM/fetch boundary: clean empty initialization and returning to empty Research after forgetting the last receipt.
2. The full UI run found a minor stale notice: a previous memory-forgotten message claimed source results remained after all research receipts had been deleted. Commit `18bcdf9c229a331c5043766433c146b10816d0e4` clears the transient Memory notice after a successful task-receipt deletion. The existing final-receipt check also asserts that notice is cleared.

## Verification

| Evidence | Result |
|---|---|
| Frontend syntax and `pnpm build` | Passed |
| Unit suite after empty-state correction | 54 passed: 37 browser + 17 lab, including two shipped-client regressions |
| Browser/HTTP integration suite | 19 passed: 15 browser + 4 lab |
| Lab unit suite after notice correction | 17 passed |
| CI on final implementation `18bcdf9` | `verify` and GitGuardian passed; Macroscope skipped; zero failed/pending |
| Full hosted UI run on `64ad951` | Fresh empty state, live filtered search, source details/timestamps/receipts, running/completed and HTTP-422 error presentation, explicit project/search memory, real shortlist refresh, recipe filters versus saved defaults, note correction/history, memory search/filter/forget, protected-workspace recovery/isolation, hash/Back/keyboard navigation and 390px controls passed |
| Browser lab UI regression on `64ad951` | Compile → five-action replay → independently verified result and full receipt; 409 ms, zero model calls |
| Unchanged-snapshot preservation on `64ad951` | Passed with temporary real-response instrumentation: open disclosures, query/recipe drafts and existing DOM retained; no mocked source data |
| Final targeted hosted UI run on `18bcdf9` | Created/forgot a temporary note, generated one real five-project research receipt, deleted the last receipt and returned to Memory without reload: stale notice absent, empty Research clean, saved project/recipe/defaults and existing verified lab receipt retained; final console empty |
| Final Coolify deployment | `jfdtc6bmvami8yqfavmgerzy`, finished; pinned to `18bcdf9c229a331c5043766433c146b10816d0e4`; valid HTTPS `/healthz` 200; deployed workspace.js SHA-256 matched local; same named `/data` storage retained |

Full-flow evidence was recorded on `64ad951`; the final targeted regression ran after reloading `18bcdf9`. The second implementation change only clears a cross-view transient notice. It does not alter task execution, memory retention, recovery or the browser lab.

## Evidence access

The consolidated report, one annotated full-flow recording and final screenshots were delivered in the [Devin session](https://app.devin.ai/sessions/d0f8409f16a04d4eb9746c4504fc750c). The recording opens at [hosted research and memory UI run](https://app.devin.ai/sessions/d0f8409f16a04d4eb9746c4504fc750c?testRecording=1021ee15-61ef-4589-954b-67a5022ca237). Screenshots additionally establish the final notice correction on `18bcdf9`. Deployment configuration evidence is in `261113-2ca-DEPLOYMENT.json`.

## Limits and remaining gates

- Live refresh returned no metadata changes. Nonzero diff rendering was not exercised through the UI; the prior controlled changed-source unit case remains separate evidence.
- Naturally long-running polling was not observed. Fast real searches required temporary response/refresh instrumentation for running-state timing and identical-snapshot preservation. This is not a claim that all changing snapshots preserve every draft.
- Partial/interrupted outcomes, physical mobile devices, additional Browser lab variants and export contents were not exercised in this UI run. Existing automated checks remain separate evidence.
- The pre-existing Codex feedback-confirmation finding remains excluded and unchanged, pending Jack's approval under the organization bot-response rule. Feedback persistence is distinct from its UI confirmation.
- Coolify still reports cached `exited:unhealthy` while valid public HTTPS/API checks pass. Host-level Docker health remains uninspected. The first immediate health request after the initial correction deployment returned 503, then passed without another deployment; readiness must be checked separately from deployment completion.
- Jack's own trial, general site compilation, the Phase 01.1 runtime, full Phase 2 guard and real Rolo/Canvas/Instagram integrations remain unfinished.
