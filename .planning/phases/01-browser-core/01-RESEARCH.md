# Phase 1: Browser Core - Research

**Researched:** 2026-08-21
**Domain:** Browser automation via Playwright (TypeScript/Node 22), accessibility-tree perception, persistent browser profiles, pnpm monorepo scaffolding
**Confidence:** HIGH (core Playwright claims verified by **executing playwright@1.62.1 against system Chrome in this session**)

## Summary

Phase 1 is the execution-layer foundation of the entire GSD roadmap: a typed Playwright wrapper that loads any site, reads it through the accessibility tree, and acts via semantic element references that fail safe. The good news: the underlying Playwright primitives are mature and were **empirically verified in this session** — `page.ariaSnapshot({ mode: 'ai', boxes: true })` produces a structured a11y tree with element refs and bounding boxes, the `aria-ref=` selector engine resolves those refs back to locators, `launchPersistentContext` with a dedicated profile directory persists state across restarts, and strict-mode locators throw on both zero and multiple matches (exactly the fail-safe semantic BRWS-03 demands).

The single most important correction to prior research: **`Locator.ariaSnapshotJSON()` / `Page.ariaSnapshotJSON()` do NOT exist in playwright 1.62.1** [VERIFIED: empirical execution — only `ariaSnapshot` exists on the prototypes]. The JSON API is present on the Playwright `main` branch and will ship in a future release [CITED: Context7 /microsoft/playwright, class-locator.md from main]. Phase 1 must therefore use the YAML `ariaSnapshot({ mode: 'ai' })` API and parse it into a typed tree (zod schema) whose shape mirrors the future JSON node schema — making eventual migration to `ariaSnapshotJSON` a one-line swap.

The second key design decision: a **two-layer element-reference model**. Ephemeral refs (`e1`, `e2`, … from the ai-mode snapshot, resolved via `page.locator('aria-ref=e3')`) are for immediate in-session action; durable **semantic refs** (role + accessible name + optional scope chain, resolved via `getByRole(role, { name, exact: true })` in strict mode) are what Juno stores and re-validates. Refs are counter-based, valid only within the current page instance, and must never be persisted. Fail-safe comes from refusing to guess: strict locators only, no `first()`/`nth()` opt-outs, and re-validating a ref's role/name against a fresh snapshot before acting. Stale refs empirically fail with `TimeoutError` rather than acting on a wrong element.

**Primary recommendation:** Scaffold a pnpm monorepo (`packages/browser` first), build a `BrowserSession` facade over `launchPersistentContext` with a **dedicated** userDataDir (never the user's daily Chrome profile), a typed `SemanticPageReader` on top of `ariaSnapshot({mode:'ai', boxes:true})` YAML → zod-validated tree, and a `SemanticActor` that resolves semantic refs via strict `getByRole` locators — with every action validated against a fresh snapshot.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BRWS-01 | User can open any website and have Juno load and navigate it | `BrowserSession` facade over `chromium.launchPersistentContext(dedicatedDir, { channel: 'chrome' })` — launch, `page.goto()`, navigation events, URL validation via zod [VERIFIED: empirical execution of playwright@1.62.1] |
| BRWS-02 | Juno can read a page's semantic structure via the accessibility tree (roles, labels, text, state) | `page.ariaSnapshot({ mode: 'ai', boxes: true })` YAML with roles, accessible names, text, state flags (`[checked]`, `[disabled]`, `[expanded]`, `[selected]`, `[level=N]`), `/placeholder:` lines, `[ref=eN]`, `[box=x,y,w,h]` — verified empirically; parse into zod-validated typed tree |
| BRWS-03 | Juno can locate and interact with elements (click, type, scroll, select) using semantic refs that fail safe when the page changes | Strict-mode `getByRole` locators (0-match → TimeoutError, >1-match → strict-mode violation error — both verified); `aria-ref=` selector for in-session refs (fill/click/selectOption/check verified); stale refs fail safe with TimeoutError (verified); never use `first()`/`nth()` |
| BRWS-04 | Juno drives the browser through a persistent real-user profile (no stealth evasion) | `launchPersistentContext` with dedicated userDataDir — localStorage verified persisting across context restarts; Chrome policy warning: daily-profile automation unsupported; profile locking (ProcessSingleton) verified failing second launch; no stealth packages in dependency tree |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Browser lifecycle (launch/close/lock management) | Local process (Node) via Playwright | — | Single desktop app; one browser process per user session is correct at 0–1k users [CITED: .planning/research/ARCHITECTURE.md scale table] |
| Page loading & navigation | Playwright BrowserContext | — | Playwright owns network/navigation; Juno wraps, never reimplements |
| Page semantic perception (a11y tree → typed model) | Local process (Node) parsing injected-script snapshot | Browser (injected script collects tree) | Playwright's injected script walks the DOM/AX tree; Juno's job is parsing + typing the result |
| Element grounding (semantic ref → live element) | Local process via Playwright strict locators | — | Strict mode gives fail-safe resolution for free; guesswork must be structurally impossible |
| Action execution (click/type/scroll/select) | Playwright Locator actions | — | Auto-waiting/actionability checks are Playwright's job; never hand-roll waits |
| Profile persistence (auth state, cookies) | Chromium userDataDir on disk | — | Durable by filesystem, survives restarts (verified); not ephemeral context storage |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| playwright | 1.62.1 | Browser automation engine | De-facto standard; a11y snapshot + strict semantic locators + persistent contexts — the exact primitives this phase is built on. Version confirmed on npm (published 2026-07-30) [VERIFIED: npm registry] |
| playwright-core | 1.62.1 | Type-level / advanced imports if needed | Same registry entry as playwright; only if direct access beyond the high-level API is required |
| typescript | 5.9.x (5.9.2 verified via `typescript`@latest → 5.9.2; npm shows 7.0.2 for a pre-release line — **pin ~5.9**) | Typed language | Project standard (STACK.md) |
| zod | 4.4.3 | Schema for the typed page tree + URL validation | STACK.md standard; validates snapshot parse output and all external inputs [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @playwright/test | 1.62.1 | E2E tests of the browser layer itself | All BRWS-* behavior tests that need a real browser |
| vitest | 4.1.11 | Unit tests (snapshot parser, ref resolver, URL validation) | Fast pure-TS logic tests without a browser |
| yaml | 2.9.0 | Parse `ariaSnapshot()` YAML into objects | Until `ariaSnapshotJSON` ships; keep the parse behind one module [VERIFIED: npm registry, OK verdict] |
| tsx | 4.x | Dev-runner for manual driving of the browser layer | Local dev REPL/scripting |
| pino | 10.3.1 | Structured step logging (audit trail precursor) | Phase 2 makes audit mandatory; start the logging habit now |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| YAML `ariaSnapshot` + own parser | Wait for `ariaSnapshotJSON` (future release) | Waiting blocks Phase 1 on an unreleased API; parser is ~100 lines behind a zod schema that matches the documented future JSON shape |
| `channel: 'chrome'` (system Chrome) | Playwright's bundled Chromium (`npx playwright install chromium`) | System Chrome is closer to the user's real browser (right for BRWS-04 posture); bundled Chromium works offline of the user's Chrome version — support both behind one launch option |
| `aria-ref=` in-session refs | Semantic refs only (`getByRole`) | Refs are faster for immediate follow-up actions after a snapshot; semantics are required for anything stored. Use both, layered |

**Installation:**
```bash
# from repo root (pnpm workspace)
pnpm add -w typescript vitest tsx @types/node
pnpm --filter @juno/browser add playwright zod yaml pino
pnpm --filter @juno/browser add -D @playwright/test
```

**Version verification (npm registry, this session):** playwright 1.62.1 / @playwright/test 1.62.1 / playwright-core 1.62.1 (2026-07-30), vitest 4.1.11 (2026-08-18), typescript stable line 5.9.x (7.0.2 is a newer pre-release — prefer the 5.9 stable line unless the team opts in), zod 4.4.3, pino 10.3.1, yaml 2.9.0. No `postinstall` scripts on any of them (`npm view <pkg> scripts.postinstall` → empty) — no supply-chain script risk at install time.

## Package Legitimacy Audit

> Ran `gsd-tools query package-legitimacy check --ecosystem npm` on all recommended packages.

| Package | Registry | Age (latest publish) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|------|-----------|-------------|---------|-------------|
| playwright | npm | 2026-07-30 | 70,034,924/wk | github.com/microsoft/playwright | SUS ("too-new") | Approved — recency false-positive on canonical package |
| @playwright/test | npm | 2026-07-30 | 46,413,021/wk | github.com/microsoft/playwright | SUS ("too-new") | Approved — same |
| playwright-core | npm | 2026-07-30 | 75,787,083/wk | github.com/microsoft/playwright | SUS ("too-new") | Approved — same |
| vitest | npm | 2026-08-18 | 77,728,812/wk | github.com/vitest-dev/vitest | SUS ("too-new") | Approved — same |
| tsx | npm | 2026-08-10 | 70,678,223/wk | github.com/privatenumber/tsx | SUS ("too-new") | Approved — same |
| better-sqlite3 | npm | 2026-08-05 | 8,431,145/wk | github.com/WiseLibs/better-sqlite3 | SUS ("too-new") | Approved — same (Phase 3, not Phase 1) |
| @types/node | npm | 2026-08-07 | 348,951,646/wk | github.com/DefinitelyTyped/DefinitelyTyped | SUS ("too-new") | Approved — same |
| typescript | npm | 2026-07-08 | 225,722,105/wk | github.com/microsoft/TypeScript | OK | Approved |
| zod | npm | 2026-05-04 | 223,672,922/wk | github.com/colinhacks/zod | OK | Approved |
| pino | npm | 2026-02-09 | 36,998,003/wk | github.com/pinojs/pino | OK | Approved |
| yaml | npm | (2.9.0) | 161,909,623/wk | github.com/eemeli/yaml | OK | Approved |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious [SUS]:** all "SUS" verdicts above carry the single reason `"too-new"` — the heuristic flags the *latest version's publish date*, not the package. Every flagged package has tens of millions of weekly downloads, a canonical GitHub source repo, zero postinstall scripts, and years of history (e.g. microsoft/playwright). These are recency false-positives on the newest patch of established packages; actual risk is negligible. No `checkpoint:human-verify` needed for these, but the planner may add one at its discretion.

**Stack correction carried forward:** project STACK.md (research/STACK.md) states `Locator.ariaSnapshotJSON({ mode: "ai", boxes: true })` is available in Playwright 1.62.1. **This is wrong** — verified by direct execution: neither `Page` nor `Locator` exposes `ariaSnapshotJSON` in 1.62.1. The method exists on the `main` branch (docs served via Context7 are main-branch) and ships in a future release. Phase 1 plans MUST NOT call `ariaSnapshotJSON`. [VERIFIED: empirical execution of playwright@1.62.1]

## Architecture Patterns

### System Architecture Diagram

```
                 ┌────────────────────────────────────────────────┐
                 │                Juno host process (Node 22)     │
                 │                                                │
 URL ──────────► │  BrowserSession (facade)                       │
 (zod-validated) │    │ launch / close / lock-guard               │
                 │    ▼                                          │
                 │  chromium.launchPersistentContext(             │
                 │      dedicated userDataDir, channel:'chrome')  │
                 │    │                                          │
                 │    ├─► page.goto(url)  ──► live Page           │
                 │    │                                          │
                 │    ▼                                          │
   ┌─────────────┤  SemanticPageReader                            │
   │             │    page.ariaSnapshot({mode:'ai',boxes:true})   │
   │             │    → YAML string → yaml.parse → zod ──►        │
   │             │    PageTree {role,name,text,states,ref,box}    │
   │             │                                              │
   │  ┌──────────┴───────────────┐                              │
   │  │  SemanticActor            │                              │
   │  │  ref(eN) ─► aria-ref=     │  (ephemeral, this snapshot)  │
   │  │  sem(role,name) ─►        │                              │
   │  │     getByRole(strict)     │  (durable, re-resolved)      │
   │  │  click / fill / select /  │                              │
   │  │  scrollIntoViewIfNeeded   │                              │
   │  └──────────┬───────────────┘                              │
   │             │ strict mode: 0 match ─► error                │
   │             │              >1 match ─► error               │
                 │              (never guesses)                  │
                 └───────────────┬────────────────────────────────┘
                                 │ CDP / DevTools protocol
                                 ▼
                   Chromium (user's Chrome via channel:'chrome')
                   with persistent profile dir on disk
                   (cookies/localStorage/indexedDB survive restarts)
```

Primary use case trace: URL in → validated → persistent browser navigates → a11y snapshot captured → parsed to typed tree → actor resolves a semantic ref through a strict locator → Playwright auto-waits for actionability → action executes (or errors safely).

### Recommended Project Structure
```
pnpm-workspace.yaml          # packages: ['packages/*']
package.json                 # root scripts only (build/test/lint)
packages/
├── browser/                 # @juno/browser — this phase's deliverable
│   ├── src/
│   │   ├── index.ts         # public exports
│   │   ├── session.ts       # BrowserSession: lifecycle, profile lock guard
│   │   ├── profile.ts       # userDataDir management (create/locate/validate)
│   │   ├── reader.ts        # SemanticPageReader: snapshot → typed tree
│   │   ├── snapshot-schema.ts  # zod schema for the parsed a11y tree
│   │   ├── parse-yaml.ts    # ariaSnapshot YAML → zod-validated nodes
│   │   ├── refs.ts          # SemanticRef type + resolution (strict locators)
│   │   ├── actor.ts         # click/fill/select/scroll by SemanticRef or eN ref
│   │   └── errors.ts        # GroundingError taxonomy (0-match, multi-match, stale-ref)
│   └── tests/               # colocated vitest unit + @playwright/test e2e
└── (future: @juno/safety, @juno/compiler, @juno/memory …)
```

### Pattern 1: Snapshot → typed tree (SemanticPageReader)
**What:** One method captures the a11y tree and validates it into a typed model that mirrors the future `ariaSnapshotJSON` node schema.
**When to use:** Every perception step — this is the ONLY way Juno sees a page.
**Example:**
```typescript
// Verified empirically against playwright@1.62.1 + system Chrome, 2026-08-21
const yaml: string = await page.ariaSnapshot({ mode: 'ai', boxes: true });
// YAML shape (verbatim sample from a live run):
// - generic [active] [ref=e1] [box=8,21,1264,150]:
//   - heading "Todo Demo" [level=1] [ref=e2] [box=8,21,1264,37]
//   - text: What needs to be done?
//   - textbox "What needs to be done?" [ref=e3] [box=165,80,185,21]:
//     - /placeholder: Buy groceries
//   - button "Add todo" [ref=e4] [box=354,80,69,21]
//   - checkbox [ref=e7] [box=52,120,13,13]
//   - combobox [ref=e8]:
//     - option "Low" [selected]
const tree = PageTreeSchema.parse(parseAriaYaml(yaml));
```

### Pattern 2: Two-layer element references
**What:** Ephemeral refs for immediate action; semantic refs for anything that outlives a snapshot.
**When to use:** Refs (`eN`) come from the latest snapshot and are resolved with `page.locator('aria-ref=eN')` (verified working for fill/click/selectOption/check). Semantic refs (`{ role, name, exact: true }` + optional container scope) are resolved with `page.getByRole(role, { name })` in strict mode and are the only form ever persisted or logged.
**Example:**
```typescript
// In-session action by ref (verified):
await page.locator(`aria-ref=${textboxRef}`).fill('hello from juno');

// Durable semantic ref (verified fail-safe):
const locator = page.getByRole('button', { name: 'Add todo' }); // strict by default
await locator.click(); // 0 matches -> TimeoutError; >1 -> strict-mode violation
```

### Pattern 3: Fail-safe grounding — validate before acting
**What:** Before executing a stored/received reference, re-assert its semantic identity against a fresh snapshot.
**When to use:** Any action whose ref did not come from a snapshot taken in the current tick.
**Rules (derived from verified behavior + official docs):**
1. Never use `first()`, `last()`, `nth()` to disambiguate — official docs explicitly warn these "may click on an element you did not intend" when the page changes [CITED: playwright.dev/docs/locators#strictness].
2. Zero-match and multi-match are both `GroundingError`s surfaced to the caller — never auto-retry with a broadened matcher.
3. Treat a ref from an older snapshot as untrusted: re-take the snapshot, find the node with that ref, and confirm role+name still match the intended target before acting. Refs are counter-based IDs cached on DOM elements while role+name are unchanged [VERIFIED: playwright source via Context7, packages/injected/src/ariaSnapshot.ts `computeAriaRef`]; the counter is per injected-script instance, so refs must never be carried across navigations.
4. Wrap all actions in typed error mapping: `TimeoutError` → `GroundingTimeout`, strict-mode `PlaywrightError` → `AmbiguousReference`.

### Pattern 4: Persistent profile management (BRWS-04)
**What:** One dedicated userDataDir for Juno, created on first run, owned by a single `BrowserSession` instance.
**Rules:**
1. Never point `userDataDir` at the user's daily Chrome "User Data" directory — official Playwright docs warn that due to recent Chrome policy changes this "may result in pages not loading or the browser exiting" [CITED: playwright.dev API docs, BrowserType.launchPersistentContext]. "Real-user profile" in BRWS-04 means: a dedicated persistent profile the user logs into once (human handoff), which then carries real cookies/session — not the daily-driver directory.
2. Guard the ProcessSingleton lock: a second `launchPersistentContext` on the same directory fails with `Failed to create a ProcessSingleton for your profile directory` [VERIFIED: empirical execution] — catch it and surface "profile already in use" instead of crashing.
3. Default to `headless: false` (or Chrome's new headless via `channel: 'chrome'`, verified working) — anti-bot-sensitive sites flag classic headless; this posture matches the project's no-stealth doctrine [CITED: .planning/research/PITFALLS.md, verified headless launch with channel:'chrome' works].

### Anti-Patterns to Avoid
- **Calling `ariaSnapshotJSON()` — it does not exist in 1.62.1.** Plans must use `ariaSnapshot({mode:'ai', boxes:true})` YAML.
- **`first()/nth()` disambiguation:** silently clicks unintended elements after page changes (official docs warning).
- **`page.waitForTimeout()` sleeps:** flaky; locator actions and web assertions already auto-wait [CITED: playwright.dev actionability docs].
- **CSS/XPath as primary element references:** brittle by project doctrine (REQUIREMENTS.md Out of Scope table).
- **Persisting `eN` refs to disk:** refs are snapshot-session-scoped counters; only semantic refs persist.
- **Sharing one profile across concurrent sessions:** ProcessSingleton failure or cross-session cookie invalidation (both documented + verified).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Element waiting/readiness | Custom poll loops / sleeps | Locator actions' built-in actionability checks | Playwright auto-waits visible/stable/receives-events/enabled and fails with clear TimeoutError [CITED: playwright.dev actionability] |
| Element finding | DOM walkers / XPath guessing | `getByRole`/`getByLabel`/`getByText` strict locators | Semantic, auto-waiting, strict-by-default — fail-safe for free |
| A11y tree extraction | CDP `Accessibility.getFullAXTree` plumbing | `page.ariaSnapshot({mode:'ai'})` | Playwright's injected script already normalizes visibility, roles, names, states, refs |
| Session/cookie persistence | Cookie serialization / storageState juggling | `launchPersistentContext(dedicatedDir)` | Full profile (cookies + localStorage + IndexedDB) persists; storageState drops sessionStorage [CITED: PITFALLS.md, currents.dev] |
| YAML parsing | Regex-only YAML interpretation | `yaml` package + zod schema | The a11y YAML has nested lists, quoted names, attribute suffixes — a real parser avoids subtle breakage |
| Profile lock detection | Raw lockfile munging | Launch + catch `ProcessSingleton` error | Verified working; Playwright/MCP's own approach reads SingletonLock similarly [CITED: playwright source via Context7] |

**Key insight:** every primitive Phase 1 needs already exists in Playwright. The phase's actual work is *typing, layering, and fail-safe discipline* — not browser engineering.

## Common Pitfalls

### Pitfall 1: Planning against `ariaSnapshotJSON` (does not exist in 1.62.1)
**What goes wrong:** Code written against the JSON API fails at runtime with `ariaSnapshotJSON is not a function` [VERIFIED: empirical execution].
**Why it happens:** Context7 serves Playwright's main-branch docs, which document the not-yet-released API; STACK.md trusted it.
**How to avoid:** Use `page.ariaSnapshot({mode:'ai', boxes:true})` YAML behind a single `SemanticPageReader` module; design the internal tree type to match the documented future JSON node schema (`role, name, text, children, checked, disabled, expanded, active, invalid, level, pressed, selected, url, placeholder, ref, cursor, box` [CITED: Context7 /microsoft/playwright class-locator.md, main branch]) so migration is one line later.
**Warning signs:** any plan step or code reference to `ariaSnapshotJSON`.

### Pitfall 2: Bundled-browser revision mismatch on this machine
**What goes wrong:** `chromium.launch()` fails: `Executable doesn't exist at ~/.cache/ms-playwright/chromium_headless_shell-1234/...` — playwright 1.62.1 wants revision 1234; this machine's cache holds 1217 [VERIFIED: empirical execution].
**Why it happens:** Cached browsers belong to an older playwright install.
**How to avoid:** Setup task must run `pnpm exec playwright install chromium` (or `--with-deps`), OR launch with `channel: 'chrome'` to use the installed system Google Chrome (`/usr/bin/google-chrome`, verified working headless and persistent). Prefer supporting both behind a launch option; default `channel: 'chrome'` for the real-user-profile posture.
**Warning signs:** `Executable doesn't exist` at browser launch in CI/dev.

### Pitfall 3: Daily Chrome profile automation breaks (BRWS-04 misreading)
**What goes wrong:** Pointing `userDataDir` at the user's main "User Data" dir → pages not loading / browser exiting (official warning), and profile lock conflicts with the user's running Chrome.
**How to avoid:** Dedicated profile dir (e.g. `~/.juno/profile` or configurable) + first-run human login handoff. Treat BRWS-04's "real-user profile" as *real persistent identity*, not *the daily directory*.
**Warning signs:** any path handling that defaults to Chrome's User Data location.

### Pitfall 4: Refs treated as durable identifiers
**What goes wrong:** A stored `eN` ref replayed later resolves to nothing (timeout — safe) or, after a navigation resets counters, theoretically to a different element. Refs are counter-based and scoped to the injected-script/page instance [VERIFIED: playwright source + empirical ref behavior].
**How to avoid:** Persist only semantic refs (role+name+scope); re-validate any ref against a fresh snapshot before action (Pattern 3).
**Warning signs:** refs appearing in persisted structures, logs meant for replay, or cross-navigation code paths.

### Pitfall 5: Disambiguation-by-position sneaks in
**What goes wrong:** `getByRole('button', { name: 'X' })` matches 2 buttons; a helpful `.first()` "fix" later clicks the wrong one after a layout change.
**How to avoid:** Multi-match is an `AmbiguousReference` error, full stop. Disambiguation = refine the semantic scope (container role/name chain), never position.
**Warning signs:** `first()`, `nth()`, `last()` anywhere in the browser package.

### Pitfall 6: Headless default on anti-bot-sensitive sites
**What goes wrong:** Classic headless (`chromium.launch({headless:true})` with bundled chromium-headless-shell) leaks automation signals; Instagram-class sites challenge or block, locking the user's real account [CITED: PITFALLS.md anti-bot section].
**How to avoid:** Default headed (`headless: false`); when headless is needed use `channel: 'chrome'` new headless (verified working). No stealth packages — project Out of Scope.
**Warning signs:** headless defaults in config; any stealth dependency.

### Pitfall 7: sessionStorage/indexedDB gaps if anyone switches to storageState later
**What goes wrong:** `storageState` (the *non*-persistent pattern) drops sessionStorage; apps with JWTs in sessionStorage silently log out [CITED: PITFALLS.md / currents.dev].
**How to avoid:** Phase 1 uses full persistent contexts only; storageState is not part of this phase's design. Document the boundary so later phases don't "optimize" into it.

## Code Examples

All examples below were **executed successfully against playwright@1.62.1 + system Chrome (channel:'chrome') in this session** unless labeled otherwise.

### Launch a persistent, dedicated-profile session
```typescript
// Source: empirical verification, playwright@1.62.1, 2026-08-21
import { chromium } from 'playwright';

const ctx = await chromium.launchPersistentContext(dedicatedUserDataDir, {
  channel: 'chrome',      // user's real Chrome; also works headless
  headless: false,        // default headed — anti-bot posture
});
const page = ctx.pages()[0] ?? await ctx.newPage();
await page.goto('https://example.com');
// localStorage/cookies persist across ctx.close() + relaunch (verified)
```

### Second launch on a locked profile fails — handle it
```typescript
// Source: empirical verification — error text (verbatim prefix):
//   "browserType.launchPersistentContext: Failed to create a ProcessSingleton
//    for your profile directory. This usually means that the profile is …"
try {
  const ctx2 = await chromium.launchPersistentContext(sameDir, { channel: 'chrome' });
} catch (e) {
  // map to ProfileInUseError — surface "Juno is already running" to the user
}
```

### Snapshot, extract refs, act by ref
```typescript
// Source: empirical verification
const y = await page.ariaSnapshot({ mode: 'ai', boxes: true });
// - button "Add todo" [ref=e4] [box=354,80,69,21]
const buttonRef = y.split('\n').find(l => l.includes('"Add todo"'))
  ?.match(/\[ref=(e\d+)\]/)?.[1]; // 'e4'
await page.locator(`aria-ref=${buttonRef}`).click();          // works
await page.locator(`aria-ref=${textboxRef}`).fill('text');    // works
await page.locator(`aria-ref=${comboRef}`).selectOption('high'); // works
await page.locator(`aria-ref=${checkboxRef}`).check();        // works
await page.locator(`aria-ref=${someRef}`).scrollIntoViewIfNeeded(); // standard locator API
// NOTE: 'internal:aria-ref=e4' does NOT parse — use plain 'aria-ref=e4' (verified)
```

### Fail-safe semantic resolution (the BRWS-03 core)
```typescript
// Source: empirical verification
// 0 matches:
await page.getByRole('button', { name: 'Does Not Exist' }).click({ timeout: 1000 });
// → TimeoutError  (fail safe)

// 2 buttons both named "X":
await page.getByRole('button', { name: 'X' }).click({ timeout: 1000 });
// → PlaywrightError: "strict mode violation: getByRole('button', { name: 'X' }) …"
//   (fail safe — never picks one silently)

// Stale ref after its element is removed:
await page.locator('aria-ref=e2').click({ timeout: 2000 });
// → TimeoutError (fail safe — verified by removing the element then acting)
```

### pnpm workspace wiring
```yaml
# Source: CITED pnpm.io/workspaces + pnpm.io/settings
# pnpm-workspace.yaml (repo root)
packages:
  - 'packages/*'
```
```json
// packages/browser/package.json — cross-package dependency
{ "dependencies": { "@juno/shared": "workspace:*", "playwright": "1.62.1" } }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Screenshots + vision models as primary agent perception | Accessibility-tree snapshots (ariaSnapshot ai-mode) | 2025–2026 convergence (Playwright MCP, Chrome DevTools MCP, Stagehand) [CITED: ARCHITECTURE.md] | Phase 1 perception = a11y tree; vision is a later scoped fallback |
| CSS/XPath selectors | Semantic locators (`getByRole`) + strict mode | Playwright locators, mature since ~1.28 | Fail-safe grounding is a Playwright default, not custom code |
| `storageState` file reuse | Persistent dedicated profiles | — | Full session fidelity incl. sessionStorage/IndexedDB |
| Stealth/stealth-plugins for logged-in automation | Real persistent profile + human-paced sessions | Doctrine decision (PITFALLS.md, PROJECT.md) | No stealth deps allowed — BRWS-04 |

**Deprecated/outdated:**
- `page.waitForSelector` / `page.waitForTimeout` — discouraged in official docs; use locator actions/assertions.
- `ariaSnapshotJSON` in STACK.md — not shipped as of 1.62.1 (main-branch API).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `aria-ref=` selector engine is safe to build on despite being undocumented in the public API docs (verified working in 1.62.1; exists in injectedScript source; used by Playwright MCP) | Patterns 2–3, Code Examples | If renamed/removed in a future minor, resolution breaks — mitigated by isolating all `aria-ref` usage in one module (`refs.ts`) with a semantic-locator fallback path |
| A2 | Chrome new-headless (channel:'chrome', headless:true) is sufficiently "real-browser" for Phase 1 validation sites; Instagram-class feasibility remains a flagged spike (STATE.md blocker) | Pitfall 6 | Headless runs might still be challenged on some sites — default headed mitigates; spike deferred per STATE.md |
| A3 | The main-branch JSON node schema (`role, name, text, children, states, url, placeholder, ref, cursor, box`) is stable enough to mirror now for a cheap later migration | Pitfall 1 | Minor schema churn at migration time; internal zod schema absorbs it |
| A4 | "Real-user profile" (BRWS-04) is correctly interpreted as a *dedicated persistent profile* rather than the daily Chrome User Data dir (official docs forbid automating the daily profile) | Pattern 4, Pitfall 3 | If the user intended literal daily-profile reuse, Phase 1 needs a requirements conversation — planning should surface this interpretation explicitly |
| A5 | TypeScript ~5.9 is the right pin (npm `latest` shows 7.0.2 pre-release line) | Standard Stack | Minor; planner may confirm team preference |

## Open Questions

1. **Does BRWS-04 mean "dedicated persistent profile" or literally the user's daily Chrome profile?**
   - What we know: Official Playwright/Chrome docs forbid automating the default profile; dedicated dir is the only workable reading.
   - What's unclear: Where the user expects to log in (Juno's profile vs their existing session).
   - Recommendation: Plan for dedicated profile + first-run human login handoff (A4); confirm at plan review.

2. **Bundled Chromium vs system Chrome as the default launch channel?**
   - What we know: Both work; system Chrome verified on this machine; bundled needs a browser-download setup step (revision mismatch present).
   - Recommendation: `channel: 'chrome'` default with `chromium` fallback option; setup task runs `playwright install chromium` regardless.

3. **Scroll semantics** — "scroll" in BRWS-03 can mean `scrollIntoViewIfNeeded()` on an element, or viewport scrolling (`page.mouse.wheel`). Which counts as done?
   - Recommendation: implement element-scoped `scrollIntoViewIfNeeded` as the semantic action, plus a viewport scroll helper; both behind the SemanticActor API.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | runtime | ✓ | v22.22.2 | — |
| pnpm | workspace/dep mgmt | ✓ | 10.33.0 | — |
| npm (for registry checks) | research only | ✓ | 10.9.7 | — |
| Google Chrome (system) | BRWS-04 persistent profile posture | ✓ | `/usr/bin/google-chrome` | bundled Chromium via `playwright install chromium` |
| Playwright bundled Chromium | fallback browser | ✗ (cache has rev 1217; 1.62.1 needs 1234) | — | `channel:'chrome'` (verified) OR run `pnpm exec playwright install chromium` in setup |
| Git | GSD workflow | ✓ | repo present | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** bundled Chromium revision mismatch — setup task must either download rev 1234 or default to system Chrome (recommended).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.11 (unit) + @playwright/test 1.62.1 (e2e) |
| Config file | none — Wave 0 creates `vitest.config.ts` (root) + `playwright.config.ts` (packages/browser) |
| Quick run command | `pnpm --filter @juno/browser test` |
| Full suite command | `pnpm -r test && pnpm --filter @juno/browser exec playwright test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BRWS-01 | URL loads & navigates in a real persistent session | e2e | `pnpm --filter @juno/browser exec playwright test tests/e2e/navigation.spec.ts` | ❌ Wave 0 |
| BRWS-01 | URL input validation (scheme/host) | unit | `pnpm --filter @juno/browser exec vitest run tests/unit/url-validation.test.ts` | ❌ Wave 0 |
| BRWS-02 | Snapshot YAML parses to zod-valid typed tree (roles/labels/text/states/boxes) | unit (fixture YAML from real captures) | `pnpm --filter @juno/browser exec vitest run tests/unit/parse-yaml.test.ts` | ❌ Wave 0 |
| BRWS-02 | Live page yields expected roles/states | e2e | `pnpm --filter @juno/browser exec playwright test tests/e2e/reading.spec.ts` | ❌ Wave 0 |
| BRWS-03 | click/fill/select/scroll by semantic ref succeed | e2e | `pnpm --filter @juno/browser exec playwright test tests/e2e/acting.spec.ts` | ❌ Wave 0 |
| BRWS-03 | 0-match and multi-match refs throw typed GroundingErrors, no action performed | unit (resolver) + e2e (DOM mutation mid-action) | `pnpm --filter @juno/browser exec vitest run tests/unit/refs.test.ts` | ❌ Wave 0 |
| BRWS-03 | Stale ref after DOM change errors instead of acting on wrong element | e2e | `playwright test tests/e2e/failsafe.spec.ts` (remove element, then act) | ❌ Wave 0 |
| BRWS-04 | Dedicated profile persists state across session restarts | e2e | `playwright test tests/e2e/persistence.spec.ts` | ❌ Wave 0 |
| BRWS-04 | Second launch on locked profile raises ProfileInUseError | e2e | `playwright test tests/e2e/profile-lock.spec.ts` | ❌ Wave 0 |
| BRWS-04 | No stealth-evasion deps in the dependency tree | unit (package.json assertion) | `vitest run tests/unit/no-stealth-deps.test.ts` | ❌ Wave 0 |

E2E tests run against a **local fixture page served by the test harness** (deterministic: buttons, textbox, checkbox, combobox, dynamic mutation endpoints) plus one public-site smoke navigation (BRWS-01) — no Instagram dependency in Phase 1 tests (feasibility spike is separately flagged in STATE.md).

### Sampling Rate
- **Per task commit:** `pnpm --filter @juno/browser test` (unit + fast e2e)
- **Per wave merge:** full suite incl. all playwright e2e specs
- **Phase gate:** full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `packages/browser/tests/unit/*` — parser/ref-resolver/url-validation/no-stealth tests (REQs above)
- [ ] `packages/browser/tests/e2e/*` — navigation/reading/acting/failsafe/persistence/profile-lock specs
- [ ] `vitest.config.ts` + `playwright.config.ts` — framework install & config
- [ ] Local fixture HTTP server for e2e determinism (`tests/fixtures/server.ts`)
- [ ] Setup step: `pnpm exec playwright install chromium` (or documented channel:'chrome' default)

## Security Domain

`security_enforcement: true`, ASVS level 1, block on high (from .planning/config.json).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (this phase) | Browser-side auth is the user's own login in the persistent profile; no Juno credential handling |
| V3 Session Management | indirect | Persistent profile dir holds the user's real session cookies — treat dir as sensitive data at rest; never log its contents |
| V4 Access Control | no (single-user local app) | — |
| V5 Input Validation | yes | zod validation of user-supplied URLs (scheme allowlist http/https; reject `file:`/`javascript:`), and zod validation of every parsed snapshot before it enters Juno's model |
| V6 Cryptography | no | No secrets handled by Juno code in this phase |
| V12 File & Resources | yes | userDataDir path comes from config only (no user-supplied arbitrary paths); downloads not part of Phase 1 |

### Known Threat Patterns for Playwright-driven agents (TypeScript/Node)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via page content (SAFE-05 preview) | Elevation of Privilege | Snapshot text/names are **data** — Phase 1 establishes the typed data-fence (zod schema); never `eval` or template-execute page-derived strings |
| Malicious URL schemes (`file:`, `javascript:`, localhost/SSRF-ish internal targets) | Tampering / Information Disclosure | zod URL validation at BrowserSession boundary; explicit scheme allowlist |
| Untrusted site JS attacking the automation layer | Tampering | Keep all logic in Node; never `page.evaluate` with string interpolation of page-derived data |
| Profile data exposure (cookies/session in userDataDir) | Information Disclosure | Profile dir outside repo; pino logs must never dump storage/cookies; documented in module contracts |
| Supply chain (npm installs) | Tampering | Package audit done (above); all verdicts clean or recency false-positives; zero postinstall scripts |

## Project Constraints (from AGENTS.md)

Directives extracted from the repo AGENTS.md (GSD-managed content):

- **GSD workflow enforcement:** all file-changing work must go through GSD entry points (`/gsd-quick`, `/gsd-debug`, `/gsd-execute-phase`); no direct repo edits outside a GSD workflow unless the user bypasses explicitly.
- **Safety constraint (PROJECT.md):** never perform destructive/irreversible actions during autonomous exploration; destructive actions require explicit demonstration or confirmation. Phase 1's SemanticActor is where this hook will attach in Phase 2 — design the API so a guard can wrap every action.
- **Persistence constraint:** learned knowledge survives sessions — Phase 1's persistent profile is the first durable artifact.
- **Cost constraint:** prefer affordable LLMs; Phase 1 uses no LLM at all (pure deterministic browser layer) — keep it that way.
- **Stack constraints (STACK.md):** TypeScript + Node 22, Playwright 1.62.1, pnpm monorepo, no stealth tooling (also REQUIREMENTS.md Out of Scope), no Puppeteer/Selenium/LangChain/browser-use.
- **Conventions:** none established yet (CONVENTIONS.md placeholder) — Phase 1 sets the first conventions; extract-learnings at phase end.

## Sources

### Primary (HIGH confidence)
- **Empirical execution of playwright@1.62.1** (this session, system Chrome via channel:'chrome'): `page.ariaSnapshot({mode:'ai',boxes:true})` YAML shape; `aria-ref=` selector fill/click/selectOption/check; `internal:aria-ref=` rejected; `ariaSnapshotJSON` absent; strict-mode 0-match TimeoutError + multi-match strict violation; stale-ref TimeoutError; ref stability across consecutive snapshots; `launchPersistentContext` persistence across restarts; ProcessSingleton lock failure on second launch; bundled chromium revision mismatch (needs 1234, cache has 1217).
- **Context7 /microsoft/playwright** (official repo docs, main branch): Locator/Page ariaSnapshotJSON options + node schema; `computeAriaRef`/`toInternalOptions` from packages/injected/src/ariaSnapshot.ts (refs only in ai-mode, interactable-only, counter-based, cached on elements); launchPersistentContext userDataDir docs incl. default-profile warning; locators strictness docs (first/last/nth not recommended); actionability checks table.

### Secondary (MEDIUM confidence)
- **pnpm.io/workspaces, pnpm.io/settings, pnpm.io/typescript** (official): workspace globs, `workspace:` protocol, @types conflict handling.
- **.planning/research/PITFALLS.md, ARCHITECTURE.md, STACK.md** (prior project research): anti-bot posture, storageState gaps, AXTree-first consensus, layering rationale.
- **npm registry** (`npm view`): versions + publish dates + postinstall absence for all recommended packages.
- **playwright-mcp issue #588** (github.com/microsoft/playwright-mcp): ref→interaction workflow context.

### Tertiary (LOW confidence)
- None material. (A1's long-term stability of `aria-ref=` is the one knowingly-assumed bet — logged as A1.)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified on npm; core behavior verified by execution.
- Architecture: HIGH — two-layer ref model and fail-safe semantics validated empirically; matches prior ARCHITECTURE.md research.
- Pitfalls: HIGH — pitfalls 1, 2, 3, 4 verified by execution or official docs; pitfall 6 posture inherited from documented project doctrine.

**Research date:** 2026-08-21
**Valid until:** 2026-09-21 (stable domain; re-check if playwright releases a version shipping `ariaSnapshotJSON` before planning completes)
