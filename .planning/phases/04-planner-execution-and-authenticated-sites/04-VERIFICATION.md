---
phase: 04-planner-execution-and-authenticated-sites
status: partial
verified: 2026-11-18
implementation: a2c4cf7
---

# Phase 4 foundation and hosted integration evidence

The bounded execution foundation is accepted. The full phase and its broader requirements remain open.

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
