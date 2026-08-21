# Architecture Research: AI Browser-Automation Agent ("Semantic Website Compiler")

**Domain:** AI browser-automation / computer-use agent (Juno)
**Researched:** 2026-08-21
**Confidence:** HIGH (on canonical agent architecture) / MEDIUM (on Juno's novel "compiler" + teach-by-showing synthesis)

## Executive Summary

Browser-automation agents converged on a layered architecture with one dominant lesson from
production experience: **architectural decisions determine success or failure, not model
capability** (arXiv:2511.19477, a year-long production study). The industry has also settled the
perception debate — the accessibility tree (AXTree via Chrome DevTools Protocol) is the primary
perception surface, with vision used selectively as a fallback, *not* the reverse. And the single
most important architectural boundary is the **safe-execution guard**: prompt-injection and
destructive-action analysis show safety must be enforced in *code*, not LLM reasoning.

Juno's three differentiators — (1) a **compiler** mental model, (2) **teach-by-showing**, and
(3) **persistent per-site memory** — do not exist as a combined system in the ecosystem today.
Skyvern has the multi-agent loop but is one-off, not compiled/persistent per site. Browser-Use has
the element-extraction layer but no durable semantic model or demonstration learning. OpenAI Codex
Record & Replay has teach-by-showing but produces a natural-language "skill" (a prompt artifact),
not a compiled, queryable site model. This means Juno's *novel* components are the Site Compiler,
the demonstration→skill compiler, and the per-site memory store — everything below them is
well-trodden ground.

---

## Standard Architecture

### System Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        INTENT LAYER (input modalities)                     │
│   ┌──────────┐    ┌───────────┐    ┌───────────────┐                       │
│   │  Voice   │    │  Typed    │    │ Scheduled/    │                       │
│   │  (ASR→NLU)│    │  command  │    │ API trigger   │                       │
│   └────┬─────┘    └─────┬─────┘    └──────┬────────┘                       │
│        └───────────────┬──────────────────┘                               │
│                        ▼                                                   │
├────────────────────────────────────────────────────────────────────────────┤
│                      PLANNER / AGENT LOOP (the "brain")                     │
│   Decomposes intent → steps; loads site model + skills; emits plan          │
│   (single-loop, or Planner→Actor→Validator split à la Skyvern)              │
├────────────────────────────────────────────────────────────────────────────┤
│                    SEMANTIC COMPILER (Juno's core, novel)                   │
│   Site Model: pages, nav graph, elements, affordances, portal fingerprint   │
│   Skill IR:   parameterized, portable action plans from demonstrations      │
│   Grounding:  maps a semantic step → concrete DOM/ref action per site       │
├────────────────────────────────────────────────────────────────────────────┤
│                     SAFE-EXECUTION GUARD (code-enforced)                    │
│   Destructive-action classifier · confirmation gates · domain allowlist    │
│   action restriction · sandbox/dry-run mode · audit log                     │
├────────────────────────────────────────────────────────────────────────────┤
│                      EXECUTION LAYER (browser control)                      │
│   Playwright/CDP · element ref system (versioned) · action primitives       │
│   wait/state-sync · bulk actions · error feedback                           │
├────────────────────────────────────────────────────────────────────────────┤
│                      PERCEPTION LAYER (page → state)                        │
│   AXTree snapshot (primary)  +  selective vision (fallback)                 │
├────────────────────────────────────────────────────────────────────────────┤
│                     PER-SITE PERSISTENT MEMORY (durable)                    │
│   Site models · learned skills · locators · outcomes · portal fingerprints  │
│   (keyed by site identity, survives sessions)                               │
└────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation | Juno-specific note |
|-----------|----------------|------------------------|--------------------|
| **Voice interface** | Speech→intent; voice confirmation of risky actions | STT (Whisper/cloud ASR) + NLU; optional TTS for prompts | Thin wrapper — reuses the typed-intent path |
| **Planner / agent loop** | Turn intent into a step plan; decide next action | ReAct-style loop, or Planner/Actor/Validator (Skyvern) | Plan *semantic* steps, not DOM actions |
| **Semantic compiler** | Build & maintain durable site model; compile demonstrations into reusable skills; ground semantic steps to concrete actions | **No direct precedent — Juno's novel core** | This is the "compiler" the product is named for |
| **Safe-execution guard** | Gate every action before it reaches the browser | Code-enforced allow/deny rules, not LLM judgment (arXiv 2511.19477 §8) | Must wrap *all* writes, submits, sends, signs |
| **Execution layer** | Translate grounded actions into real browser events | Playwright / CDP / Puppeteer | Use versioned element refs, bulk actions |
| **Perception layer** | Produce a normalized page-state from the live page | AXTree snapshot (primary) + screenshot (fallback) | Hybrid is the consensus choice |
| **Per-site memory** | Persist everything learned about a site across sessions | SQLite/Postgres + JSON blobs; content-addressed locator store | Keyed by site identity + portal fingerprint |

---

## Recommended Project Structure

```
src/
├── intents/            # Voice + typed intent: ASR, NLU, intent schema (thin)
│   ├── asr.ts          # speech → text (delegates to STT provider)
│   ├── nlu.ts          # text → structured Intent {verb, args, site}
│   └── voice-confirm.ts# TTS + spoken confirmation loop for risky actions
├── planner/            # Agent loop: plan, decide, adapt
│   ├── loop.ts         # observe→plan→act→validate cycle
│   ├── planner.ts      # intent → semantic step plan
│   └── validator.ts    # step post-conditions / error recovery
├── compiler/           # THE semantic website compiler (novel core)
│   ├── explorer.ts     # safe exploration to discover pages/nav/elements
│   ├── site-model.ts   # pages, nav graph, elements, affordances
│   ├── portal.ts       # shared-portal fingerprinting & matching
│   ├── skill-ir.ts     # the action/step IR (portable, parameterized)
│   ├── grounding.ts    # semantic step → concrete action per site
│   └── demo-compiler.ts# demonstration trace → reusable skill (teach-by-showing)
├── guards/             # safe-execution guard (code-enforced)
│   ├── action-classifier.ts # destructive vs reversible action taxonomy
│   ├── confirmation.ts  # human-in-the-loop gates
│   ├── allowlist.ts    # domain + action restriction policy
│   └── audit.ts        # immutable action log
├── execution/          # browser control layer
│   ├── browser.ts      # Playwright/CDP lifecycle
│   ├── refs.ts         # element reference system + snapshot versioning
│   ├── actions.ts      # click/type/hover/select/upload/drag/pan/wait...
│   └── bulk.ts         # bulk-action batching
├── perception/         # page → state
│   ├── axtree.ts       # accessibility-tree snapshot (primary)
│   ├── vision.ts       # selective screenshot + bounding-box fallback
│   └── state.ts        # normalized PageState type
├── memory/             # per-site persistent memory
│   ├── store.ts        # DB access (SQLite for local, Postgres for server)
│   ├── site-key.ts     # site identity + portal fingerprint → key
│   └── migrate.ts      # schema/version migration for learned models
└── shared/             # types, config, logging
```

### Structure Rationale

- **`compiler/` is deliberately separate from `execution/` and `perception/`.** The compiler is
  the durable, portable knowledge; execution/perception are ephemeral and browser-bound. This is
  the architectural seam that makes "compiled site knowledge survives sessions" possible.
- **`guards/` sits between `planner/` and `execution/`** as the single choke point. Nothing that
  mutates page state may bypass it. This mirrors the production finding that safety boundaries must
  be programmatic, not prompt-based.
- **`intents/` is thin** because voice is a modality, not a subsystem — it should funnel into the
  exact same `Intent` type the typed path produces.
- **`memory/` is a dedicated module** with its own migration story, because learned models are
  versioned data and will need schema evolution as the compiler's IR matures.

---

## Architectural Patterns

### Pattern 1: Hybrid Perception (AXTree primary, vision fallback)

**What:** The agent reads pages primarily through the browser accessibility tree (roles, labels,
focus state, interactive elements, resolved ARIA relationships) and invokes vision (screenshot +
bounding-box model) only for elements missing from the tree (canvas, charts, images, non-WCAG UI).

**When to use:** Always — this is the consensus choice across Playwright MCP, Chrome DevTools MCP,
Browser-Use, and the production study (arXiv:2511.19477 §4.4).

**Trade-offs:** AXTree is compact and semantic but breaks on non-compliant markup and can misreport
z-order/occlusion; vision is universal but unreliable on dense grids (24px calendar cells) and
canvas-only apps. Combined, each covers the other's blind spot.

**Why it matters for safety (Juno-critical):** The execution layer can *block by label* on
accessibility-based actions (e.g. "block clicks on elements whose label contains 'delete' unless
confirmed"). Coordinate-based clicking provides no such guarantee. This is a core reason to build
the semantic model on the AXTree, not pixels.

### Pattern 2: Versioned Element Reference System

**What:** Each interactive element in a snapshot gets a ref (e.g. `39`); the execution layer keeps
a ref→DOM-node map. Because the DOM mutates between renders, each ref is versioned (e.g. `1:39` =
snapshot version 1, element 39). A tool call whose version mismatches the live state **fails
safely** instead of clicking the wrong element.

**When to use:** In the execution layer, whenever the agent references a concrete element.

**Trade-offs:** Globally-unique multi-char IDs eliminate collision risk but cost tokens; versioned
integers balance safety and token efficiency. This pattern is what makes replayed actions not
click a "Delete" button that replaced a "Cancel" button.

**Juno note:** This is the *concrete* grounding target. The semantic compiler's job is to produce a
ref that survives; the execution layer's job is to verify it's still valid before acting.

### Pattern 3: Semantic Action IR + Grounding (the "compiler" core)

**What:** Distinguish two levels of action representation and compile between them:
- **Semantic step** (portable, site-agnostic): `send_message(recipient, body)`,
  `apply_to_job(role_id)`, `submit_form("contract-signature")`.
- **Concrete action** (site-grounded): `click(ref=42)` → `type(ref=17, "Hello")` →
  `click(ref=55)`, valid only against a specific site's current snapshot.

The compiler maintains the mapping. When the site changes, re-grounding re-resolves semantic steps
to new refs using the site model — this is what makes learned actions resilient to layout drift.

**When to use:** Always. This IR is the single most important abstraction for the "durable semantic
model" requirement.

**Trade-offs:** Requires a site model that is genuinely durable and correct; if the model drifts
stale, grounding produces wrong actions. Mitigate by re-validating refs at execution (Pattern 2)
and re-exploring on drift detection.

### Pattern 4: Demonstration Recording → Skill (teach-by-showing)

**What:** Record the user's demonstrated action stream — captured via the accessibility API + input
events (not pixel coordinates, so *intent* is preserved), per OpenAI Codex Record & Replay's
`event-stream` approach — then compile that trace into a parameterized, reusable skill with
placeholders for variable inputs (recipient, message body, file path).

**When to use:** For any "teach Juno how a site works" flow. This is the safer alternative to
autonomous guessing the product is built around.

**Trade-offs:** Recording produces a *single* example that must be generalized to a parameterized
skill (the hard part). Capture semantics (element roles/labels/context) not coordinates, and
redact secrets from the recorded trace. The compiled skill is a first-class data artifact stored in
per-site memory, *not* a natural-language prompt — this is where Juno exceeds Codex's approach.

### Pattern 5: Code-Enforced Safety Boundaries

**What:** Safety is enforced as deterministic programmatic constraints in the guard layer:
destructive-action classification, confirmation gates, domain allowlisting, and action restriction
— **not** by asking the LLM to be careful.

**When to use:** Always. The production study is unambiguous: prompt-injection attacks make
general-purpose autonomous operation *fundamentally unsafe*; "specialized tools with programmatic
constraints, where safety boundaries are enforced through code instead of LLM reasoning" is the
only defensible posture (arXiv:2511.19477 §8).

**Trade-offs:** A code gate is rigid — it will block some legitimate actions. Prefer allowlist +
explicit confirmation over silent blocking, and make the classifier's decisions auditable.

---

## Data Flow

### 1. Voice/typed → intent

```
Speech ──ASR──▶ text ──NLU──▶ Intent {verb, args, site}
                                    │
Typed command ──────────────────────┘
```
Both modalities converge on one `Intent` type. Voice adds a *confirmation* path (spoken prompt +
verbal yes/no) for risky verbs, but the intent itself is modality-agnostic.

### 2. Intent → plan (planner)

```
Intent ──▶ Planner
             ├── load Site Model (from memory, keyed by site identity)
             ├── load matching Skills (from memory)
             └── emit semantic step plan [send_message(recip, body), ...]
```

### 3. Plan → grounded actions (compiler + guard + execution)

```
semantic step ──Grounding──▶ concrete action (versioned ref) 
                                   │
                                   ▼
                          SAFE-EXECUTION GUARD
                          ├── classify (destructive?)
                          ├── allowlist check
                          ├── confirm if risky  ◀── human / voice confirm
                          └── log to audit
                                   │ (approved)
                                   ▼
                          EXECUTION LAYER → Playwright/CDP → browser
                                   │
                                   ▼
                          PERCEPTION → new PageState (AXTree + optional vision)
```

### 4. Validate + persist (closed loop)

```
new PageState ──▶ Validator ──▶ success? ──▶ update memory (outcome, refined locators)
                         │
                         └── failure ──▶ fresh snapshot + adapt (never retry identical action)
```

### 5. Teach-by-showing (demonstration → skill → memory)

```
user demonstrates action ──▶ Recorder (event stream: AX + input, semantic)
                                   ▼
                          demo-compiler: generalize → parameterized Skill
                                   ▼
                          memory (per-site) — persists across sessions
```

### 6. Portal recognition (reuse across sites)

```
new site ──▶ portal fingerprint (nav/selectors/URL patterns) ──▶ match known portal?
                                                                ├── yes ──▶ load & reuse shared skills
                                                                └── no  ──▶ explore + compile fresh
```

---

## Build Order (dependency-driven)

Dependencies flow **bottom-up**: everything sits on the browser/perception foundation, and the
novel compiler layer sits on top of it. The safe-execution guard is *not* deferrable — it must be
co-developed with the execution layer from the first destructive-capable build.

| Phase | Component(s) | Depends on | Rationale / why now |
|-------|--------------|------------|---------------------|
| **1** | Execution layer + Perception layer | — | Foundation. No higher layer can exist without a way to act on and read the browser. |
| **2** | Safe-execution guard | 1 | **Co-develop, do not defer.** As soon as the executor can `click`/`type`, it can destroy. The guard is code, and retrofitting code-level safety is far harder than building it in. |
| **3** | Per-site memory + Site Model (compiler: explorer + site-model) | 1, 2 | The "durable semantic model" requires persistence + safe exploration. Memory is the substrate the rest of the compiler reads/writes. |
| **4** | Semantic Action IR + Planner loop | 1, 3 | The IR needs a site model to ground against; the planner needs the IR to express plans. This is the first end-to-end "compile a site, execute an action" milestone. |
| **5** | Demonstration compiler (teach-by-showing) | 1, 3, 4 | Recording captures *semantic* events (needs perception), and compiling them into skills needs the IR + memory. Arrives after the IR exists. |
| **6** | Portal recognition | 3, 5 | Needs fingerprints (from site model) + skills (from demonstration compiler) to match and reuse. |
| **7** | Voice interface | 4 | Pure modality addition — wraps the existing intent path. Intentionally last because it depends on everything semantic being stable. |

**Phase-ordering rationale:** Phases 1–2 establish a *safe* browser primitive; Phase 3 makes
knowledge durable; Phase 4 makes the system actually useful end-to-end; Phases 5–6 deliver the two
differentiators (teach-by-showing, cross-site reuse); Phase 7 is a thin win layered on top. Do
**not** put teach-by-showing (Phase 5) before the IR (Phase 4) — a recorded demonstration needs
something to compile *into*.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **0–1k users (local/desktop)** | Single process; SQLite for per-site memory; one browser context per user session. Monolith is correct. |
| **1k–100k users (server)** | Separate browser-fleet worker pool from the planner/compiler services; Postgres for memory; queue for automation jobs; headless browser containers (Browserbase-style or self-hosted). |
| **100k+ users** | Shard the browser fleet by region; content-addressed locator/skill cache; compiled models as versioned, distributable artifacts (so a portal skill learned once is shared, not re-learned per user). |

### Scaling Priorities

1. **First bottleneck — browser fleet cost/latency.** Running a real browser per task dominates
   cost and is the first thing to break. Fix: headless + bulk actions + snapshot caching (the
   production study cut token/tool-call volume ~40–74% with bulk actions).
2. **Second bottleneck — memory access under concurrency.** Per-site models read/written by many
   concurrent sessions need transactions + optimistic locking; the compiler's read-modify-write
   cycle is the contention point.
3. **Third bottleneck — model staleness.** As sites drift, compiled models go stale. Fix:
   drift-detection (ref validation failures trigger re-exploration) before it becomes a reliability
   cliff.

---

## Anti-Patterns

### Anti-Pattern 1: Vision-first (screenshot + coordinates) as the primary interaction surface
**What people do:** Feed screenshots and ask the model for click coordinates.
**Why it's wrong:** Fails on dense grids (24px date cells), canvas apps (Sheets/Figma), and gives
no semantic handle for safety gating. The production study abandoned grid/coordinate approaches.
**Do this instead:** AXTree primary + selective vision fallback (Pattern 1).

### Anti-Pattern 2: "Let the LLM judge safety"
**What people do:** Prompt the model to "be careful" / "don't click destructive buttons."
**Why it's wrong:** Prompt-injection attacks defeat prompt-level defenses at non-trivial rates, and
for high-impact privileges even 1% failure is unacceptable.
**Do this instead:** Deterministic code gates (Pattern 5) — classify, allowlist, confirm, log.

### Anti-Pattern 3: Storing learned knowledge as prompts (or not storing it at all)
**What people do:** Treat site knowledge as ephemeral conversation context; or capture a skill as a
natural-language description and re-derive actions every time.
**Why it's wrong:** Non-durable, non-queryable, re-grounds from scratch each run, and drifts with
the model. This is precisely the gap between one-off agents (Skyvern/Operator) and a "compiled"
site.
**Do this instead:** A durable, typed site model + skill IR in per-site memory (Pattern 3).

### Anti-Pattern 4: Recording pixel coordinates in teach-by-showing
**What people do:** Replay raw (x,y) clicks from a recorded demonstration (classic RPA macro).
**Why it's wrong:** Breaks on any layout change; captures *where* not *what* the user meant.
**Do this instead:** Record semantic events (element role/label/context via accessibility API) and
compile to a parameterized skill that re-grounds at execution time.

### Anti-Pattern 5: Retrying the identical action on failure
**What people do:** On failure, retry the same click/type blindly.
**Why it's wrong:** Burns actions/tokens, and in a destructive-capable context can double-execute
(e.g. sending a message twice).
**Do this instead:** The production failure-adaptation protocol — never retry the identical action;
analyze the error, try a fundamentally different approach, and reconsider the goal if the second
attempt also fails.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes / gotchas |
|---------|---------------------|-----------------|
| Playwright (or CDP directly) | Library, in-process browser control | Cross-browser, resilient locators, `get_by_role` maps naturally to AXTree. Browser-Use left Playwright for raw CDP only for AXTree perf — a tradeoff to revisit at scale. |
| STT/ASR provider (voice) | HTTP API (streaming) | Keep behind the `intents/asr` seam; do not couple NLU to a single vendor. |
| LLM (planner/grounding/validator) | HTTP API, structured output | Use structured output for tool calls; the planner emits JSON steps, not prose. |
| Vision model (selective fallback) | HTTP API, bounding-box | Only invoked when AXTree is insufficient — keep it off the hot path. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| planner ↔ compiler | Synchronous calls (load model, ground step) | Planner never touches DOM/refs directly — it only sees semantic steps. |
| compiler ↔ execution | One-way: grounded concrete actions | Guard sits *between* these two as the choke point. |
| execution ↔ perception | Execution triggers fresh snapshots after each action | Snapshot versioning lives here. |
| compiler ↔ memory | Read/write of site models, skills, locators | Memory is the compiler's persistence substrate. |
| guard ↔ human/voice | Confirmation prompts | The only place the human is looped in for risky actions. |

---

## Sources

- arXiv:2511.19477 — *Building Browser Agents: Architecture, Security, and Practical Solutions*
  (Vardanyan, FillApp; Nov 2025). Primary source for execution layer, element-ref versioning, bulk
  actions, hybrid perception, and code-enforced safety. HIGH confidence.
  https://arxiv.org/abs/2511.19477
- Skyvern — *How Skyvern Reads and Understands the Web* (2025, updated 2026). Planner-Actor-Validator
  multi-agent architecture; LLM + computer vision; semantic reasoning. HIGH confidence.
  https://www.skyvern.com/blog/how-skyvern-reads-and-understands-the-web/
- Skyvern GitHub — task-driven autonomous agent design (BabyAGI/AutoGPT-inspired) + Playwright. HIGH.
  https://github.com/Skyvern-AI/skyvern
- dev.to *Runtime Snapshots #16 — The Three Architectures of Browser Agents*. Vision vs AXTree vs
  hybrid; AXTree convergence of browser MCP projects. HIGH confidence.
  https://dev.to/alexey_sokolov_10deecd763/runtime-snapshots-16-the-three-architectures-of-browser-agents-4gkc
- Webfuse — *Browser-Use vs Playwright*. Browser-Use's element-extraction layer (structured list of
  interactive elements annotated with accessibility info + unique ID). HIGH confidence.
  https://www.webfuse.com/blog/browser-use-vs-playwright-which-is-better-for-ai-agent-control
- OpenAI Codex *Record & Replay* + community analyses. Demonstration captured via accessibility API
  + input events (not coordinates); compiled to a reusable "skill." MEDIUM-HIGH confidence (vendor
  docs + multiple independent write-ups).
  https://developers.openai.com/codex/record-and-replay · https://azukiazusa.dev/en/blog/workflow-to-reusable-skill
- Anthropic *Computer use tool* docs — browser-use vs desktop computer-use tooling boundary. HIGH.
  https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool

---

*Architecture research for: Juno — semantic website compiler*
*Researched: 2026-08-21*
