---
phase: 04-planner-execution-and-authenticated-sites
status: partial
verified: 2026-11-20
implementation: ee6213e
---

# Phase 4 foundation and hosted integration evidence

The bounded execution foundation is accepted. The full phase and its broader requirements remain open.

Sections below record acceptance chronologically. The latest 04-04 evidence supersedes earlier provider-configuration and UI Stop gaps; earlier counts and limits describe their named revisions.

| Gate | Observed evidence | Scope |
|---|---|---|
| Typed intent and lifecycle boundaries | Twenty-one agent unit tests cover proposals, internal keys, invalid inputs, model/contract mismatch, cancellation, provider transport, journal integrity/exclusion and failed-workspace cleanup | Live provider check returned HTTP 401; no live model success claimed |
| Composition | Create contact → independently verify record → add dependent follow-up → independently verify second record | Owned three-page application, explicit contracts |
| Repeatability | `pnpm agent:demo` twice: same task ID; first invocation two writes/two records; next invocation zero writes/two records | Verified across separate local processes and separate Docker containers with the same named volume |
| Semantic resilience | Reordered controls compile to the same stored version and execute; renamed/ambiguous controls produce zero mutations | No fuzzy rebinding or automatic repair |
| Consequence verification | Fake success produces `uncertain`; downstream operation stays pending; malformed proof cannot authorize success | Independent application records, not page acknowledgments |
| Crash/abort recovery | Abort after commit and actual worker SIGKILL recover the existing effect and perform only the remaining operation | Worker closes owned Chrome before SIGKILL; not a host power-loss guarantee |
| No blind retry | Absent effects after a mutation, and loss of a previously verified effect, both stop without resubmission | Request identity is immutable; different request IDs are separate intents |
| Authority | Saved benign labels do not authorize writes without host policies; benign policies match exact URLs, with optional exact host-reviewed search/fragment fields | Five URL-scope guard regressions plus Browser lab requestId replay pass |
| Network defense | Default-denied POSTs require an audited, action-bound, expiring one-shot exact JSON capability; unsolicited scripts, altered/reused/revoked requests, external and read-only writes are blocked | HTTP read/POST redirects are refused without following them; defense in depth, not a general sandbox |

Commands executed on the implementation:

```sh
pnpm build
pnpm test                  # 141 unit tests
pnpm test:e2e              # 23 tests, including the 19-condition agent benchmark
pnpm exec tsx scripts/test-cdp-linux.mts  # 2 native CDP tests
pnpm agent:demo            # 2 writes
pnpm agent:demo            # 0 additional writes
pnpm agent:benchmark --trace
docker build -t juno-agent-check:local .
docker run --rm --init -v juno-agent-validation:/data juno-agent-check:local pnpm agent:demo
docker run --rm --init -v juno-agent-validation:/data juno-agent-check:local pnpm agent:demo
docker run --rm --init -v juno-agent-validation:/data juno-agent-check:local pnpm agent:benchmark
```

Chrome benchmark: 19/19 checks, 9.76 seconds on Node 24.22.2/Linux, zero model calls. Bundled Chromium container benchmark: 19/19 checks. These are fixture assertions, not arbitrary-site task success rates. Artifact directories are ignored; receipts record expected fields, proof source/key, input hashes, before/after structural observations, audit entries and recovery.

Review follow-up 816ffe8: reproduced missing fixture cleanup with a failing embedded-benchmark lifecycle test, four benign query/fragment leaks with guard tests, and unguarded approved-path POST access with a real browser canary (17/18 before, 19/19 after the expanded fixes). Direct CLI corruption already exited under Node 24's fatal error handling; its new subprocess check preserves that behavior, while both entrypoints now release owned resources even if store construction fails. Store initialization also closes its SQLite connection on failure. The Browser lab explicitly supplies its host-generated requestId query; it does not derive permission from the live page. HTTP redirects are refused because Playwright's route handler only sees the first hop. Unsolicited valid page-script POSTs on load and submit are exercised during the composed task. Full checks and the rebuilt persistent-volume Docker demo/benchmark pass.

Existing environment setup already supplies Node 24/pnpm/Chrome; no new external dependencies, tools or blueprint changes are needed. SQLite comes from Node. Docker explicitly sets the agent's writable data directory and bundled-browser channel. The 04-01 increment left the hosted workbench at 0954811; 04-02 deployment is recorded below.

## 04-02: Hosted frontend/backend

Accepted implementation: d2195e5 plus shutdown correction a2c4cf7. The existing public application at https://juno.agentschool.io now exposes the runtime; [usage](../../../docs/HOSTED-AGENT.md), [summary and limits](04-02-SUMMARY.md).

| Gate | Observed evidence | Scope |
|---|---|---|
| Reviewed execution | Hosted API and recorded UI save exact typed inputs before explicit run; two semantic operations independently verify | Owned synthetic contact/follow-up adapter only |
| Evidence and recovery | Browser PNG, receipt/audit, stored records, reload/history/recheck, UI Stop/resume and uncertain fake-success resume pass | Same saved request; no duplicate replay writes |
| Ownership and input boundaries | Separate workspace cannot retrieve a task/frame/receipt; arbitrary URL/plan/credential fields and cross-site commands rejected | Existing workspace cookie identity; private loopback bearer token |
| Persistent memory | Local replacement and real Coolify redeploy retain task/journal/frame/knowledge/report/research note; forget invalidates old plans, observe/new review restores execution | Same `/data` volume and workspace identity |
| Reliability controls | UI stop retains honest partial evidence; second UI-started job and downloaded JSON report 19/19, Chromium and zero model calls | Existing controlled matrix; not external-site success rate |
| Preparation lifecycle | Three new controlled unit cases hold browser/fixture cleanup, assert abort propagation, delayed close completion, no new workers or plans after shutdown | Real OS kill/power loss is outside this test |
| Client interaction | Real-poll draft/focus/caret/disclosure preservation; fast navigation; Research/Memory regression; 390px keyboard typed review | Emulated viewport, not physical mobile or Windows UI |

Final implementation validation: `pnpm typecheck`, `pnpm test` (146 tests), all 30 browser/API tests and two CDP tests pass; CI also passes. The lifecycle follow-up separately reran the 11-test lab suite, including the 19/19 job, and Docker build. Existing full repository CI runs build/unit/E2E/CDP and Windows launcher contracts.

Production deployed a2c4cf7 in Coolify job `3wbopiyho1yqswkd8ljcntos`; the previous d2195e5 deployment established the pre-replacement canary. Verified HTTPS `/healthz`, matching `app.js`, `agent.js`, `agent.css` SHA-256 hashes, exact configured implementation SHA and unchanged persistent-volume identity. Production replay after replacement added zero writes. Coolify's cached `exited:unhealthy` remains a monitoring discrepancy, not a measured HTTPS outage. Private HTTP evidence/cookies are kept outside git under the session's `juno-agent-http-evidence`; no credentials are included in this ledger.

The primary annotated UI evidence is attached to the [session](https://app.devin.ai/sessions/d0f8409f16a04d4eb9746c4504fc750c?testRecording=c8594148-0221-4c02-8b3a-17d508aab3c1). Not independently driven in this UI run: five-job cap, standalone ambiguous/injection/follow-up-renamed trials, preparation shutdown, physical mobile, Windows UI, configured language planning and feedback submission. Ambiguity/injection are included in the matrix. No new dependencies or blueprint changes were required.

Remaining acceptance: live model authentication and interpretation, user-selected real-site adapters, protected sessions and auth expiry, dynamic field discovery, structured page extraction, safe interactive approval, evidence-based repair/alternate paths and broader compiler validation. RUNTIME-03 firewall enforcement remains open independently.

## 04-03: General public-web tasks

Accepted implementation: 5a6da72, review corrections f7d48d8, hosted selection correction 53386ed. [Scope and remaining limits](04-03-SUMMARY.md). This extends source reading/navigation across public websites; general authenticated/mutating execution is not accepted.

| Gate | Observed evidence | Scope |
|---|---|---|
| General goal representation | Main Agent accepts goal, optional websites and explicit mode; contact fields exist only under Engine tests | Goal interpretation requires a configured provider; no hard-coded task routing |
| Semantic composition | Browser fixture follows product pricing and unrelated admissions pages, compares/extracts with exact source quotes, rejects invented quotes/raw actions | Controlled interpreter, not live provider success |
| Public network boundary | Private/reserved/mapped IPs, mixed DNS results, credentials/action URLs, browser POST and metadata/private redirects rejected; fragment-bearing safe redirect chains succeed | DNS-pinned HTTP transport, bounded browser/proxy/UDP restrictions; no OS/firewall acceptance claim |
| Durable backend | Owner isolation, inert immutable review, shared browser exclusion, stop/cleanup, interrupted restart state and no implicit replay pass | 157 unit tests and 35 repository browser/API tests; general browser tests also pass in Docker |
| Real sources and memory | Actual Chrome reads Playwright, Puppeteer and Python documentation; captures text/links, screenshots and per-domain structure | Public source collection; no generated completion claim |
| Replacement persistence | Local container and real Coolify replacement retain exact task receipt, source pages, knowledge, screenshot and personal note; replay refused | Same workspace and unchanged `/data` volume |
| Hosted interface | Corrected older-task reload, composer reload, explicit source runs, source/receipt inspection, follow-up dependency and deletion flow, memory forgetting with retained evidence, private/credential rejection, Research/Memory/Engine navigation pass | Recorded real Chromium on 53386ed; no real accounts |
| Interaction | 390px keyboard review and wrapping pass; five real polls preserve draft/focus/caret, three preserve source disclosure | Emulated viewport and passive polling measurements, not physical mobile/Windows |

Coolify job `j4sfhoivwmame0ibkyiq41gk` deployed f7d48d8 and passed live replacement persistence. Job `pimudrto0ejivojcsoosdiwg` deployed 53386ed and passed HTTPS, configured commit, six asset hashes and unchanged volume identity. Coolify's cached `exited:unhealthy` remains inconsistent with live checks. [Primary final annotated UI recording](https://app.devin.ai/sessions/d0f8409f16a04d4eb9746c4504fc750c?testRecording=ba0a6a52-598c-4f58-82ea-4406cb3d4292); the interrupted pre-correction recording is superseded.

UI Stop was not exercised because the task finished before the click; synthetic runtime/service/API cancellation checks pass. Successful provider-backed search/planning/answers and generated answer/table UI are untested after the stored key's HTTP 401; production intentionally reports no configured model. Evidence mode is independently usable and explicitly states that no interpretation occurred. Public search may encounter challenges. Authenticated sessions, arbitrary external mutations, executable operation discovery, teaching, general repair, desktop control and firewall enforcement remain open. Existing environment setup sufficed; no blueprint update was needed. No merge was performed.

## 04-04 — Live model research and source review

[Live acceptance record and deployed revision](04-04-SUMMARY.md). Bedrock authentication, live goal-driven public reading and reviewed answers were demonstrated. Historical UI trials include comparison, follow-up, Stop and durable history. Later trials exposed that exact quote provenance can still accompany wrong version scope and that bounded correction can exhaust its allowance. Separate classification reduces that risk while retaining honest failures. This gate remains partial until comparison, follow-up and discovery are repeatable on the current deployment. No authenticated-site or operating-system firewall acceptance was added.
