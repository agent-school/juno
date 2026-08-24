---
phase: 01-browser-core
status: passed
score: 4/4
verified: 2026-08-24
verifier: inline (subagent dispatch unavailable in this runtime)
next_action: ""
next_command: ""
---

# Phase 1: Browser Core — Verification

**Goal (from ROADMAP.md):** Juno can load, read, and act on any website through a semantic accessibility-tree view — the foundation every higher layer sits on.

**Result: PASSED — 4/4 success criteria verified against the actual codebase.**

## Success Criteria Verification

### 1. User gives Juno a URL and the site loads and navigates in a real browser session ✓

**Evidence:** `packages/browser/src/session.ts` — `BrowserSession.launch()` starts a persistent Chrome context (`channel: 'chrome'`); `goto()` zod-validates the URL (http/https scheme allowlist, hostname required) BEFORE navigation. Verified live by `tests/e2e/navigation.spec.ts` (3 tests, including a public-site smoke against example.com) and `persistence.spec.ts` + `profile-lock.spec.ts` (profile lifecycle). Full e2e suite: 15/15 green.

**Requirement:** BRWS-01 — Complete in REQUIREMENTS.md.

### 2. Juno can describe a loaded page's semantic structure (roles, labels, text, element states) derived from the accessibility tree ✓

**Evidence:** `packages/browser/src/reader.ts` — `SemanticPageReader.read()` captures `ariaSnapshot({mode:'ai', boxes:true})`, parses behind the single yaml boundary (`parse-yaml.ts`), and validates through `PageTreeSchema.safeParse`; the return type is the zod output type, so unvalidated data is excluded by construction. Verified live by `tests/e2e/reading.spec.ts` (roles, names, selected state, eN refs, positive boxes on the fixture page; empty page → valid tree with zero children) and 10 unit tests including the verbatim live-capture fixture. Empirical note: empty pages capture as `''` → the PageTree root is a `children` wrapper (no synthesized root role — no-synthesis prohibition honored).

**Requirement:** BRWS-02 — Complete in REQUIREMENTS.md.

### 3. Juno can click, type, scroll, and select elements by semantic reference — and when the page changes, the reference fails safe rather than acting on the wrong element ✓

**Evidence:** `packages/browser/src/actor.ts` + `src/refs.ts` — `SemanticActor` exposes click/fill/selectOption/check/scrollIntoView/scrollViewport; durable `SemanticRef`s resolve via strict `getByRole` locators (exact match, scope-chain-only disambiguation); ephemeral refs re-validate role+name identity against a fresh snapshot before every action. Verified live by `tests/e2e/acting.spec.ts` (5 tests, each with observed page effect) and `tests/e2e/failsafe.spec.ts` (3 tests under real DOM mutation: removed target → `GroundingTimeout`, duplicate accessible name → `AmbiguousReference`, stale ephemeral ref → typed rejection — all with activation-log assertions proving zero wrong-element actions). Raw Playwright errors never escape (typed-error expectations). 18 unit tests cover resolver composition and error mapping.

**Requirement:** BRWS-03 — Complete in REQUIREMENTS.md.

### 4. The browser runs under the user's persistent real-user profile with no stealth-evasion tooling ✓

**Evidence:** `packages/browser/src/profile.ts` — dedicated profile dir (`~/.juno/profile`, `JUNO_PROFILE_DIR` override), never the daily Chrome User Data dir; `ProcessSingleton` lock guard → `ProfileInUseError`. Verified live by `persistence.spec.ts` (state survives restart) and `profile-lock.spec.ts` (second launch rejects typed). No-stealth gate: `tests/unit/no-stealth-deps.test.ts` asserts the dependency blocklist on every run. Default launch is headed (`headless: false`) — anti-bot posture.

**Requirement:** BRWS-04 — Complete in REQUIREMENTS.md.

## Requirement Traceability

| Requirement | Declared by | SUMMARY exists | REQUIREMENTS.md status |
|-------------|-------------|----------------|------------------------|
| BRWS-01 | 01-01 | ✓ 01-01-SUMMARY.md | Complete |
| BRWS-02 | 01-02 | ✓ 01-02-SUMMARY.md | Complete |
| BRWS-03 | 01-03 | ✓ 01-03-SUMMARY.md | Complete |
| BRWS-04 | 01-01 | ✓ 01-01-SUMMARY.md | Complete |

All 4 phase requirement IDs accounted for; no undeclared requirements touched.

## Doctrine / Prohibition Gates (re-run at verification)

- `grep "\.(first|nth|last)(" packages/browser/src` → zero matches (positional disambiguation structurally absent)
- `waitForTimeout` anywhere in packages/browser → zero matches (no manual sleeps)
- `page.evaluate` in packages/browser/src → zero matches (T-1-08)
- `ariaSnapshotJSON` in packages/browser/src → zero matches (forbidden nonexistent API)
- `from 'yaml'` in src → only parse-yaml.ts (single parse boundary)
- `internal:aria-ref` in src → zero matches (plain working selector only)
- Stealth packages in dependency tree → blocked by unit test gate

## Verification Evidence Summary

- Unit: 31/31 passed (3 files)
- E2E: 15/15 passed (6 spec files, real Chrome via channel:'chrome')
- Typecheck: clean (strict TS, monorepo-wide)
- Plans: 3/3 executed with committed SUMMARY.md artifacts

## Notes for Phase 2

- The `GroundingError` family (`GroundingTimeout`, `AmbiguousReference`, `StaleReference`) is the catch-family Phase 2's safety guard wraps.
- The zod data fence at `SemanticPageReader` is the SAFE-05 precursor — page-derived strings enter the model as data only.
- Subagent dispatch was non-functional in this runtime (executors and code-reviewer returned empty); all plans executed inline with identical protocol. `/gsd-code-review 1` should be re-run when subagent dispatch works to produce 01-REVIEW.md.
