---
phase: 01-browser-core
plan: 02
subsystem: infra
tags: [accessibility-tree, yaml, zod, playwright, perception, typed-model, vitest, playwright-e2e]

# Dependency graph
requires:
  - phase: 01-browser-core plan 01
    provides: pnpm monorepo + @juno/browser package (BrowserSession facade, fixture HTTP server, strict-locator discipline)
provides:
  - "zod-validated typed page tree (PageTreeSchema / SnapshotNodeSchema) mirroring the future JSON node schema"
  - "parseAriaYaml — the ONLY yaml-package import site; interprets ariaSnapshot YAML into unvalidated node objects"
  - "SemanticPageReader.read(page) — the single perception path: ariaSnapshot({mode:'ai', boxes:true}) → parseAriaYaml → PageTreeSchema.safeParse"
  - "SnapshotParseError (code SNAPSHOT_PARSE) carrying zod issues — malformed/hostile snapshots never partially trusted"
  - "/empty fixture route + live e2e perception spec (roles, names, states, refs, boxes, empty-state edge)"
affects: [01-browser-core plan 03 (SemanticActor grounds refs against this tree), phase-2 safety guard (SAFE-05 data fence), phase-3 semantic compiler, phase-4 planner/replay]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 6400    # ~25541 diff chars / 4, excluding .planning
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns: [single-boundary YAML parsing (one import site for the yaml package), zod data fence between page content and the semantic model, wrapper PageTree root (zero-or-more top-level nodes) instead of a synthesized root, reader logs URL + node counts only]

key-files:
  created:
    - packages/browser/src/snapshot-schema.ts
    - packages/browser/src/parse-yaml.ts
    - packages/browser/src/reader.ts
    - packages/browser/tests/unit/parse-yaml.test.ts
    - packages/browser/tests/e2e/reading.spec.ts
  modified:
    - packages/browser/src/errors.ts
    - packages/browser/src/index.ts
    - packages/browser/tests/fixtures/server.ts

key-decisions:
  - "PageTreeSchema is a wrapper object { children: SnapshotNode[] } (the top-level reported nodes), NOT a synthesized root node: an empirical probe proved an empty page (<body><div></div></body>) captures as an EMPTY STRING, so a root-only tree model would force synthesizing a role the tree never reported — violating the no-synthesis prohibition. Empty capture → children: []; normal page → children: [rootGeneric]"
  - "Schema-invalid input is rejected by zod at the reader (wrapped as SnapshotParseError), while structurally invalid YAML shapes (non-list documents, attribute entries with no parent, unparseable node lines) throw SnapshotParseError directly from the parser — both fences end in the same typed error"
  - "Unknown aria attributes (e.g. [horizontal], [colindex=N]) are dropped, never guessed into the model — the schema deliberately models only the future-JSON field list; unknown /attrs (/placeholder, /url, /cursor handled) are likewise dropped"
  - "Quoted-name regex accepts escaped (\\\" \\\\) sequences; node lines with unparseable leftovers throw SnapshotParseError rather than silently mis-modeling a name"

patterns-established:
  - "Perception pipeline: SemanticPageReader.read is the ONLY way Juno sees a page — capture → parse → validate, return type is the zod output type so unvalidated data is excluded by construction"
  - "Single parse boundary: the yaml package is imported by exactly one module (parse-yaml.ts); grep-enforced by plan acceptance criteria"
  - "Fail-closed interpretation: malformed level/box attributes and unrecognized node-line content become typed SnapshotParseError, never best-effort data"

requirements-completed: [BRWS-02]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "Verbatim live-capture fixture YAML round-trips into a fully typed zod-validated tree (roles, names, refs, boxes, level, placeholder, selected; all state suffixes and /attributes mapped)"
    requirement: BRWS-02
    verification:
      - kind: unit
        ref: "packages/browser/tests/unit/parse-yaml.test.ts#round-trips the verbatim live-capture fixture into a fully typed tree"
      - kind: unit
        ref: "packages/browser/tests/unit/parse-yaml.test.ts#maps every documented state suffix and /attribute"
      - kind: unit
        ref: "packages/browser/tests/unit/parse-yaml.test.ts#rejects schema-invalid YAML (node missing role) at PageTreeSchema.parse, not in the parser"
    human_judgment: false
  - id: D2
    description: "Malformed, hostile, null, and empty inputs behave per the flagged assumptions: typed SnapshotParseError for null/undefined/unparseable/schema-invalid input; valid empty tree for empty content"
    requirement: BRWS-02
    verification:
      - kind: unit
        ref: "packages/browser/tests/unit/parse-yaml.test.ts#throws SnapshotParseError for null or undefined input"
      - kind: unit
        ref: "packages/browser/tests/unit/parse-yaml.test.ts#parses an empty capture (empty page) to a valid tree with zero top-level nodes"
      - kind: unit
        ref: "packages/browser/tests/unit/parse-yaml.test.ts#wraps schema rejection as SnapshotParseError carrying the zod issues"
    human_judgment: false
  - id: D3
    description: "Live page perception: reader on the real fixture page yields a validated tree with correct roles, names, selected state, eN refs, and positive boxes; the /empty page reads to a valid zero-children tree"
    requirement: BRWS-02
    verification:
      - kind: e2e
        ref: "packages/browser/tests/e2e/reading.spec.ts#reads the live fixture page into a validated typed tree"
      - kind: e2e
        ref: "packages/browser/tests/e2e/reading.spec.ts#reads the empty page to a valid tree with zero top-level nodes"
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-08-23
status: complete
---

# Phase 1 Plan 02: Perception Pipeline Summary

**ariaSnapshot YAML → zod-validated typed page tree behind one parser module and one reader facade — the single perception path every later phase sees pages through.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2/2 complete
- **Files:** 5 created, 3 modified

## Accomplishments

- Typed snapshot model (`snapshot-schema.ts`): recursive `SnapshotNodeSchema` mirroring the documented future JSON node schema (role, name, text, children + state flags, level, url, placeholder, ref, cursor, box) — one-line migration when the JSON API ships
- Single parse boundary (`parse-yaml.ts`): the only yaml-package import site; interprets nested lists, quoted names, state suffixes, `/placeholder` `/url` `/cursor` attributes, `eN` refs, and `box=x,y,w,h` tuples; fail-closed on malformed structure
- Perception facade (`reader.ts`): `SemanticPageReader.read` = capture → parse → `PageTreeSchema.safeParse`, wrapping zod issues in `SnapshotParseError`; logs URL + node counts only (T-1-06)
- Empirically grounded empty-state design: probe proved an empty page captures as `''` → wrapper `PageTreeSchema` yields `children: []` without synthesizing a root (flagged-assumption behavior, no-throw)
- Live e2e proof on the fixture server (7/7 e2e, 13/13 unit, typecheck clean)

## Task Commits

1. **Task 1: Typed snapshot model — zod schema + YAML parser + SemanticPageReader** — RED `d0e3768` (test), GREEN `39e0f3f` (feat), `fc13158` (fix: doc-comment acceptance gate)
2. **Task 2: Live perception e2e incl. empty-state edge** — `99c1472` (test)

## Files Created/Modified

- `packages/browser/src/snapshot-schema.ts` — zod schemas + SnapshotNode/PageTree/Box types
- `packages/browser/src/parse-yaml.ts` — parseAriaYaml, the single YAML interpretation boundary
- `packages/browser/src/reader.ts` — SemanticPageReader perception facade
- `packages/browser/src/errors.ts` — added SnapshotParseError (SNAPSHOT_PARSE, carries zod issues)
- `packages/browser/src/index.ts` — exports new symbols and types
- `packages/browser/tests/unit/parse-yaml.test.ts` — 10 unit tests incl. verbatim fixture
- `packages/browser/tests/e2e/reading.spec.ts` — 2 live e2e specs
- `packages/browser/tests/fixtures/server.ts` — added GET /empty route

## Decisions Made

See key-decisions above. Primary: the wrapper PageTree root, forced by the empirical probe (empty page → empty-string capture) combined with the no-synthesis prohibition.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Quoted-name regex required leading whitespace**
- **Found during:** Task 1 (RED→GREEN cycle)
- **Issue:** Node lines without a role (e.g. a quoted-name-only line) start directly with `"`, but the name regex demanded `\s+"` — the schema-invalid-input test path never reached zod
- **Fix:** `\s+` → `\s*` in the name match; test passes with zod rejecting the role-less node as designed
- **Files:** `packages/browser/src/parse-yaml.ts`
- **Verification:** unit suite 13/13 green
- **Commit:** `39e0f3f`

**2. [Rule 1 - Blocking] Acceptance grep forbids the literal future-API token anywhere in src**
- **Found during:** Task 1 acceptance checks
- **Issue:** `snapshot-schema.ts` doc comment named the forbidden API token while explaining the migration path
- **Fix:** reworded to "the not-yet-released JSON snapshot API" — zero matches restored
- **Files:** `packages/browser/src/snapshot-schema.ts`
- **Verification:** `grep -rc` over src returns no matches
- **Commit:** `fc13158`

**3. [Rule 4-adjacent - Design] PageTreeSchema is a wrapper `{ children: [...] }`, not a root node**
- **Found during:** Task 1 design (pre-implementation empirical probe)
- **Issue:** Plan text ("Export PageTreeSchema as the root node type") reads as a single synthesized root; the probe proved empty pages capture as `''`, making a root-only model impossible without synthesizing a role (prohibited by must_haves)
- **Fix:** PageTree = top-level reported nodes; empty capture → `children: []`. All plan behaviors and Task 2 assertions hold; flagged here for phase review alongside the plan's own flagged assumptions
- **Files:** `packages/browser/src/snapshot-schema.ts`, `src/parse-yaml.ts`
- **Verification:** unit + e2e green, both flagged-assumption behaviors asserted
- **Commit:** `39e0f3f`

**Total deviations:** 3 auto-fixed/documented. **Impact:** none beyond this plan's boundary; later phases consume `PageTree` through the exported type.

## Self-Check: PASSED

- All 5 created files exist on disk; 4 task commits verified in git history
- Full unit suite: 13/13 passed; full e2e suite: 7/7 passed; `tsc --noEmit` clean
- `grep -rl "from 'yaml'" packages/browser/src` → only `parse-yaml.ts` (single parse boundary)
- Future-JSON API token: zero matches in src
- `reader.ts` calls `ariaSnapshot({ mode: 'ai', boxes: true })` (the YAML API that exists in 1.62.1)
- All reads in e2e go through `SemanticPageReader.read` — the spec never consumes raw snapshot output
