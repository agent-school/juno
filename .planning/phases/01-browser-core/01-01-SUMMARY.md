---
phase: 01-browser-core
plan: 01
subsystem: infra
tags: [playwright, pnpm, monorepo, chrome, accessibility-tree, persistent-profile, zod, pino, vitest]

# Dependency graph
requires:
  - phase: none (greenfield — first plan in the project)
    provides: n/a
provides:
  - pnpm monorepo scaffold (workspace root, tsconfig.base, root vitest config)
  - "@juno/browser package with BrowserSession facade (launch/goto/close)"
  - "Persistent profile management: resolveProfileDir() (JUNO_PROFILE_DIR override, default ~/.juno/profile), ProcessSingleton lock guard → ProfileInUseError"
  - "zod URL validation boundary at session.goto (http/https scheme allowlist)"
  - "Typed error taxonomy: ProfileInUseError, InvalidUrlError"
  - "Deterministic fixture HTTP server on 127.0.0.1:8931 for e2e tests"
  - "No-stealth doctrine gate (unit test enforcing the dependency blocklist)"
affects: [01-browser-core plans 02/03, phase-2 safety-guard, phase-4 replay, all future @juno/* packages]

# Actuals (#2632) — pairs with the plan's estimate to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 17000    # ~68025 diff chars / 4, excluding .planning
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: [playwright@1.62.1, "@playwright/test@1.62.1", zod@4.4.3, yaml@2.9.0, pino@10.3.1, vitest@4.1.11, tsx@4.x, typescript@~5.9, pnpm@10.33.0 workspace]
  patterns: [BrowserSession facade over chromium.launchPersistentContext, zod validation at trust boundaries, typed error taxonomy (raw Playwright errors never escape the public API), strict semantic locators only (no first/nth/last), pino structured audit logging with basename-only profile references]

key-files:
  created:
    - pnpm-workspace.yaml
    - package.json
    - tsconfig.base.json
    - vitest.config.ts
    - packages/browser/package.json
    - packages/browser/tsconfig.json
    - packages/browser/playwright.config.ts
    - packages/browser/vitest.config.ts
    - packages/browser/src/index.ts
    - packages/browser/src/session.ts
    - packages/browser/src/profile.ts
    - packages/browser/src/errors.ts
    - packages/browser/tests/e2e/navigation.spec.ts
    - packages/browser/tests/e2e/persistence.spec.ts
    - packages/browser/tests/e2e/profile-lock.spec.ts
    - packages/browser/tests/unit/no-stealth-deps.test.ts
    - packages/browser/tests/fixtures/server.ts
  modified: [.gitignore]

key-decisions:
  - "E2e specs launch headless:true (Chrome new-headless via channel:'chrome') while BrowserSession's default stays headed — display-less CI environment, anti-bot posture preserved in the product default"
  - "No-stealth gate test resolves the workspace root by walking up to pnpm-workspace.yaml instead of hard-coded relative depth, so future package moves cannot break it"
  - "Package-level vitest.config.ts added so the plan's in-package verify command works from packages/browser (root config covers monorepo-wide runs)"
  - "Fixture server holds remove-button state in a module variable — simple, deterministic, sufficient for Plan 03 failsafe tests"

patterns-established:
  - "Zod validation at every trust boundary: user URLs validated at session.goto before any navigation"
  - "Typed error boundary: ProcessSingleton failures map to ProfileInUseError; raw Playwright errors never leak past session.ts"
  - "Logging discipline: pino structured events (launch/goto/close) referencing only url/channel/headless/profile-basename — never cookie/storage/profile contents"
  - "Test isolation: every spec mks a fresh temp profile dir and cleans it in afterEach; fullyParallel:false + workers:1 because persistent profiles are single-owner"

requirements-completed: [BRWS-01, BRWS-04]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "Validated URL loads and navigates in a real persistent Chrome session (BrowserSession launch/goto/close)"
    requirement: BRWS-01
    verification:
      - kind: e2e
        ref: "packages/browser/tests/e2e/navigation.spec.ts#loads a validated URL, reads one a11y snapshot, and acts by semantic ref"
        status: pass
      - kind: e2e
        ref: "packages/browser/tests/e2e/navigation.spec.ts#public-site smoke navigation: example.com"
        status: pass
    human_judgment: false
  - id: D2
    description: "One real semantic read: ariaSnapshot ai-mode YAML parsed into a typed tree containing the expected button node"
    requirement: BRWS-01
    verification:
      - kind: e2e
        ref: "packages/browser/tests/e2e/navigation.spec.ts#loads a validated URL, reads one a11y snapshot, and acts by semantic ref (treeContainsNode assertion)"
        status: pass
    human_judgment: false
  - id: D3
    description: "One real semantic action: strict getByRole fill+click with an observable DOM effect (list item 'hello juno')"
    requirement: BRWS-01
    verification:
      - kind: e2e
        ref: "packages/browser/tests/e2e/navigation.spec.ts#loads a validated URL, reads one a11y snapshot, and acts by semantic ref (toContainText 'hello juno')"
        status: pass
    human_judgment: false
  - id: D4
    description: "URL validation boundary rejects non-http schemes (javascript:, file:, garbage) with InvalidUrlError before navigation"
    requirement: BRWS-01
    verification:
      - kind: e2e
        ref: "packages/browser/tests/e2e/navigation.spec.ts#rejects non-http URLs with InvalidUrlError before any navigation"
        status: pass
    human_judgment: false
  - id: D5
    description: "Dedicated persistent profile: localStorage state survives full session close plus relaunch on the same dir"
    requirement: BRWS-04
    verification:
      - kind: e2e
        ref: "packages/browser/tests/e2e/persistence.spec.ts#localStorage written to the profile survives full close and relaunch"
        status: pass
    human_judgment: false
  - id: D6
    description: "Profile lock guard: concurrent second launch on the same profile dir raises ProfileInUseError (name, code, instanceof)"
    requirement: BRWS-04
    verification:
      - kind: e2e
        ref: "packages/browser/tests/e2e/profile-lock.spec.ts#a second concurrent launch on the same profile rejects with ProfileInUseError"
        status: pass
    human_judgment: false
  - id: D7
    description: "No-stealth doctrine gate: dependency tree contains no stealth/evasion packages; matcher proven able to fail via synthetic fixture"
    requirement: BRWS-04
    verification:
      - kind: unit
        ref: "packages/browser/tests/unit/no-stealth-deps.test.ts#real dependency tree contains no stealth/evasion packages"
        status: pass
      - kind: unit
        ref: "packages/browser/tests/unit/no-stealth-deps.test.ts#blocklist matcher flags synthetic stealth packages (proves the gate can fail)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Structured audit logging habit: pino launch/goto/close events observable at debug level, no sensitive values logged"
    requirement: BRWS-04
    verification:
      - kind: other
        ref: "JUNO_LOG_LEVEL=debug playwright test run — session.launch/goto/close JSON lines observed; code inspection confirms only url/channel/headless/basename in logger calls"
        status: pass
    human_judgment: false

# Metrics
duration: 11 min
completed: 2026-08-21
status: complete
---

# Phase 1 Plan 1: Browser Core Walking Skeleton Summary

**pnpm monorepo + @juno/browser walking skeleton: persistent Chrome session with zod URL validation, ariaSnapshot ai-mode read, strict semantic click, restart persistence, ProcessSingleton lock guard, and a no-stealth dependency gate**

## Performance

- **Duration:** 11 min (10:59–11:10 UTC)
- **Started:** 2026-08-21T10:59:16Z
- **Completed:** 2026-08-21T11:09:57Z
- **Tasks:** 3
- **Files modified:** 19 (18 created, 1 modified)

## Accomplishments
- Walking skeleton proven end-to-end: validated URL → persistent Chrome (channel:'chrome') → live a11y snapshot (ariaSnapshot ai-mode + boxes, parsed via yaml) → strict getByRole fill+click → observable DOM effect, plus example.com public-site smoke
- Full persistent-profile lifecycle: dedicated dir resolution (JUNO_PROFILE_DIR override → ~/.juno/profile default), state surviving full close+relaunch, and typed ProfileInUseError on lock contention
- No-stealth doctrine enforced by a runnable unit test (blocklist + substring matching over all workspace manifests, synthetic-fixture proof it can fail)
- Plan-level verification fully green: 5/5 e2e, 3/3 unit, typecheck clean, zero `ariaSnapshotJSON` references, zero positional-disambiguation calls in src

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end skeleton — launch persistent session, load URL, read one snapshot, act by semantic ref** - `8a84aea` (feat)
2. **Task 2: Persistent profile lifecycle — dedicated dir resolution, ProcessSingleton lock guard, restart persistence** - `5b607ef` (feat)
3. **Task 3: No-stealth doctrine gate + structured logging habit** - `fa61054` (test)

**Plan metadata:** (see below — summary commit)

## Files Created/Modified
- `pnpm-workspace.yaml` - workspace root (packages/* glob)
- `package.json` - root manifest (private, pnpm@10.33.0, root devDeps: typescript/vitest/tsx/@types/node)
- `tsconfig.base.json` - strict, ES2022, NodeNext base config
- `vitest.config.ts` - root unit-test config (packages/*/tests/unit)
- `packages/browser/package.json` - @juno/browser with pinned deps (playwright 1.62.1, zod 4.4.3, yaml 2.9.0, pino 10.3.1; dev: @playwright/test 1.62.1)
- `packages/browser/tsconfig.json` / `packages/browser/vitest.config.ts` / `packages/browser/playwright.config.ts` - package configs (single worker, fixture webServer on 8931, reuseExistingServer)
- `packages/browser/src/session.ts` - BrowserSession facade: launchPersistentContext + ProcessSingleton guard, zod URL validation before goto, pino audit logging
- `packages/browser/src/profile.ts` - resolveProfileDir() (env override, default ~/.juno/profile, recursive mkdir)
- `packages/browser/src/errors.ts` - ProfileInUseError, InvalidUrlError (typed code fields)
- `packages/browser/src/index.ts` - public barrel
- `packages/browser/tests/fixtures/server.ts` - deterministic fixture server (127.0.0.1:8931, control page + POST /remove-button)
- `packages/browser/tests/e2e/navigation.spec.ts` - tracer spec: load → read → act, invalid-URL rejection, example.com smoke
- `packages/browser/tests/e2e/persistence.spec.ts` - localStorage survives close+relaunch
- `packages/browser/tests/e2e/profile-lock.spec.ts` - second launch → ProfileInUseError
- `packages/browser/tests/unit/no-stealth-deps.test.ts` - dependency-tree doctrine gate

## Decisions Made
- E2e specs opt into headless:true (Chrome new-headless, channel:'chrome'); the product default stays headed per anti-bot doctrine — display-less CI is a test-environment concern, not a product posture change
- No-stealth test walks up to pnpm-workspace.yaml to find the workspace root (robust to future package relocation) rather than a hard-coded `../../..`
- Added packages/browser/vitest.config.ts so the plan's in-package verify command (`pnpm --filter @juno/browser exec vitest run ...`) resolves tests; the root config serves monorepo-wide runs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Root vitest.config.ts comment broke config bundling**
- **Found during:** Task 3 (unit verify command)
- **Issue:** Block comment contained `packages/*/tests/unit/` — the `*/` terminated the comment early, making the config file unparseable (PARSE_ERROR from rolldown config bundler)
- **Fix:** Reworded the comment to avoid the glob's `*/` sequence
- **Files modified:** vitest.config.ts
- **Verification:** vitest config loads and unit tests run at root and package level
- **Committed in:** fa61054 (part of Task 3 commit)

**2. [Rule 3 - Blocking] In-package vitest run found no test files**
- **Found during:** Task 3 (verify command)
- **Issue:** Plan's verify runs vitest from packages/browser, but the root config's include pattern is root-relative → "No test files found"
- **Fix:** Added packages/browser/vitest.config.ts with package-relative include
- **Files modified:** packages/browser/vitest.config.ts
- **Verification:** `vitest run tests/unit/no-stealth-deps.test.ts` (in packages/browser) → 3 passed
- **Committed in:** fa61054 (part of Task 3 commit)

**3. [Rule 3 - Blocking] Test's repo-root path resolution was wrong depth**
- **Found during:** Task 3 (first unit run)
- **Issue:** `path.resolve(here, '..', '..', '..')` resolved to packages/ (ENOENT on packages/packages) — tests/unit sits 4 levels below the repo root
- **Fix:** Walk up from the test file until pnpm-workspace.yaml is found
- **Files modified:** packages/browser/tests/unit/no-stealth-deps.test.ts
- **Verification:** Manifest collection now scans root + all packages; 3/3 tests pass
- **Committed in:** fa61054 (part of Task 3 commit)

**4. [Rule 1 - Bug] 'User Data' grep criterion matched a doc comment**
- **Found during:** Task 2 (acceptance-criteria check)
- **Issue:** profile.ts's doc comment said `Chrome "User Data" directory`, tripping the "no 'User Data' in src" criterion (which exists to catch code defaulting toward Chrome's default profile location)
- **Fix:** Rephrased the comment ("daily-driver Chrome profile directory")
- **Files modified:** packages/browser/src/profile.ts
- **Verification:** grep for 'User Data' in src returns zero matches; the criterion's intent (no code path to the default profile) was never violated — profile.ts only ever resolves JUNO_PROFILE_DIR or ~/.juno/profile
- **Committed in:** 5b607ef (part of Task 2 commit)

---

**Total deviations:** 4 auto-fixed (2 Rule 1 bugs, 2 Rule 3 blockers)
**Impact on plan:** All fixes were small correctness/compliance issues in files this plan itself created. No scope creep; no architectural change.

## Issues Encountered
- Bundled-Chromium revision mismatch from research (Pitfall 2) resolved by running `pnpm exec playwright install chromium` as planned — both chromium-1234 and chromium_headless_shell-1234 now cached; default channel remains system Chrome
- pnpm ignored esbuild's build script (pnpm 10 default). Vitest/vite bundles its own esbuild binary fallback and all runs pass, so no approval was needed; noted here for future awareness

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Walking skeleton (load → read → act) green and committed; Plans 02 (reader/refs/actor expansion) and 03 (failsafe) can build directly on BrowserSession, the fixture server (incl. /remove-button endpoint), and the strict-locator discipline
- Flagged assumptions (BRWS-01 http/https-only scope; BRWS-04 dedicated-profile interpretation) are implemented as stated in the plan and remain open for explicit confirmation at phase review — only profile.ts/session.ts boundary code would change if either is revised
- pnpm-workspace ready for additional @juno/* packages (workspace:* protocol)

## Self-Check: PASSED

- All 18 created files verified present on disk
- All 3 task commits verified in git history (8a84aea, 5b607ef, fa61054)
- Plan-level verification re-run green: 5/5 e2e passed, 3/3 unit passed, typecheck clean, zero ariaSnapshotJSON refs in src, zero .first/.nth/.last calls in src

---
*Phase: 01-browser-core*
*Completed: 2026-08-21*
