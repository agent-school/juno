# Project Research Summary

**Project:** Juno
**Domain:** AI browser-automation / computer-use agent ("semantic website compiler")
**Researched:** 2026-08-21
**Confidence:** HIGH (stack, architecture, pitfalls) / MEDIUM (features — fast-moving competitive landscape)

## Executive Summary

Juno is a **semantic website compiler**: a tool that takes any website, builds a durable, typed semantic model of its structure and behavior, and saves that understanding per site so hard-to-automate actions (message on Instagram, sign a contract, send email when no API is exposed, apply to jobs) can be automated reliably *without destructive guessing*. Experts in this space converged on one dominant lesson: **architectural decisions — not model capability — determine success or failure** (arXiv:2511.19477, a year-long production study). The industry has also settled the perception debate in favor of the **accessibility tree as the primary sensing surface**, with vision as a scoped fallback, and settled the safety debate in favor of **code-enforced guards, not LLM judgment**.

The recommended approach is a **TypeScript (Node 22 LTS) application on Playwright 1.62.1**, using `Locator.ariaSnapshotJSON` (accessibility-tree JSON) as the raw material for the semantic compiler, the **Vercel AI SDK + Zod** as a thin model-agnostic LLM layer with structured outputs, and **SQLite (`better-sqlite3` + `sqlite-vec`) as one embedded per-site memory file**. Critically, Juno must **not** adopt an autonomous agent framework (browser-use, Skyvern, LangGraph): its differentiator is *teach-by-showing* (deterministic replay) plus *human-in-the-loop safety*, which is a simple, auditable state machine — not an LLM-loop graph.

The key risk is **safety, and it is existential**: a browser agent that can click/type/submit can cause real, irreversible damage (wrong message sent, form submitted, contract signed). This is mitigated by three hard architectural rules, all code-enforced: (1) a **destructive-action classifier** that confines autonomous exploration to read-only/benign-write actions and gates destructive actions behind explicit demonstration or confirmation; (2) an **untrusted-input boundary** that treats all page content as data (never instructions) to defeat indirect prompt injection; and (3) a **two-store split** separating shareable semantic knowledge from secret session state. These are founding constraints, not polish — they must be built in from the first destructive-capable build, never retrofitted.

## Key Findings

### Recommended Stack

See [STACK.md](./STACK.md) for full detail. The stack is deliberately small and battle-tested; the novelty is in the semantic compiler, not in exotic infrastructure.

**Core technologies:**
- **TypeScript + Node.js 22 LTS** — single language across automation, semantic model, agent, and persistence; the typed site model (`SiteModel`, `Page`, `Element`, `Action`, `Portal`) becomes a first-class artifact, not ad-hoc JSON.
- **Playwright 1.62.1** — the de-facto agent standard. `Locator.ariaSnapshotJSON({ mode: "ai", boxes: true })` returns role/name/text/state/ref/box structured JSON (the compiler's raw material, no vision needed); `getByRole` gives semantic, layout-stable locators for reliable replay; cross-browser and more anti-bot-resilient than Selenium/Puppeteer.
- **Vercel AI SDK (`ai` 7.0.x + `@ai-sdk/anthropic`/`@ai-sdk/openai`)** — model-agnostic provider layer with `generateObject()` emitting **Zod-validated structured output** — the right primitive for "compile snapshot → typed model" and "match demonstrated action → element ref". Lighter than LangChain.
- **better-sqlite3 13.0.x + sqlite-vec 0.1.9** — one embedded per-site `.db` file. Juno's memory is mostly *structured* (pages, refs, sequences, portal fingerprints) → B-tree + FTS5 territory; vectors only if similarity matching (portal recognition) is added later.

**Explicitly NOT used:** browser-use / Skyvern / LangGraph / LangChain (autonomous-guessing frameworks), Puppeteer/Selenium (no AXTree snapshot), LanceDB/Chroma/pgvector (server for vector search Juno barely needs), stealth patches by default (`launchPersistentContext` with the user's real profile is the correct posture for the user's own accounts).

### Expected Features

See [FEATURES.md](./FEATURES.md) for the full competitive matrix.

**Must have (table stakes — P1):** browser control + site loading; multi-step workflow execution; element resilience (semantic/vision element resolution); form filling/data entry; login/session handling; human-in-the-loop confirmation for destructive actions; observability/replay.

**Should have (differentiators — Juno's core value):** semantic site compilation (durable model, not one-off driving); teach-by-showing (demonstration → persisted reusable skill); persistent per-site memory; safe exploration / non-destructive testing; cross-site portal generalization; voice-first control.

**Defer (v2+):** general desktop/OS computer-use; multi-agent orchestration; full managed credential vault with 2FA automation; unbounded auto-extraction; raw-selector automation; fully-autonomous "just do it" mode.

### Architecture Approach

See [ARCHITECTURE.md](./ARCHITECTURE.md). Browser agents converged on a layered architecture with the accessibility tree as primary perception and code-enforced safety as the central boundary. Juno's three differentiators — compiler, teach-by-showing, persistent per-site memory — do not exist as a combined system today (Skyvern = one-off multi-agent, not compiled/persistent; OpenAI Codex Record & Replay = prompt-artifact "skills", not a queryable site model). Juno's *novel* components are the **Site Compiler**, the **demonstration→skill compiler**, and the **per-site memory store**; everything beneath them is well-trodden.

**Major components (top → bottom):**
1. **Intent layer** — voice (ASR→NLU) + typed commands converge on one `Intent` type; voice is a modality, not a subsystem.
2. **Planner / agent loop** — decomposes intent into *semantic* steps (not DOM actions); loads site model + skills.
3. **Semantic compiler** *(novel core)* — builds/durable site model; compiles demonstrations into parameterized skills; grounds semantic steps → concrete versioned refs per site.
4. **Safe-execution guard** *(code-enforced choke point)* — destructive-action classifier, confirmation gates, domain allowlist, audit log. Nothing that mutates page state bypasses it.
5. **Execution layer** — Playwright/CDP; versioned element-reference system; bulk actions.
6. **Perception layer** — AXTree snapshot (primary) + selective screenshot/vision (fallback).
7. **Per-site persistent memory** — site models, skills, locators, outcomes, portal fingerprints; keyed by site identity.

**Key patterns:** hybrid perception (AXTree primary, vision fallback); versioned element refs (mismatch fails safe, never clicks the wrong element); semantic Action IR + grounding (the compiler core — separates portable `send_message(recipient, body)` from site-grounded `click(ref=42)`); demonstration→skill recording via *semantic* events (never pixel coordinates); code-enforced safety (never "let the LLM judge safety").

### Critical Pitfalls

See [PITFALLS.md](./PITFALLS.md) for all 8 with warning signs and recovery. Top 5:

1. **Autonomous exploration performs real destructive actions** — build the action taxonomy (`read` / `write-benign` / `write-destructive`) *before* any exploration ships; confine exploration to read + benign-write; gate destructive behind demonstration/confirmation; add post-action verification + a kill switch.
2. **Hallucinated coordinates / ungrounded targeting** — ground every action in DOM + accessibility tree via `getByRole`/scoped refs, never raw `(x,y)`; vision only as fallback.
3. **Knowledge rots (stored as selectors/coordinates)** — persist *semantic descriptions* (role/label/placeholder/text/context), not locators; re-identify against the live AXTree at replay; store locators only as cached hints.
4. **Secrets stored inside learned knowledge** — separate two stores: semantic knowledge (non-secret, shareable) vs session state (encrypted at rest, never committed). `storageState` also misses sessionStorage/IndexedDB → build a liveness check + human re-auth flow.
5. **Indirect prompt injection hijacks the agent** — treat all page content as untrusted data (never instructions); least-privilege tool scoping; confirm any secret/payment/outbound action. See the GSD [untrusted-input boundary](./../../opencode/gsd-core/references/untrusted-input-boundary.md) reference for the data-fencing discipline.

Also critical: **anti-bot treated as a stealth war** (use the user's real persistent profile + human-handoff for challenges, not evasion tooling) and **skills over-fitting to one site instance** (key by portal fingerprint + semantic structure, not literal URLs).

## Implications for Roadmap

The architecture's dependency-driven build order maps cleanly onto phases. Dependencies flow bottom-up, and the safe-execution guard is **not deferrable** — it must be co-developed with the executor from the first destructive-capable build.

### Phase 1: Browser Core (execution + perception)
**Rationale:** Nothing else exists without a way to act on and read the browser. This is the foundation every higher layer sits on, and it's well-trodden ground.
**Delivers:** Playwright harness; `ariaSnapshotJSON` AXTree capture; versioned element-reference system; semantic locators; persistent user profile (no stealth).
**Addresses:** browser control + site loading; element resilience (underpins the whole model).
**Avoids:** Pitfall 2 (hallucinated coordinates — by grounding in refs, not pixels); Pitfall 6 (anti-bot — by persistent-profile + human-handoff posture).

### Phase 2: Safe-Execution Guard + Safety Model
**Rationale:** Co-develop with Phase 1, **do not defer**. As soon as the executor can `click`/`type`, it can destroy. Retrofitting code-level safety is far harder than building it in.
**Delivers:** destructive-action classifier (`read`/`write-benign`/`write-destructive`); confirmation gates; domain/action allowlist; audit log; kill switch; data-fencing (untrusted-input boundary between page content and the planner).
**Addresses:** destructive-action classification + approval gate (P1 safety floor); safe exploration.
**Avoids:** Pitfall 1 (destructive autonomous actions); Pitfall 7 (prompt injection).

### Phase 3: Per-site Memory + Site Compiler (explorer + site-model)
**Rationale:** The "durable semantic model" requires persistence + safe exploration. Memory is the substrate the rest of the compiler reads/writes, and the two-store split must be defined *before* persisting anything real.
**Delivers:** SQLite store (better-sqlite3); site-model schema (`SiteModel`/`Page`/`Element`/`Action`/`Portal` in Zod); safe exploration confined to read + benign-write; the **two-store split** (semantic knowledge vs encrypted session state); schema migration story.
**Addresses:** semantic model building; persistent per-site memory (save + reload); safe exploration.
**Avoids:** Pitfall 3 (knowledge rot — by defining the semantic schema up front); Pitfall 4 (secrets in knowledge — by the two-store split); Pitfall 5 (auth state — by full storageState capture + liveness check).

### Phase 4: Semantic IR + Planner + Replay (first end-to-end milestone)
**Rationale:** The IR needs a site model to ground against; the planner needs the IR to express plans. This is the first "compile a site, execute an action" working system.
**Delivers:** semantic Action IR + grounding; planner loop (intent → semantic steps → grounded actions); execute a saved automation end-to-end with confirmation.
**Addresses:** multi-step workflow execution; execute saved automation (replay).
**Avoids:** Pitfall 1 (replay is where destructive risk concentrates — approval is a prerequisite, not an add-on).

### Phase 5: Teach-by-Showing (demonstration → skill compiler)
**Rationale:** Arrives *after* the IR exists — a recorded demonstration needs something to compile *into*. Do not put this before Phase 4.
**Delivers:** semantic event-stream recorder (AX + input, not pixels); generalization from one demonstration to a parameterized skill with secret redaction.
**Addresses:** teach-by-showing (record one demonstration) — the differentiator and the safety mechanism.
**Avoids:** Pitfall 2/3 (record semantics, not coordinates/selectors).

### Phase 6: Portal Recognition + Cross-site Generalization
**Rationale:** Needs fingerprints (from the site model) + skills (from the demonstration compiler) to match and reuse. Design the schema for it early even though it ships late (Pitfall 8).
**Delivers:** portal fingerprinting; "portal fingerprint → shared skill" registry; structural-similarity matching (optionally sqlite-vec embeddings).
**Addresses:** cross-site portal generalization (apply-to-jobs reuse).
**Avoids:** Pitfall 8 (non-generalizing skills — key by semantic structure + portal fingerprint, not literal URLs).

### Phase 7: Voice Control
**Rationale:** Pure modality addition wrapping the existing intent path; intentionally last because it depends on everything semantic being stable. Thin and cheap once the pipeline exists.
**Delivers:** ASR → NLU → `Intent`; spoken confirmation for risky verbs.
**Addresses:** voice-first control (differentiator).
**Avoids:** the voice-channel-bypass pitfall — voice-driven destructive actions hit the *same* confirmation guardrail as typed/GUI.

### Phase Ordering Rationale

- **Bottom-up by dependency:** browser/perception → safety → memory/model → IR/planner → teach → portal → voice. Each phase consumes the one before it; the novel compiler sits on top of the standard foundation.
- **Safety is co-developed, not deferred:** Phases 1–2 establish a *safe* browser primitive; the guard is the single choke point that everything destructive must pass through.
- **Pitfall coverage is front-loaded:** the founding safety constraint (Pitfall 1), the grounding foundation (Pitfall 2), and the schema decisions that prevent knowledge rot (Pitfall 3) are all resolved by Phase 4.
- **Differentiators land mid-sequence:** teach-by-showing (Phase 5) and cross-site reuse (Phase 6) are the "compounding value" features; they arrive after the system is demonstrably useful end-to-end.

### Research Flags

Phases likely needing deeper research during planning (`/gsd-plan-phase --research-phase <N>`):
- **Phase 2 (Safety Guard):** the destructive-action taxonomy and the untrusted-input data-fencing design are nuanced; prompt-injection defense is an active research area. Worth a focused planning pass even though PITFALLS.md is HIGH confidence.
- **Phase 5 (Teach-by-Showing):** the hard sub-problem — generalizing a *single* demonstration into a parameterized skill — was MEDIUM confidence in research. Needs a spike.
- **Phase 6 (Portal Recognition):** niche, sparse documentation; portal-fingerprinting approach needs empirical validation against real job-portal platforms (Greenhouse, Lever, Workday).
- **Cross-cutting — Instagram feasibility:** STACK.md explicitly flags Instagram's anti-bot behavior as needing a **dedicated feasibility spike** before that automation ships (messaging-on-Instagram is a motivating use case but also the highest anti-bot risk).

Phases with standard patterns (skip research-phase):
- **Phase 1 (Browser Core):** Playwright accessibility-tree + locator semantics are extremely well documented (Context7 official docs + community).
- **Phase 3 (Memory):** SQLite + Zod schemas + migration are established, ordinary patterns.
- **Phase 7 (Voice):** STT/NLU is a mature, pluggable integration (keep behind the `intents/asr` seam to avoid vendor lock-in).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Cross-verified Context7 official docs + npm registry (authoritative versions) + 5 independent sources. |
| Features | MEDIUM | Competitive-intelligence survey of fast-moving products via secondary sources; Operator was folded into "ChatGPT Agent", Skyvern shipped a screen recorder — presence/absence may drift. Voice-control absence is a *negative claim* inferred from absence of evidence. |
| Architecture | HIGH (canonical) / MEDIUM (novel) | Layered agent architecture is well-established (arXiv:2511.19477 primary source); Juno's compiler + teach-by-showing synthesis has no direct precedent and is inferred. |
| Pitfalls | HIGH | Sourced from primary security reports (hCaptcha, Unit 42, OWASP, Anthropic) and Playwright official auth docs. |

**Overall confidence:** HIGH (with a MEDIUM caveat on the two novel components and the competitive-feature claims).

### Gaps to Address

- **Teach-by-showing generalization** (single example → parameterized skill): the research identified it as "the hard part" but offered no settled algorithm. → Resolve with a Phase 5 spike before planning its full scope.
- **Instagram anti-bot feasibility:** not resolved; flagged for a dedicated spike. → Do not commit to Instagram messaging as a Phase 1 acceptance criterion; treat it as a validated-later target.
- **Portal fingerprinting technique:** no canonical approach surfaced. → Validate empirically against 2–3 real job-portal platforms in Phase 6 planning.
- **Voice-control absence across majors** is a negative claim (inferred, not verified). → Validate directly against current vendor docs before treating "voice is white space" as a differentiator.
- **Session-persistence edge cases** (sessionStorage/IndexedDB capture, token-location verification): well-documented in Playwright guides but implementation-specific. → Add a liveness-check acceptance criterion to Phase 3.

## Sources

### Primary (HIGH confidence)
- **Context7 `/microsoft/playwright`** — `Locator.ariaSnapshotJSON` (mode "ai", boxes, node schema), `getByRole`, `toMatchAriaSnapshot`, auth/reuse-state.
- **npm registry** (`npm view`) — authoritative versions: playwright 1.62.1, better-sqlite3 13.0.3, sqlite-vec 0.1.9, zod 4.4.3, ai 7.0.73, @ai-sdk/anthropic 4.0.40.
- **arXiv:2511.19477** — *Building Browser Agents: Architecture, Security, and Practical Solutions* (execution layer, element-ref versioning, bulk actions, hybrid perception, code-enforced safety).
- **hCaptcha "Browser Agent Safety is an Afterthought"** + **Unit 42 (March 2026) in-the-wild prompt-injection report** + **OWASP LLM01:2025** — safety/pitfalls.
- **Playwright auth docs** + **currents.dev Playwright auth guide** — storageState/sessionStorage/IndexedDB gotchas.

### Secondary (MEDIUM confidence)
- Context7 `/browserbase/stagehand`; dev.to "Browser Tools for AI Agents" + "Three Architectures of Browser Agents"; skyvern.com; webfuse.com (Browser-Use vs Playwright); OpenAI/Anthropic/Skyvern/Hermes/Lapu vendor docs for feature presence; Brave "Prompt Injection in Perplexity Comet".

### Tertiary (LOW confidence — needs validation)
- Voice-control absence across majors (negative claim); anti-detect-browser tooling comparisons (Camoufox/Patchright); stagehand storage-state breakage issue #1250.

---
*Research completed: 2026-08-21*
*Ready for roadmap: yes*
