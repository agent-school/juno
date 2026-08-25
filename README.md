# Juno

Juno is a semantic website compiler: it learns how any website works through safe exploration and teach-by-showing, saves that understanding permanently per site, and replays it to automate actions that are hard to automate any other way (messaging someone on Instagram, signing a contract, applying to a job).

**Status:** Phase 1 of 7 complete — the Browser Core. Juno can already load any site in a real persistent Chrome profile, read the page's semantic structure from the accessibility tree, and act on elements by semantic reference with fail-safe behavior. Later phases add the safety guard, site compiler, planner/replay, teach-by-showing, and voice.

| Phase | Name | Status |
|-------|------|--------|
| 1 | Browser Core | ✓ Complete |
| 2 | Safe-Execution Guard | planned |
| 3 | Site Compiler & Per-Site Memory | planned |
| 4 | Planner, Execution & Authenticated Sites | planned |
| 5 | Teach-by-Showing | planned |
| 6 | Portal Recognition | planned |
| 7 | Voice Control | planned |

## What's built (Phase 1)

The [`@juno/browser`](packages/browser) package — the foundation every later phase sits on:

- **`BrowserSession`** — a persistent real-user Chrome session under a dedicated profile (`~/.juno/profile`, override with `JUNO_PROFILE_DIR`). Login state survives restarts; a second session on the same profile fails with a typed `ProfileInUseError` instead of crashing. URLs are zod-validated (http/https only) before any navigation.
- **`SemanticPageReader`** — the *only* way Juno sees a page: captures the accessibility tree (`ariaSnapshot` in ai mode with bounding boxes), parses it behind a single YAML boundary, and validates it into a typed `PageTree` via zod. Malformed snapshots become typed errors — never partially trusted.
- **`SemanticActor`** — the fail-safe action surface. Click, type, select, check, scroll — all by **semantic reference** (role + accessible name), never brittle CSS/XPath. When the page changes, references fail safe with typed errors (`GroundingTimeout`, `AmbiguousReference`, `StaleReference`) — Juno never guesses and never clicks the wrong element.
- **Doctrine gates, enforced by tests:** no stealth-evasion tooling ever, no positional disambiguation (`first()/nth()/last()`), no manual sleeps, raw Playwright errors never escape the public API.

## Prerequisites

- **Node.js 22 LTS**
- **pnpm** (`npm install -g pnpm`)
- **Google Chrome** installed at the system location (default launch uses your real Chrome via `channel: 'chrome'`)

## Setup

```bash
git clone <this-repo> && cd juno
pnpm install
```

No build step needed — packages export TypeScript source directly.

## How to test

All commands run from the repo root.

```bash
# Unit tests (fast, no browser) — 31 tests
pnpm test

# Type check (also the "build" gate)
pnpm run build

# E2E tests (real Chrome + auto-started local fixture server) — 15 tests
pnpm test:e2e
```

What the e2e suite proves, in plain language:

- A real persistent Chrome session loads and navigates validated URLs
- Login/profile state **survives a browser restart**; a second session on the locked profile fails typed
- Juno reads a live page into a validated semantic tree (roles, names, states, refs, boxes) — including the empty-page edge case
- Juno clicks, types, selects, checks, and scrolls by semantic reference, with observable page effects
- **Fail-safe proof:** with the target button removed → typed `GroundingTimeout`; with two identically-named buttons → typed `AmbiguousReference`; with a stale snapshot ref → typed rejection. In every case *nothing* gets activated (asserted against the fixture page's activation log).

The e2e suite needs no manual setup — Playwright auto-starts the deterministic fixture server on `127.0.0.1:8931` (and reuses one if already running).

## How to try it (demo)

```bash
# Terminal 1: start the local fixture page
pnpm demo:serve

# Terminal 2: run the demo — opens a real, visible Chrome window
pnpm demo
```

You'll watch Chrome open the fixture page, see Juno's semantic view of it printed to your terminal, and watch Juno fill the textbox and click "Add task" by semantic reference.

Headless variant (no window): `JUNO_DEMO_HEADLESS=true pnpm demo`

## How to use the library

```ts
import {
  BrowserSession,
  SemanticPageReader,
  SemanticActor,
  GroundingTimeout,
  AmbiguousReference,
} from '@juno/browser';

// 1. Launch a persistent, real-user Chrome session.
//    First run on a real site: log in once by hand — the profile remembers.
const session = new BrowserSession(); // headed by default (anti-bot posture)
const page = await session.launch();
await session.goto('https://example.com');

// 2. Read the page's semantic structure (validated typed tree)
const reader = new SemanticPageReader();
const tree = await reader.read(page);
// tree.children → SnapshotNode[] with role, name, text, states, ref, box...

// 3. Act by semantic reference — strict, exact, fail-safe
const actor = new SemanticActor(page);
await actor.fill({ role: 'textbox', name: 'Search' }, 'hello');
await actor.click({ role: 'button', name: 'Submit' });

// When the page changed, you get typed errors — never a wrong click:
try {
  await actor.click({ role: 'button', name: 'Submit' });
} catch (e) {
  if (e instanceof GroundingTimeout) { /* element gone / never appeared */ }
  if (e instanceof AmbiguousReference) { /* name matches 2+ elements */ }
}

await session.close(); // profile state persists for next time
```

Ephemeral in-session refs (the `eN` ids from a snapshot) also work — they're re-validated against a fresh snapshot before every action, so a stale ref can never hit the wrong element:

```ts
const node = tree.children.flatMap(function flat(ns) {
  return ns.flatMap((n) => [n, ...flat(n.children)]);
}).find((n) => n.name === 'Submit');
await actor.click({ ref: node.ref, role: node.role, name: node.name });
```

## Project structure

```
packages/browser/        @juno/browser — session, perception, action (this phase)
  src/session.ts         BrowserSession: persistent Chrome + URL validation
  src/profile.ts         Dedicated profile dir resolution + lock guard
  src/reader.ts          SemanticPageReader: snapshot → validated typed tree
  src/parse-yaml.ts      The single YAML parse boundary
  src/snapshot-schema.ts zod schemas + SnapshotNode/PageTree types
  src/refs.ts            Two-layer reference model (semantic + ephemeral)
  src/actor.ts           SemanticActor: fail-safe actions
  src/errors.ts          Typed error taxonomy
  tests/unit/            vitest (31 tests)
  tests/e2e/             Playwright against a real Chrome (15 tests)
  tests/fixtures/        Deterministic local fixture HTTP server
.planning/               GSD workflow state (roadmap, plans, summaries)
```

## Development notes

- **Stack:** TypeScript (strict, NodeNext), Playwright 1.62.1, zod 4, pino, vitest, pnpm workspaces.
- **Why `channel: 'chrome'`:** launches your real installed Chrome — required for the real-user-profile posture and more resilient than bundled Chromium on anti-bot-sensitive sites.
- **Never** point Juno at your daily Chrome "User Data" directory; it uses its own dedicated profile by design.
- E2e tests opt into headless explicitly; the product default stays **headed**.

## Roadmap next up

**Phase 2 — Safe-Execution Guard:** action classification (read / write-benign / write-destructive), destructive-action confirmation gates, audit log, kill switch, prompt-injection defense. See `.planning/ROADMAP.md` for the full plan.
