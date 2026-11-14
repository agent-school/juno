---
phase: 04-planner-execution-and-authenticated-sites
status: partial
verified: 2026-11-14
implementation: 816ffe8
---

# Phase 4 foundation evidence

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

Existing environment setup already supplies Node 24/pnpm/Chrome; no new external dependencies, tools or blueprint changes are needed. SQLite comes from Node. Docker explicitly sets the agent's writable data directory and bundled-browser channel. The hosted workbench remains at 0954811 with no deployment or storage change in this increment.

Remaining acceptance: live model authentication and interpretation, user-selected real-site adapters, protected sessions and auth expiry, dynamic field discovery, structured page extraction, safe interactive approval, evidence-based repair/alternate paths and broader compiler validation. RUNTIME-03 firewall enforcement remains open independently.
