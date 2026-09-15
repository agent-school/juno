# Phase 1: Browser Core - Pattern Map

**Mapped:** 2026-08-21
**Files analyzed:** 20 (9 source modules, 2 configs, 2 test configs, 6 test spec groups, 1 fixture server)
**Analogs found:** 0 / 20 — **GREENFIELD**: this repository contains no application source code yet (only `AGENTS.md`, `README.md`, `.planning/`, `.opencode/`). Every pattern below is established *by this phase* and is anchored to **empirically verified code excerpts from `01-RESEARCH.md`** (executed against playwright@1.62.1 + system Chrome on 2026-08-21). Nothing here is fabricated from a nonexistent analog; nothing is copied from an external repo as if it were project code.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `pnpm-workspace.yaml` | config | — | none (greenfield) | none |
| `package.json` (root) | config | — | none (greenfield) | none |
| `packages/browser/package.json` | config | — | none (greenfield) | none |
| `tsconfig.json` (+ base) | config | — | none (greenfield) | none |
| `vitest.config.ts` (root) | config/test | — | none (greenfield) | none |
| `packages/browser/playwright.config.ts` | config/test | — | none (greenfield) | none |
| `packages/browser/src/index.ts` | module-barrel | — | none (greenfield) | none |
| `packages/browser/src/session.ts` | service (facade) | request-response / lifecycle | none — pattern from RESEARCH Code Examples §"Launch a persistent…" | established-by-phase |
| `packages/browser/src/profile.ts` | utility | file-I/O | none — pattern from RESEARCH Pattern 4 | established-by-phase |
| `packages/browser/src/reader.ts` | service | transform (YAML → typed tree) | none — pattern from RESEARCH Pattern 1 | established-by-phase |
| `packages/browser/src/snapshot-schema.ts` | model (zod schema) | transform | none — mirrors future `ariaSnapshotJSON` node schema (RESEARCH Pitfall 1) | established-by-phase |
| `packages/browser/src/parse-yaml.ts` | utility | transform | none — pattern from RESEARCH Pattern 1 | established-by-phase |
| `packages/browser/src/refs.ts` | model + resolver | request-response | none — pattern from RESEARCH Patterns 2–3 | established-by-phase |
| `packages/browser/src/actor.ts` | service (action executor) | event-driven (browser actions) | none — pattern from RESEARCH Patterns 2–3 | established-by-phase |
| `packages/browser/src/errors.ts` | utility (error taxonomy) | — | none — taxonomy defined in RESEARCH Pattern 3 rule 4 | established-by-phase |
| `packages/browser/tests/unit/*.test.ts` (url-validation, parse-yaml, refs, no-stealth-deps) | test | — | none (greenfield) | none |
| `packages/browser/tests/e2e/*.spec.ts` (navigation, reading, acting, failsafe, persistence, profile-lock) | test/e2e | — | none (greenfield) | none |
| `packages/browser/tests/fixtures/server.ts` | test-fixture | streaming/http | none (greenfield) | none |

## Pattern Assignments

> Since there are no existing analogs, each assignment below gives the new file its **concrete contract** drawn verbatim from verified research excerpts. The planner should paste these shapes into plan actions directly.

### `src/session.ts` (service/facade, lifecycle)

**Analog:** none — greenfield. Contract from RESEARCH.md "Code Examples → Launch a persistent, dedicated-profile session" (empirically verified).

**Core launch pattern:**
```typescript
import { chromium } from 'playwright';

const ctx = await chromium.launchPersistentContext(dedicatedUserDataDir, {
  channel: 'chrome',      // user's real Chrome; also works headless
  headless: false,        // default headed — anti-bot posture
});
const page = ctx.pages()[0] ?? await ctx.newPage();
await page.goto('https://example.com');
// localStorage/cookies persist across ctx.close() + relaunch (verified)
```

**Profile-lock guard pattern (mandatory):**
```typescript
// Error text prefix (verbatim): "browserType.launchPersistentContext: Failed to create
//  a ProcessSingleton for your profile directory. This usually means that the profile is …"
try {
  const ctx2 = await chromium.launchPersistentContext(sameDir, { channel: 'chrome' });
} catch (e) {
  // map to ProfileInUseError — surface "Juno is already running" to the user
}
```

**Rules:** dedicated userDataDir only (never the daily Chrome "User Data" dir); default `headless: false`; URL validated by zod at this boundary before `page.goto()` (scheme allowlist http/https; reject `file:`/`javascript:`). Design the action surface so a safety guard can wrap every call in Phase 2.

---

### `src/reader.ts` + `src/parse-yaml.ts` + `src/snapshot-schema.ts` (perception pipeline, transform)

**Analog:** none — greenfield. Contract from RESEARCH.md Pattern 1 (verified against live Chrome).

**Capture pattern:**
```typescript
const yaml: string = await page.ariaSnapshot({ mode: 'ai', boxes: true });
const tree = PageTreeSchema.parse(parseAriaYaml(yaml));
```

**Target YAML shape (verbatim sample from a live run — use as parser fixture):**
```yaml
- generic [active] [ref=e1] [box=8,21,1264,150]:
  - heading "Todo Demo" [level=1] [ref=e2] [box=8,21,1264,37]
  - text: What needs to be done?
  - textbox "What needs to be done?" [ref=e3] [box=165,80,185,21]:
    - /placeholder: Buy groceries
  - button "Add todo" [ref=e4] [box=354,80,69,21]
  - checkbox [ref=e7] [box=52,120,13,13]
  - combobox [ref=e8]:
    - option "Low" [selected]
```

**Schema shape requirement (`snapshot-schema.ts`):** mirror the documented future `ariaSnapshotJSON` node schema so migration is one line later:
`role, name, text, children, checked, disabled, expanded, active, invalid, level, pressed, selected, url, placeholder, ref, cursor, box`

**Hard constraint:** `ariaSnapshotJSON` does NOT exist in playwright 1.62.1 — plans must not reference it. YAML parsing uses the `yaml` package behind exactly one module (`parse-yaml.ts`), never regex-only interpretation.

---

### `src/refs.ts` + `src/actor.ts` (grounding + action, two-layer ref model)

**Analog:** none — greenfield. Contract from RESEARCH.md Patterns 2–3 (all verified).

**Layer 1 — ephemeral in-session refs:**
```typescript
await page.locator(`aria-ref=${textboxRef}`).fill('text');      // works
await page.locator(`aria-ref=${buttonRef}`).click();            // works
await page.locator(`aria-ref=${comboRef}`).selectOption('high');// works
await page.locator(`aria-ref=${checkboxRef}`).check();          // works
await page.locator(`aria-ref=${someRef}`).scrollIntoViewIfNeeded();
// NOTE: 'internal:aria-ref=e4' does NOT parse — use plain 'aria-ref=e4'
```

**Layer 2 — durable semantic refs (the only form ever persisted or logged):**
```typescript
const locator = page.getByRole('button', { name: 'Add todo' }); // strict by default
await locator.click(); // 0 matches -> TimeoutError; >1 -> strict-mode violation
```

**Fail-safe rules (BRWS-03 core):**
1. Never `first()`, `last()`, `nth()` — multi-match is an error, disambiguation = refine semantic scope.
2. Zero-match and multi-match both surface as typed `GroundingError`s — never auto-retry with broadened matchers.
3. Refs from older snapshots are untrusted: re-take snapshot, confirm role+name before acting. Refs never cross navigations.
4. Error mapping: `TimeoutError` → `GroundingTimeout`; strict-mode `PlaywrightError` → `AmbiguousReference`.

**Verified failure behaviors (use as e2e expectations):**
```typescript
await page.getByRole('button', { name: 'Does Not Exist' }).click({ timeout: 1000 }); // → TimeoutError
// 2 buttons named "X" → PlaywrightError: "strict mode violation: getByRole('button', …)"
await page.locator('aria-ref=e2').click({ timeout: 2000 }); // stale after removal → TimeoutError
```

---

### `src/errors.ts` (error taxonomy)

**Analog:** none — greenfield. Taxonomy fixed by RESEARCH Pattern 3 rule 4 + Pattern 4 rule 2:

| Error class | Source condition |
|-------------|------------------|
| `GroundingTimeout` | Playwright `TimeoutError` on strict-locator or `aria-ref` action (0 matches / stale ref) |
| `AmbiguousReference` | strict-mode violation (>1 match) |
| `ProfileInUseError` | ProcessSingleton launch failure on locked userDataDir |
| URL validation errors | zod rejection at session boundary (bad scheme/host) |

All browser-layer failures map into these classes at the boundary; raw Playwright errors never leak past `session.ts`/`actor.ts`.

---

### `src/profile.ts` (utility, file-I/O)

**Analog:** none — greenfield. Rules from RESEARCH Pattern 4:
- One dedicated userDataDir (e.g. `~/.juno/profile`, configurable via config only — never user-supplied arbitrary paths).
- Created on first run; owned by a single `BrowserSession`.
- Treat directory contents (cookies/session) as sensitive data at rest — never log them.
- Lock detection = attempt launch + catch ProcessSingleton error (no lockfile munging).

---

### Configs & workspace wiring

**Analog:** none — greenfield. Verified wiring from RESEARCH "pnpm workspace wiring":

```yaml
# pnpm-workspace.yaml (repo root)
packages:
  - 'packages/*'
```
```json
// packages/browser/package.json — cross-package dependency convention
{ "dependencies": { "@juno/shared": "workspace:*", "playwright": "1.62.1" } }
```

Install commands (from RESEARCH):
```bash
pnpm add -w typescript vitest tsx @types/node
pnpm --filter @juno/browser add playwright zod yaml pino
pnpm --filter @juno/browser add -D @playwright/test
```

Pinned versions: playwright/@playwright/test 1.62.1, zod 4.4.3, yaml 2.9.0, pino 10.3.1, typescript ~5.9, vitest 4.1.11, tsx 4.x.

Setup task must run `pnpm exec playwright install chromium` (cache has rev 1217; 1.62.1 needs 1234) OR default to `channel: 'chrome'` (recommended default, fallback supported behind one launch option).

---

### Tests (unit + e2e + fixture server)

**Analog:** none — greenfield. Test architecture fully specified in RESEARCH "Validation Architecture":

- Unit (vitest): `url-validation.test.ts`, `parse-yaml.test.ts` (fixture YAML from real captures — use the verbatim sample above), `refs.test.ts`, `no-stealth-deps.test.ts` (asserts no stealth-evasion deps in tree — BRWS-04 doctrine check).
- E2E (@playwright/test): `navigation.spec.ts`, `reading.spec.ts`, `acting.spec.ts`, `failsafe.spec.ts` (remove element then act), `persistence.spec.ts` (state survives restart), `profile-lock.spec.ts` (second launch → ProfileInUseError).
- E2E runs against a **local deterministic fixture HTTP server** (`tests/fixtures/server.ts`: buttons, textbox, checkbox, combobox, dynamic mutation endpoints) plus one public-site smoke navigation. No Instagram dependency in Phase 1.
- Run commands: `pnpm --filter @juno/browser test` (unit+fast), full suite per wave merge.

## Shared Patterns

### Zod validation at every boundary
**Source:** RESEARCH Security Domain V5 + Pattern 1
**Apply to:** `session.ts` (URL input), `snapshot-schema.ts`/`reader.ts` (every parsed snapshot before it enters Juno's model)
```typescript
const tree = PageTreeSchema.parse(parseAriaYaml(yaml));
```
Snapshot text/names are **data**, never executed — establishes the typed data-fence against prompt injection (SAFE-05 precursor).

### Structured logging habit (pino)
**Source:** RESEARCH Standard Stack (pino 10.3.1, "start the logging habit now")
**Apply to:** all source modules. Log every step/action for auditability; **never log profile-dir contents, cookies, or storage**.

### Fail-safe discipline (no guessing)
**Source:** RESEARCH Patterns 2–3, Anti-Patterns
**Apply to:** `refs.ts`, `actor.ts`. Strict locators only; no `first()/nth()/last()` anywhere in the package; no `page.waitForTimeout()` sleeps (locator actions auto-wait); no CSS/XPath primary references; no stealth dependencies ever.

### Typed error boundary
**Source:** RESEARCH Pattern 3 rule 4
**Apply to:** `session.ts`, `actor.ts`, `profile.ts` — map raw Playwright errors to the `errors.ts` taxonomy; raw errors never escape the package public API (`index.ts`).

### Anti-patterns to enforce in review (from RESEARCH)
- Any reference to `ariaSnapshotJSON` (does not exist in 1.62.1) — instant plan/code smell.
- `first()`/`nth()`/`last()` disambiguation.
- `page.waitForSelector` / `page.waitForTimeout`.
- Persisting or logging `eN` refs.
- `userDataDir` defaulting toward Chrome's User Data location.
- Stealth packages in the dependency tree.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| All 20 files above | various | various | **Greenfield repository** — zero application source exists. This phase establishes the project's first patterns; CONVENTIONS.md should be populated from these at phase end (per RESEARCH Project Constraints). |

Planner must source all implementation detail from this document + `01-RESEARCH.md` (Patterns 1–4, Code Examples, Anti-Patterns, Don't-Hand-Roll table) — there is no existing code to imitate.

## Metadata

**Analog search scope:** entire repository (`/home/ubuntu/projects/juno`) excluding `.opencode/` tooling and `.git/`
**Files scanned:** repo contains no `*.ts`/`*.js` application source; confirmed via directory listing and glob
**Pattern extraction date:** 2026-08-21
**Primary source of excerpts:** `.planning/phases/01-browser-core/01-RESEARCH.md` (empirically verified against playwright@1.62.1 + system Chrome, same date)
