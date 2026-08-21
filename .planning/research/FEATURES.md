# Feature Research

**Domain:** AI browser-automation / computer-use agents ("semantic website compiler")
**Researched:** 2026-08-21
**Confidence:** MEDIUM (competitive-intelligence survey of fast-moving products; cross-checked via multiple secondary sources, not vendor primary docs)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Browser control (load, navigate, click, type, scroll, upload/download) | The entire premise; every competitor (OpenAI Operator/ChatGPT Agent, Anthropic Computer Use, Browser Use, Skyvern, Browserbase) does this | MEDIUM | Well-understood mechanics, but **reliability across arbitrary sites is the real cost**. Playwright/Chrome DevTools Protocol is the standard substrate. |
| Multi-step workflow execution (task → many steps → done) | Users expect "apply to this job" to mean ~30 steps, not one click | HIGH | This is where agents break. OpenAI CUA scores ~87% on WebVoyager; the gap is edge cases and long-horizon tasks. |
| Form filling / data entry | Core automation job; Skyvern, Browser Use, Operator all do it | MEDIUM | Parameterized fill + submit. Nuance: dynamic fields, validation, dropdowns, file upload. |
| Data extraction to structured output | "Extract data you otherwise can't get" is a top use case | MEDIUM/HIGH | Skyvern has `data_extraction_schema`; AgentQL offers semantic queries; Browser Use has extraction. JSON-schema-constrained extraction is expected. |
| Login / session handling (credentials, cookies, 2FA) | Most real workflows are behind auth | HIGH | Skyvern has a `login` block + managed credential store ("credentials never sent to the LLM"). Operator pauses and hands control back to the user for logins (takeover mode). |
| Human-in-the-loop confirmation for sensitive/destructive actions | Users will not trust an agent that can send a message or submit a form unprompted | MEDIUM | Operator's "takeover mode"; Hermes Agent has `approvals` (smart/manual/off) + dangerous-command gating; Lapu AI does per-action confirmation with preview. Table stakes for any non-toy agent. |
| Observability / replay (session recording, step logs) | Users must see *what* the agent did and *why* it failed | MEDIUM | Skyvern added video recording late 2025; Browserbase offers session replay. Expected for debugging and trust. |
| Element resilience (locate elements without fragile selectors) | Sites change layout constantly; CSS/XPath selectors break | HIGH | AgentQL sells semantic querying over selectors; Skyvern uses computer vision; Stagehand (Browserbase) uses AI element localization. The *failure mode* of fragile selectors is a known pain point across the space. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable. **These are where Juno competes and must align with the Core Value (semantic compiler + teach-by-showing + persistent memory + voice).**

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Semantic site "compilation"** (build a durable model of a site's structure/behavior, not one-off driving) | Turns a website into a reusable automatable surface; the "compiler" mental model is Juno's founding idea | HIGH | No competitor does this literally. Operator has "site-specific preferences"; Skyvern has reusable workflow *blocks*; but none persist a full semantic model of a site's pages, navigation, and elements. |
| **Teach-by-showing / demonstration-based learning** | User demonstrates an action once; Juno learns, persists, replays — replaces destructive AI guessing with safe human teaching | HIGH | Skyvern is closest: "Record Browser — show once, run forever" + Screen Recorder, with an Action Recorder on its roadmap. But for Juno the demonstration is *also the safety mechanism* (teach, don't guess) — a stronger framing. |
| **Persistent per-site memory** (learned knowledge survives sessions, reloads per site) | Turns one-off automation into a compounding, reusable asset; "edge cases are learned" (Kore.ai); long-term memory is "the hard problem" (Dataiku) | HIGH | Most agents are stateless per-task or keep only ephemeral context. Operator keeps site preferences; Skyvern keeps workflow definitions. None keep a durable *semantic model* that generalizes across sessions. |
| **Voice-first control** (same capability driven by speaking) | Accessibility + hands-free + aligns with the user's "when you do it in voice, it's that idea" framing | LOW/MEDIUM | Largely absent from major products — mostly DIY tutorials (Browser Use + VAPI, etc.). Genuine white space. Cheap relative to value: STT → intent → reuse the same saved-skill execution pipeline. |
| **Cross-site skill generalization** (recognize shared portals — many job applications use the same portal — and reuse learned knowledge) | One learned skill generalizes to dozens of sites; massive leverage | HIGH | Depends on the compiler model + memory. Skyvern's parameterized blocks hint at reuse, but no competitor generalizes a *learned* skill across *different sites* sharing a portal. |
| **Safe exploration / non-destructive testing** (probe a site without performing irreversible actions) | Websites "often cannot be freely tested"; a wrong test sends the wrong message | HIGH | Competitors do approval gates, not "explore without acting." Juno's value: classify actions by destructive potential and explore/simulate safely, only acting on demonstration or explicit confirmation. This is the safety core, not polish. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems. Explicitly NOT building these protects the Core Value.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Fully autonomous "just do it" (Operator-style: no confirmation, agent completes tasks unprompted) | Feels magical; "don't make me babysit it" | On real sites a wrong action is destructive (wrong message sent, form submitted, contract signed). Breaks Juno's central safety constraint. | Demonstration-or-confirmation model: act only after an explicit demonstration or explicit per-action confirmation. |
| Raw CSS/XPath selector automation as the primary mechanism | Cheap, familiar, deterministic | Brittle — "one tiny UI change and it breaks" is the dominant complaint in the space | Semantic + vision-based element resolution (AgentQL-style queries / computer vision), with selectors as a fallback hint only. |
| Unbounded auto-extraction of web content into persistent memory | "Learn everything automatically" | Injection risk: a malicious page can plant instructions that get auto-extracted and later executed or pollute memory (flagged in community threads) | Treat all fetched/observed web content as **untrusted data**; keep an explicit boundary between observed content and executable instructions; sanitize before persisting. |
| Full desktop/OS computer-use (Anthropic Computer Use style: any app, terminal, file system) in MVP | Maximizes reach ("the entire computing environment") | Massive surface area, OS variability, and safety scope explosion; stalls the browser-scoped core | Browser-scoped first; consider desktop control only after the browser compiler + safety model are proven. |
| General-purpose no-code RPA / enterprise workflow builder | Broad market appeal | Off-mission; competes head-on with Skyvern/Zapier/RPA incumbents; dilutes the compiler + teach-by-showing thesis | Stay focused on semantic compilation + teach-by-showing + per-site memory for hard-to-automate actions. |

## Feature Dependencies

```
Semantic site model (compile)
    ├──requires──> Browser control (load/navigate/read DOM + vision)
    └──requires──> Element resilience (semantic/vision element resolution)

Teach-by-showing (demonstration learning)
    ├──requires──> Semantic site model
    ├──requires──> Action recording (capture the demonstration)
    └──requires──> Persistent per-site memory (store the learned skill)

Persistent per-site memory
    ├──requires──> Semantic site model (what is being remembered)
    └──requires──> Serialization + storage layer (survives sessions)

Execute saved automation (replay)
    ├──requires──> Teach-by-showing (have a skill to replay)
    ├──requires──> Persistent per-site memory (load the skill)
    └──requires──> Approval/confirmation gate (don't replay destructively)

Safe exploration
    ├──requires──> Destructive-action classification
    └──requires──> Approval/confirmation gate + session sandbox

Cross-site skill generalization
    ├──requires──> Persistent per-site memory
    └──requires──> Shared-portal detection (fingerprint/pattern matching)

Voice control ──enhances──> everything (input modality over the same pipeline)
    └──requires──> Intent parsing (STT + NLU) ──maps to──> saved skills / actions
```

### Dependency Notes

- **Semantic site model requires browser control + element resilience:** you can't compile a site you can't reliably read; fragile selectors would poison the model. Build element resolution first.
- **Teach-by-showing requires the semantic model + memory:** a demonstration is only learnable if you can (a) interpret what was clicked in semantic terms and (b) store it durably. This is why teach-by-showing is a *phase 2+* capability, not MVP day one.
- **Execute saved automation requires approval gating:** replay is where destructive risk concentrates — a saved skill must not run destructive steps without confirmation. Approval is a prerequisite, not an add-on.
- **Safe exploration requires destructive-action classification:** you cannot "explore without acting" unless you can reliably distinguish safe (read/navigate/hover) from unsafe (submit/send/sign/purchase) actions.
- **Voice control enhances everything but depends on intent parsing:** voice is a thin input layer over the existing skill-execution pipeline — low incremental complexity once the pipeline exists, which is why it's deferred but cheap.
- **Persistent memory conflicts with unbounded auto-extraction:** see Anti-Features — memory must be gated by the untrusted-input boundary.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] **Browser control + site loading** — load any site, navigate, read DOM + visual state. *Foundation everything else stands on.*
- [ ] **Semantic model building** — compile pages, navigation, and elements into a structured model. *The core "compiler" claim.*
- [ ] **Destructive-action classification + approval/confirmation gate** — the safety floor; without it nothing destructive may run. *The non-negotiable constraint.*
- [ ] **Safe exploration** — probe a site read-only, without destructive/irreversible actions. *Validates "safe by default."*
- [ ] **Teach-by-showing (record one demonstration)** — user demonstrates an action; Juno captures and interprets it. *Validates the learning mechanism.*
- [ ] **Persistent per-site memory (save + reload)** — learned knowledge survives sessions and reloads per site. *Validates the persistence thesis.*
- [ ] **Execute a saved automation end-to-end** — replay a learned skill (message, form, sign) with confirmation. *Validates the automation value.*

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] **Voice control** — *trigger when the teach/replay pipeline is stable; voice is a thin layer over it.*
- [ ] **Cross-site portal generalization** — *trigger when multiple sites sharing a portal are observed; requires portal fingerprinting.*
- [ ] **Structured data extraction (schema-constrained)** — *trigger when "extract data" becomes a common ask beyond replay.*
- [ ] **Session replay/observability (video + step logs)** — *trigger when debugging failures becomes a bottleneck.*

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **General desktop/OS control** — *defer: scope explosion, off the browser-compiler thesis.*
- [ ] **Multi-agent orchestration / parallel workflows** — *defer: needs the single-agent loop hardened first.*
- [ ] **Credential vault / managed secrets with 2FA handling** — *defer partially: login is table stakes, but a full managed vault with 2FA automation is a later hardening, not MVP.*

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Browser control + site loading | HIGH | MEDIUM | P1 |
| Semantic model building | HIGH | HIGH | P1 |
| Destructive-action classification + approval gate | HIGH | MEDIUM | P1 |
| Safe exploration | HIGH | HIGH | P1 |
| Teach-by-showing | HIGH | HIGH | P1 |
| Persistent per-site memory | HIGH | MEDIUM | P1 |
| Execute saved automation (replay) | HIGH | HIGH | P1 |
| Multi-step workflow execution | HIGH | HIGH | P1 |
| Form filling / data entry | MEDIUM | MEDIUM | P2 |
| Data extraction (schema) | MEDIUM | MEDIUM | P2 |
| Login / session handling | HIGH | HIGH | P2 |
| Observability / replay | MEDIUM | MEDIUM | P2 |
| Voice control | MEDIUM | LOW | P2 |
| Cross-site portal generalization | HIGH | HIGH | P2 |
| Element resilience (semantic/vision) | HIGH | HIGH | P1 (underpins model) |
| General desktop control | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | OpenAI Operator / ChatGPT Agent | Anthropic Computer Use | Skyvern | Browser Use | Browserbase / Stagehand | Juno (our approach) |
|---------|-------------------------------|------------------------|---------|-------------|--------------------------|---------------------|
| Browser control | Own managed virtual browser | Desktop via screenshots + input | Playwright extension | Playwright SDK | Hosted browser infra | Own browser harness (browser-scoped) |
| Element resolution | Screenshot/vision + HTML | Vision (screenshots) | Computer vision | HTML + vision | AI element localization (Stagehand) | Semantic model (compiled), vision + semantic fallback |
| Workflow building | Natural-language task | API-driven | LLM prompt, blocks, or **Record Browser** | Python code + NL | Code (Stagehand) | **Teach-by-showing + compiler** |
| Safety / approvals | Takeover mode for logins/sensitive | Self-managed sandbox (Docker) | Confirmation on destructive steps | Developer-controlled | Developer-controlled | **Destructive-action classification + approval gate + safe exploration** |
| Persistent memory | Site-specific preferences / saved prompts | None (stateless per call) | Saved workflow definitions | None (stateless) | None (infra) | **Durable per-site semantic model (core thesis)** |
| Cross-site reuse | No | No | Parameterized blocks (partial) | No | No | **Shared-portal generalization (differentiator)** |
| Voice control | No | No | No | No | No | **Voice-first (differentiator)** |

## Sources

- [OpenAI — Introducing Operator](https://openai.com/index/introducing-operator/) (primary, vendor)
- [WorkOS — Anthropic Computer Use vs OpenAI CUA](https://workos.com/blog/anthropics-computer-use-versus-openais-computer-using-agent-cua) (secondary, 2025-07-30)
- [Helicone — Browser Use vs Computer Use vs Operator](https://www.helicone.ai/blog/browser-use-vs-computer-use-vs-operator) (secondary, 2025-03-11)
- [Respan — Anthropic Computer Use vs OpenAI Operator](https://www.respan.ai/market-map/compare/anthropic-computer-use-vs-openai-operator) (secondary, 2026)
- [Sistava — Best AI Browser Automation Tools](https://sistava.com/en/insights/best-ai-browser-automation-tools) (secondary, 2026)
- [Skyvern — homepage / Record Browser](https://www.skyvern.com/) (primary, vendor)
- [Skyvern — "Show don't tell" screen recorder blog](https://www.skyvern.com/blog/launch-week-day-3-show-dont-tell-screen-record-your-workflows-with-skyvern/) (primary, vendor)
- [Skyvern GitHub — workflow blocks, credentials, login block](https://github.com/skyvern-ai/skyvern) (primary, vendor)
- [Skyvern — File download automation / Axiom recorder](https://www.skyvern.com/blog/file-download-automation-cloud-storage/) (primary, vendor)
- [Hermes Agent — Security / approval modes](https://hermes-agent.nousresearch.com/docs/user-guide/security) (primary, vendor)
- [NVIDIA — Sandboxing agentic workflows / execution risk](https://developer.nvidia.com/blog/practical-security-guidance-for-sandboxing-agentic-workflows-and-managing-execution-risk/) (primary, vendor)
- [Lapu AI — AI agent security / permission tiers](https://lapu.ai/ai-agent-security) (secondary)
- [Dataiku — Agent memory: the missing layer](https://www.dataiku.com/blog/agent-memory) (secondary)
- [Kore.ai — What is AI agent memory](https://www.kore.ai/blog/what-is-ai-agent-memory) (secondary)
- [Hume AI — Controlling your computer with voice](https://www.hume.ai/blog/controlling-your-computer-with-voice) (secondary)

**Confidence note:** Competitive landscape sources are secondary/tertiary and the market is moving fast (Operator was folded into "ChatGPT Agent"; Skyvern shipped a screen recorder). Treat feature presence/absence as **MEDIUM** confidence; verify against each vendor's current docs before making build decisions. Voice-control absence across majors is a *negative claim* inferred from the absence of evidence across multiple sources — flag for direct validation.

---
*Feature research for: Juno — semantic website compiler (AI browser-automation agent)*
*Researched: 2026-08-21*
