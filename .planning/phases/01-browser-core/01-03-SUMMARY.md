---
phase: 01-browser-core
plan: 03
subsystem: infra
tags: [semantic-actor, accessibility-tree, strict-locators, fail-safe, playwright, typed-errors, refs, e2e]

# Dependency graph
requires:
  - phase: 01-browser-core plan 01
    provides: BrowserSession (persistent Chrome), fixture HTTP server, error taxonomy base, strict-locator discipline
  - phase: 01-browser-core plan 02
    provides: SemanticPageReader (validated perception), SnapshotNode tree with eN refs, SnapshotParseError
provides:
  - "Two-layer reference model: durable SemanticRef {role, name, exact?, scopeChain?} + ephemeral EphemeralRef {ref, role, name?} with fresh-snapshot identity re-validation before every ephemeral action"
  - "SemanticActor — click, fill, selectOption, check, scrollIntoView, scrollViewport; every action wrapped in toGroundingError so raw Playwright errors never escape the public API"
  - "Completed error taxonomy: GroundingError base + GroundingTimeout (GROUNDING_TIMEOUT), AmbiguousReference (AMBIGUOUS_REFERENCE), StaleReference (STALE_REFERENCE) — the family Phase 2's safety guard will catch"
  - "Fail-safe proof under real DOM mutation: missing target, duplicate name, and stale ref all reject typed with zero activations (fixture task list = activation log)"
  - "Fixture server additions: /tall (below-fold target + live scroll indicator), /add-duplicate-button, /reset"
affects: [phase-2 safety guard (wraps SemanticActor), phase-4 planner/replay (acts through SemanticActor), phase-5 teach-by-showing (demonstrations compile to SemanticRefs)]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 6800    # ~27345 diff chars / 4, excluding .planning
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns: [scope-chain-only disambiguation (outermost-first container chaining, positional methods structurally banned), stale-ref re-validation via fresh-snapshot identity match before ephemeral action, error mapping at the action boundary (TimeoutError→GroundingTimeout, strict violation→AmbiguousReference, GroundingError family passthrough), activation-log fail-safe assertions in e2e]

key-files:
  created:
    - packages/browser/src/refs.ts
    - packages/browser/src/actor.ts
    - packages/browser/tests/unit/refs.test.ts
    - packages/browser/tests/e2e/acting.spec.ts
    - packages/browser/tests/e2e/failsafe.spec.ts
  modified:
    - packages/browser/src/errors.ts
    - packages/browser/src/index.ts
    - packages/browser/tests/fixtures/server.ts

key-decisions:
  - "EphemeralRef carries the captured semantic identity ({ref, role, name?}) — the artifact shorthand 'id string' cannot satisfy Pattern 3 rule 3 (confirm role+name of the INTENDED target); identity-less ids would reduce staleness checking to mere presence"
  - "resolveSemanticRef composes the chain outermost-first ending at the target (target resolves INSIDE its containers) — the plan's 'start from getByRole(role) and fold scopeChain' phrasing would invert the descendant relationship in Playwright's chaining model; unit test pins the corrected order"
  - "Endpoint mutations change server-side HTML, not the live DOM: removed-target and duplicate-name tests reload after the mutation; the stale-ref test removes the element via live DOM mutation (no reload) so ref counters stay stable — exactly the condition RESEARCH verified"
  - "toGroundingError passes non-grounding errors through unchanged (programming errors, unrelated Playwright failures) — only grounding-shaped failures map into the taxonomy; already-typed GroundingErrors pass through identity-preserving"
  - "Server mutation state is global and specs run sequentially (workers:1): failsafe.spec resets in beforeEach AND afterEach so later spec files (navigation, reading) see a clean page"
  - "Logs and error refDescriptions carry semantic role+name descriptions only — eN ids never appear in any description or message (T-1-09, Pitfall 4)"

patterns-established:
  - "Fail-safe discipline enforced structurally: no first/nth/last in src (grep-gated), ambiguity = AmbiguousReference, staleness = fresh-snapshot identity re-validation, never a guessed action"
  - "Activation-log testing: the fixture's observable side effects double as a proof that NO wrong element was activated during failed actions"
  - "Actor takes an optional shared SemanticPageReader so tests can read once and pass it in; defaults to constructing its own"

requirements-completed: [BRWS-03]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "Reference resolution layer: strict getByRole composition with scope-chain-only disambiguation, ephemeral aria-ref selector with id-shape validation, fresh-snapshot identity validation, typed error mapping"
    requirement: BRWS-03
    verification:
      - kind: unit
        ref: "packages/browser/tests/unit/refs.test.ts#folds the scope chain outermost-first — never positional disambiguation"
      - kind: unit
        ref: "packages/browser/tests/unit/refs.test.ts#rejects malformed ref ids with StaleReference"
      - kind: unit
        ref: "packages/browser/tests/unit/refs.test.ts#maps a Playwright TimeoutError shape to GroundingTimeout carrying the ref description"
      - kind: unit
        ref: "packages/browser/tests/unit/refs.test.ts#throws StaleReference when the ref now resolves to a different role"
    human_judgment: false
  - id: D2
    description: "All interaction types by semantic reference with observed page effects: fill+click (list effect), selectOption (state), check (checked), scrollIntoView (below-fold target), scrollViewport (wheel)"
    requirement: BRWS-03
    verification:
      - kind: e2e
        ref: "packages/browser/tests/e2e/acting.spec.ts#fills the textbox and clicks Add task — list effect observed"
      - kind: e2e
        ref: "packages/browser/tests/e2e/acting.spec.ts#selects an option by semantic ref and observes the state"
      - kind: e2e
        ref: "packages/browser/tests/e2e/acting.spec.ts#checks the checkbox by semantic ref"
      - kind: e2e
        ref: "packages/browser/tests/e2e/acting.spec.ts#scrolls a below-fold button into view by semantic ref"
      - kind: e2e
        ref: "packages/browser/tests/e2e/acting.spec.ts#scrolls the viewport with wheel input"
    human_judgment: false
  - id: D3
    description: "Fail-safe under DOM mutation: removed target → GroundingTimeout; duplicate accessible name → AmbiguousReference; stale ephemeral ref → typed rejection — all with zero activations (activation-log assertion)"
    requirement: BRWS-03
    verification:
      - kind: e2e
        ref: "packages/browser/tests/e2e/failsafe.spec.ts#removed target: click rejects with GroundingTimeout, nothing activated"
      - kind: e2e
        ref: "packages/browser/tests/e2e/failsafe.spec.ts#duplicate accessible name: click rejects with AmbiguousReference, nothing activated"
      - kind: e2e
        ref: "packages/browser/tests/e2e/failsafe.spec.ts#stale ephemeral ref: identity re-validated against a fresh snapshot, typed failure, nothing activated"
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-08-23
status: complete
---

# Phase 1 Plan 03: SemanticActor Summary

**Fail-safe action surface: every interaction type by semantic reference through the two-layer ref model — ambiguity and staleness always produce typed errors, proven under real DOM mutation with zero wrong-element activations.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2/2 complete
- **Files:** 5 created, 3 modified

## Accomplishments

- Reference layer (`refs.ts`): SemanticRef (durable, scope-chain disambiguation only) + EphemeralRef (eN id + captured identity, re-validated against a fresh snapshot before every action); `toGroundingError` maps TimeoutError → GroundingTimeout and strict-mode violations → AmbiguousReference at the boundary
- Completed error taxonomy: `GroundingError` base (Phase 2's guard catch-family) with three coded subclasses; errors carry semantic ref descriptions only — never eN ids
- `SemanticActor` (`actor.ts`): click / fill / selectOption / check / scrollIntoView (element) / scrollViewport (wheel) — auto-waiting locator actions only, no manual sleeps, raw Playwright errors never escape
- Fail-safe e2e proof under real mutation: removed target, duplicate accessible name, and stale ephemeral ref each reject typed with the fixture's activation log proving nothing was activated
- Full phase suite green together: 31 unit + 15 e2e, typecheck clean, all grep gates pass

## Task Commits

1. **Task 1: Reference resolution layer** — RED `fc67b81` (test), GREEN `2a76115` (feat)
2. **Task 2: SemanticActor + fail-safe proof** — `10ec94c` (feat)

## Files Created/Modified

- `packages/browser/src/refs.ts` — two-layer ref model, resolvers, validateFresh, toGroundingError, describeRef
- `packages/browser/src/actor.ts` — SemanticActor action surface
- `packages/browser/src/errors.ts` — GroundingError family added
- `packages/browser/src/index.ts` — full public API exports
- `packages/browser/tests/unit/refs.test.ts` — 18 unit tests
- `packages/browser/tests/e2e/acting.spec.ts` — 5 acting tests
- `packages/browser/tests/e2e/failsafe.spec.ts` — 3 fail-safe tests
- `packages/browser/tests/fixtures/server.ts` — /tall, /add-duplicate-button, /reset; shared addTask binding

## Decisions Made

See key-decisions above. Primary: EphemeralRef carries captured identity (the id-only reading cannot satisfy Pattern 3 rule 3), and scope-chain composition runs outermost-first so the target resolves inside its containers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Scope-chain locator composition inverted**
- **Found during:** Task 1 (RED→GREEN cycle)
- **Issue:** Composing target-first then folding scopes produces `target.getByRole(scope)` = scope INSIDE target — the opposite of the plan's own behavior spec ("resolves inside a getByRole-scoped container chain")
- **Fix:** Chain = scopeChain (outermost first) then target; the unit test pins the order
- **Files:** `packages/browser/src/refs.ts`
- **Verification:** unit suite green; scope-chain test asserts list > listitem > button composition
- **Commit:** `2a76115`

**2. [Rule 3 - Blocking] Endpoint mutation does not mutate the live page**
- **Found during:** Task 2 (first e2e run — all three failsafe tests resolved instead of rejecting)
- **Issue:** POST /remove-button changes server-side HTML; the already-loaded page keeps the button, so clicks succeeded
- **Fix:** removed-target and duplicate-name tests reload after the mutation; the stale-ref test removes the element from the live DOM (no reload) so ref counters stay stable — the exact condition RESEARCH verified
- **Files:** `packages/browser/tests/e2e/failsafe.spec.ts`
- **Verification:** failsafe 3/3 green with typed-error + zero-activation assertions
- **Commit:** `10ec94c`

**Total deviations:** 2 auto-fixed. **Impact:** none beyond test mechanics; the src API is unchanged from the plan's contract.

## Self-Check: PASSED

- All 5 created files exist on disk; 3 task commits verified in git history
- Full unit suite: 31/31; full e2e suite: 15/15 (navigation ×3, persistence, profile-lock, reading ×2, acting ×5, failsafe ×3); `tsc --noEmit` clean
- `grep -rn "\.(first|nth|last)\(" packages/browser/src` → zero matches (positional disambiguation structurally absent)
- `waitForTimeout` anywhere in packages/browser → zero matches; `page.evaluate` in src → zero matches; `internal:aria-ref` in src → zero matches
- Raw Playwright error classes never propagate past the public API — asserted by the typed-error expectations in failsafe.spec.ts
