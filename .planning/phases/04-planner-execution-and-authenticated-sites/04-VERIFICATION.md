---
phase: 04-planner-execution-and-authenticated-sites
status: partial
verified: 2026-11-14
implementation: bf1ec85
---

# Phase 4 foundation evidence

The bounded execution foundation is accepted. The full phase and its broader requirements remain open.

| Gate | Observed evidence | Scope |
|---|---|---|
| Typed intent boundary | Nineteen agent unit tests cover proposal validation, unknown/raw operations, internal keys, invalid inputs, model/contract mismatch, cancellation, provider transport and journal integrity/exclusion | Live provider check returned HTTP 401; no live model success claimed |
| Composition | Create contact → independently verify record → add dependent follow-up → independently verify second record | Owned three-page application, explicit contracts |
| Repeatability | `pnpm agent:demo` twice: same task ID; first invocation two writes/two records; next invocation zero writes/two records | Verified across separate local processes and separate Docker containers with the same named volume |
| Semantic resilience | Reordered controls compile to the same stored version and execute; renamed/ambiguous controls produce zero mutations | No fuzzy rebinding or automatic repair |
| Consequence verification | Fake success produces `uncertain`; downstream operation stays pending; malformed proof cannot authorize success | Independent application records, not page acknowledgments |
| Crash/abort recovery | Abort after commit and actual worker SIGKILL recover the existing effect and perform only the remaining operation | Worker closes owned Chrome before SIGKILL; not a host power-loss guarantee |
| No blind retry | Absent effects after a mutation, and loss of a previously verified effect, both stop without resubmission | Request identity is immutable; different request IDs are separate intents |
| Authority | Saved benign labels do not authorize writes without host policies; page instructions have no authority | Existing guarded actor remains the action boundary |
| Network defense | External canary and valid read-only POST are blocked; exact route/resource lists; service workers blocked by the owned browser factory | Defense in depth, not a general sandbox |

Commands executed on the implementation:

```sh
pnpm build
pnpm test                  # 134 unit tests
pnpm test:e2e              # 23 tests, including the 17-condition agent benchmark
pnpm exec tsx scripts/test-cdp-linux.mts  # 2 native CDP tests
pnpm agent:demo            # 2 writes
pnpm agent:demo            # 0 additional writes
pnpm agent:benchmark --trace
docker build -t juno-agent-check:local .
docker run --rm --init -v juno-agent-validation:/data juno-agent-check:local pnpm agent:demo
docker run --rm --init -v juno-agent-validation:/data juno-agent-check:local pnpm agent:demo
docker run --rm --init -v juno-agent-validation:/data juno-agent-check:local pnpm agent:benchmark
```

Chrome benchmark: 17/17 checks, 10.93 seconds on Node 24.22.2/Linux, zero model calls. Bundled Chromium container benchmark: 17/17 checks. These are fixture assertions, not arbitrary-site task success rates. Artifact directories are ignored; receipts record expected fields, proof source/key, input hashes, before/after structural observations, audit entries and recovery.

Existing environment setup already supplies Node 24/pnpm/Chrome; no new external dependencies, tools or blueprint changes are needed. SQLite comes from Node. Docker explicitly sets the agent's writable data directory and bundled-browser channel. The hosted workbench remains at 0954811 with no deployment or storage change in this increment.

Remaining acceptance: live model authentication and interpretation, user-selected real-site adapters, protected sessions and auth expiry, dynamic field discovery, structured page extraction, safe interactive approval, evidence-based repair/alternate paths and broader compiler validation. RUNTIME-03 firewall enforcement remains open independently.
