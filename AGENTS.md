<!-- GSD:project-start source:PROJECT.md -->

## Project

**Juno**

Juno is a semantic website compiler: a tool that takes any website, builds a durable semantic model of its structure and behavior through exploration and testing, and permanently saves that understanding per site (Instagram, Outlook, any job portal). The user can teach Juno how a site works by demonstrating an action, and Juno learns, persists, and later replays that knowledge to automate things that are otherwise very hard to automate. It is also voice-first — the same capability can be driven by speaking.

**Core Value:** Turn any website into a durable, reusable semantic understanding — learned through safe exploration and teach-by-showing — so hard-to-automate actions (messaging someone on Instagram, signing a contract, sending email when no API is exposed, applying to jobs) can be automated reliably without destructive guessing.

### Constraints

- **Safety**: Never perform destructive or irreversible actions during autonomous exploration/testing; destructive actions require either an explicit demonstration or an explicit confirmation.
- **Persistence**: Learned site knowledge must survive across sessions — it is not ephemeral per-task context.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Executive Recommendation (one paragraph)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended (confidence) |
|------------|---------|---------|------------------------------|
| **TypeScript + Node.js** | Node 22 LTS / TS 5.x | Language + runtime | Single language across browser automation, semantic model, agent, and persistence. Static types make the per-site semantic model (pages, elements, actions, selectors) a first-class typed artifact, not ad-hoc JSON. Playwright's TypeScript API is the reference implementation and most complete. **HIGH** |
| **Playwright** | 1.62.1 | Browser automation engine | The de-facto standard for AI agents in 2025–2026. Three reasons specific to Juno: (1) `Locator.ariaSnapshotJSON({ mode: "ai", boxes: true })` returns the accessibility tree as structured JSON (`role`, `name`, `text`, `children`, state flags `checked/disabled/expanded/selected/pressed`, `url`, `placeholder`, `ref`, bounding `box`) — this is *exactly* the raw material for Juno's semantic compiler, no vision model needed. (2) `getByRole()` gives stable, semantic locators that survive layout churn (critical for reliable replay). (3) Cross-browser (Chromium/Firefox/WebKit) and better anti-bot detection evasiveness than Selenium/Puppeteer. **HIGH** (cross-verified: Context7 official docs + npm registry + 5 independent sources) |
| **Vercel AI SDK** | `ai` 7.0.x | Thin LLM abstraction | Model-agnostic provider layer (Anthropic/OpenAI/Gemini behind one interface) with `generateObject()`/`streamText()` that emits **Zod-validated structured output**. This is the right primitive for "compile accessibility snapshot → typed semantic model" and "match demonstrated action → element reference". Lighter than LangChain, no lock-in. **MEDIUM-HIGH** |
| **better-sqlite3** | 13.0.x | Per-site persistent memory (primary) | Synchronous, embedded, zero-server SQLite driver for Node. Juno's learned knowledge is mostly *structured* (pages, element refs, action sequences, portal fingerprints), which is B-tree + FTS5 territory, not vector territory. One `.db` file per site = trivially durable, portable, and diffable. **HIGH** |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **sqlite-vec** | 0.1.9 | Embedded vector search (SQLite extension) | Only when similarity matching is needed — e.g. "recognize shared job-portal across sites" (compare page-structure fingerprints) or fuzzy element matching. Drop-in extension loaded into the *same* `better-sqlite3` file; no separate process. **MEDIUM** |
| **zod** | 4.4.3 | Schema validation | Define the semantic-model schema (`SiteModel`, `Page`, `Element`, `Action`, `Portal`) and validate LLM-structured output + action definitions. Universal standard. **HIGH** |
| **@ai-sdk/anthropic** (+ `@ai-sdk/openai`) | 4.0.x / 4.0.x | LLM providers | Claude for reliable structured extraction + optional multimodal (vision fallback); OpenAI/Gemini as alternates. **HIGH** |
| **@playwright/test** | 1.62.1 | Testing the compiler itself | Snapshot assertions (`toMatchAriaSnapshot`) to regression-test that the compiler's model of a site is stable. Also the natural harness for teach-by-showing recordings. **HIGH** |
| **pino** | 10.3.x | Structured logging | Trace every agent step/action for auditability (a safety requirement — you must be able to prove what Juno did and why). **MEDIUM** |
| **@axe-core/playwright** | 4.13.0 | Optional a11y audit | Not core — but axe uses the same accessibility tree, useful for detecting when a site's DOM has *no* accessible semantics (a signal to switch to vision fallback). **LOW-MEDIUM** |
| **patchright** (or `playwright-extra` + `playwright-stealth`) | 1.62.1 / 4.3.x | Anti-bot evasion | **Use with caution and only for sites the user owns/controls.** For Instagram-like sites, prefer `launchPersistentContext` with the user's *real* browser profile over stealth patches (stealth is fragile and can violate ToS). See "Safety & Anti-Bot" below. **LOW** |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **pnpm** | Package manager | Fast, strict, good for a monorepo with future `@juno/*` packages |
| **Vitest** | Unit tests for the semantic model + persistence | Pure-TS logic (compiler, memory) is fast to test without a browser |
| **@playwright/test** | E2E / browser tests | The browser-touching test surface |
| **ESLint + Prettier** | Lint/format | Standard |
| **tsx** | TS execution/dev runner | Hot-reload during agent development |

## Installation

# Core

# Testing / dev

# Browser binaries (download Chromium; add firefox/webkit if cross-browser is needed)

# Optional: accessibility auditing + stealth (only if needed)

# pnpm add patchright                 # anti-bot evasion — LAST resort, see notes

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Playwright** | Puppeteer 25.x | Puppeteer is fine for Chrome-only scraping, but it has **no accessibility-tree snapshot API**, no WebKit, and is CDP-only — it lacks the exact primitive Juno's semantic compiler depends on. |
| **Playwright** | Selenium | Selenium is WebDriver-protocol (slowest, most flake-prone, most easily detected by anti-bot). Legacy/enterprise shops use it for grid testing, not for building an agent. |
| **Playwright (direct)** | Stagehand 4.0.x (`@browserbasehq/stagehand`) | Stagehand is the closest existing analog (its `observe()` uses the *same hybrid accessibility tree*, and its `act()`+cache implements a per-action replay). **Use Stagehand as a *reference pattern*, not a dependency** — Juno needs its own typed semantic model + per-site persistence, which Stagehand's action-cache doesn't provide. |
| **DOM/accessibility-first** | Skyvern (vision-first) | Skyvern's screenshot→vision approach wins on canvas/legacy sites with no accessible DOM, but is ~3–10× more expensive per step. Borrow the *Planner–Actor–Validator* idea and the *vision fallback*, not the always-vision default. |
| **better-sqlite3 + sqlite-vec** | LanceDB (`@lancedb/lancedb` 0.37.x) | LanceDB adds a heavy native dep and a separate `.lance` directory; sqlite-vec keeps vectors co-located in the same `.db` file. For Juno's mostly-structured memory, LanceDB is overkill. |
| **better-sqlite3 + sqlite-vec** | pgvector | pgvector is the right answer *only* if you already run Postgres (multi-user cloud). A local, per-site memory file should not require a server. |
| **Custom state machine + AI SDK** | LangGraph (`@langchain/langgraph` 1.4.x) | LangGraph's `interrupt()` + checkpointer gives first-class HITL, but (a) its graph/agent-loop model is built for *autonomous multi-step planning* — the opposite of Juno's deterministic teach-by-showing — and (b) resuming a node after `interrupt()` **re-executes non-idempotent node logic**, which is dangerous for browser clicks. Reconsider only if Juno later needs genuinely autonomous long-horizon planning. |
| **AI SDK** | LangChain | LangChain is a heavier abstraction; the AI SDK's Zod-structured `generateObject` covers Juno's needs with far less surface area. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **browser-use (Python)** | 85k-star "gorilla," but it is *autonomous guessing* (LLM decides each step). That is precisely the failure mode Juno exists to avoid ("a wrong test can cause real damage"). Also Python-forces a language split. | Playwright + custom semantic compiler (TypeScript). |
| **Skyvern** | Vision-at-every-step is the most expensive and slowest sensing strategy; justified only for canvas/legacy sites. | DOM/accessibility-first; vision as a scoped fallback. |
| **Puppeteer** | No accessibility-tree snapshot (`ariaSnapshotJSON`), Chromium-only, CDP-only. | Playwright. |
| **Selenium** | WebDriver overhead, flakiest, easiest to detect by anti-bot systems on Instagram/Outlook/portals. | Playwright. |
| **LanceDB / Chroma / pgvector** | Separate process/directory/server for vector search Juno barely needs (memory is mostly structured). | better-sqlite3 (+ sqlite-vec only when embeddings are added). |
| **LangGraph / LangChain** | Heavyweight graph + abstraction for a workflow that is a deterministic replay + a simple approval gate; `interrupt()` resume re-runs node logic (double-click risk). | Custom TypeScript state machine + AI SDK. |
| **browserless / Browserbase cloud** (as the *primary* runtime) | Adds a network dependency and per-session cost to a local, personal agent. Only warranted when scaling to many concurrent remote sessions. | Local `launchPersistentContext`; swap in a cloud runtime later behind the same Playwright API if needed. |
| **playwright-stealth (default)** | Fragile, churn-sensitive, and arguably ToS-risky. For the user's *own* accounts the correct approach is a real persistent profile, not bot-evasion. | `launchPersistentContext` + human-like pacing; stealth only as a last resort. |

## Stack Patterns by Variant

- Use **SQLite (better-sqlite3)** for memory + **`launchPersistentContext`** with the user's real browser profile for authenticated sites (Instagram/Outlook). No server, no cloud, everything durable on disk.
- Keep the Playwright API; swap the browser runtime to **Browserbase or browserless** behind an abstraction (`BrowserProvider` interface). The semantic compiler and memory layer do not change.
- Use **vision fallback**: screenshot → multimodal LLM (Claude/GPT vision) → coordinate-space clicks. Store the result as an element *annotation* in the semantic model so the fallback is learned once and reused.
- Add **sqlite-vec** embeddings over page-structure fingerprints and query for nearest-neighbor portal match before falling back to full exploration.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| playwright@1.62.1 | Node 22 LTS | Requires `playwright install chromium` post-install |
| better-sqlite3@13.0.x | Node 22 LTS | Ships prebuilt binaries; `@types/better-sqlite3` for TS |
| sqlite-vec@0.1.9 | better-sqlite3@13.x | Load as `db.loadExtension(...)`; co-located in same `.db` |
| ai@7.0.x | @ai-sdk/anthropic@4.x, @ai-sdk/openai@4.x, zod@4.x | `generateObject` emits Zod-validated output |
| zod@4.4.x | ai@7.x | v4 API; pin major version |

## Safety & Anti-Bot (cross-cutting, affects stack choice)

## Sources

- **Context7 `/microsoft/playwright`** (official docs) — `Locator.ariaSnapshotJSON` (`mode: "ai"`, `boxes`, node schema: role/name/text/children/states/url/placeholder/ref/box), `getByRole`, `toMatchAriaSnapshot`, `toHaveRole`/`toHaveAccessibleName`. [MEDIUM, cross-verified]
- **Context7 `/browserbase/stagehand`** (official docs) — `act`/`extract`/`observe` primitives, `observe()` uses "hybrid of DOM and accessibility tree", `observe→act` replay, cache status HIT/MISS, v4 SDKs (TS/Python/Go). [MEDIUM]
- **npm registry** (`npm view`) — authoritative current versions: playwright 1.62.1, puppeteer 25.8.0, better-sqlite3 13.0.3, sqlite-vec 0.1.9, zod 4.4.3, ai 7.0.73, @ai-sdk/anthropic 4.0.40, @langchain/langgraph 1.4.12, @browserbasehq/stagehand 4.0.2, patchright 1.62.1, @lancedb/lancedb 0.37.1. [HIGH for versions]
- **dev.to "Browser Tools for AI Agents Part 2"** — architecture split (DOM-first vs vision-first vs hybrid), browser-use 85k★ vs Stagehand 21.8k★ vs Skyvern 21k★, cost/token tables, Stagehand v3 CDP-native + caching. [MEDIUM]
- **skyvern.com "Browser Use vs Stagehand" (Feb 2026)** — execution-model comparison, Stagehand hybrid determinism + cache replay, Skyvern Planner-Actor-Validator 85.85% WebVoyager. [MEDIUM]
- **github "Browser Automation Platforms Comparison" + "Memory Technology Stack Analysis"** — accessibility tree > screenshots for agent accuracy; sqlite-vec replaces LanceDB (co-located, Mozilla-sponsored); "structured retrieval → row store + B-tree beats vector path". [MEDIUM]
- **zeroentropy.dev "Vector Database"** — vector-DB is the wrong abstraction when retrieval is heavily structured (matches Juno's memory shape). [MEDIUM]
- **langchain.com / langgraphjs "Human-in-the-loop"** — `interrupt()` + checkpointer HITL; resume re-executes node logic (non-idempotent API-call warning). [MEDIUM]

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
