# Roadmap: Juno

## Overview

Juno is built bottom-up along its dependency chain: first a browser primitive that can load, read (via the accessibility tree), and act on any website with semantic references; then a code-enforced safe-execution guard so the primitive can never destroy anything silently; then the novel core — a semantic site compiler writing durable knowledge into per-site persistent memory. On top of that substrate come the user-facing capabilities in dependency order: intent-driven multi-step execution (including authenticated sites and self-healing replay), teach-by-showing (demonstration → parameterized skill), cross-site portal recognition (one learned skill generalizes across sites sharing a portal), and finally voice as a pure input modality over the same pipeline. Safety is co-developed with execution, never deferred — every phase after Phase 2 inherits its guards.

The roadmap implements the [DOCTRINE.md](./DOCTRINE.md) architecture (`website → semantic graph → planner → deterministic executor → verifier`): Phase 3 compiles sites into versioned typed operation graphs (compile once), Phase 4 executes them through a verified, locally-recovering runtime (execute many, recompile on divergence), and Phase 5 turns demonstrations into compositions of typed operations rather than opaque trajectories.

**Milestone:** v1 (MVP)

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Browser Core** - Load any site, read its accessibility tree, act via semantic refs under a real-user profile (completed 2026-08-24)
- [ ] **Phase 1.1: Containerized Host-Browser Runtime & Windows Compatibility (INSERTED)** - Runtime and launcher implemented; Linux/CDP/container evidence passes. Actual Windows Desktop smoke matrix remains open.
- [x] **Phase 2: Safe-Execution Guard** - Guarded production execution verified: classification, confirmation, audit, read-only mode, injection boundary and abort. See Phase 2 verification.
- [ ] **Phase 3: Site Compiler & Per-Site Memory** - Compile explored sites into durable, versioned typed semantic models (entities + operation contracts) that persist across sessions
- [ ] **Phase 4: Planner, Execution & Authenticated Sites** - Intent → end-to-end multi-step workflows on any site with consequence verification, execution receipts, idempotent retries, and local self-healing recovery
- [ ] **Phase 5: Teach-by-Showing** - Demonstrate an action once; Juno learns a parameterized, secret-free skill composed of typed operations
- [ ] **Phase 6: Portal Recognition** - Recognize shared portals across sites and reuse learned skills without re-teaching
- [ ] **Phase 7: Voice Control** - Drive the full pipeline by voice, with the same confirmation guardrails

## Phase Details

### Phase 1: Browser Core

**Goal**: Juno can load, read, and act on any website through a semantic accessibility-tree view — the foundation every higher layer sits on
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: BRWS-01, BRWS-02, BRWS-03, BRWS-04
**Success Criteria** (what must be TRUE):

  1. User gives Juno a URL and the site loads and navigates in a real browser session
  2. Juno can describe a loaded page's semantic structure (roles, labels, text, element states) derived from the accessibility tree
  3. Juno can click, type, scroll, and select elements by semantic reference — and when the page changes, the reference fails safe (errors out) rather than acting on the wrong element
  4. The browser runs under the user's persistent real-user profile with no stealth-evasion tooling

**Plans:** 3/3 plans complete

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Walking Skeleton: monorepo scaffold + persistent-session load/read/act tracer + profile lifecycle & no-stealth gate (BRWS-01, BRWS-04)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Perception pipeline: ariaSnapshot YAML → zod-typed PageTree via SemanticPageReader (BRWS-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Acting surface: two-layer refs + SemanticActor with fail-safe grounding under page mutation (BRWS-03)

### Phase 01.1: Containerized host-browser runtime and Windows compatibility: run Juno in Docker while attaching to an explicitly launched dedicated Windows Chrome over CDP, with reliable readiness checks, networking, profile safety, fixture lifecycle, and tested PowerShell setup (INSERTED)

**Goal:** Juno runs in Docker and attaches to an explicitly launched, dedicated Windows Chrome over CDP with reliable readiness, safe networking, profile/process ownership, fixture lifecycle, and tested PowerShell setup
**Requirements**: RUNTIME-01, RUNTIME-02, RUNTIME-03, RUNTIME-04, RUNTIME-05, RUNTIME-06
**Depends on:** Phase 1
**Plans:** 3 plans

Plans:

- [ ] 01.1-01-PLAN.md — CDP readiness, websocket normalization, attach-only session, and semantic tracer
- [ ] 01.1-02-PLAN.md — Docker bridge harness, container-owned fixture, and no-reuse CDP test configuration
- [ ] 01.1-03-PLAN.md — Windows Chrome launcher, ownership-safe cleanup, compatibility matrix, and smoke-test documentation

### Phase 2: Safe-Execution Guard

**Goal**: Every action Juno takes passes through code-enforced safety — destructive actions can never execute silently
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: SAFE-01, SAFE-02, SAFE-03, SAFE-04, SAFE-05, SAFE-06
**Success Criteria** (what must be TRUE):

  1. Every action is classified as read, write-benign, or write-destructive before execution
  2. A destructive action attempted without explicit demonstration or user confirmation is blocked (verified by automated test)
  3. Juno explores an unfamiliar site end-to-end without performing any irreversible action
  4. Every state-mutating action appears in an audit log the user can inspect
  5. User can abort a run at any time via a kill switch, and page content containing injected instructions never alters Juno's behavior

**Plans**: 1/1 complete — 02-01-PLAN.md; verification in phases/02-safe-execution-guard/02-VERIFICATION.md.

### Phase 3: Site Compiler & Per-Site Memory

**Goal**: Juno compiles explored sites into durable, versioned typed semantic models — entities plus operation contracts — that are saved per site and reloaded automatically across sessions
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: COMP-01, OPS-01, VERS-01, MEM-01, MEM-02, MEM-03
**Success Criteria** (what must be TRUE):

  1. After safe exploration of a site, Juno has a saved typed semantic model of its pages, navigation, elements, and actions
  2. Actions in the compiled model are typed first-class operations (OperationSpec: declared inputs, preconditions, effects, risk level, verification requirements) — not raw interaction sequences or selector collections
  3. Compiled knowledge is versioned (schema version, grounding versions, observed UI version), so drift from a prior compilation is detectable, regressions are localizable to the affected region, and cached-execution safety is knowable
  4. After restarting Juno completely, revisiting the site reloads its knowledge automatically — nothing is relearned
  5. Stored knowledge consists of semantic descriptions (role/label/text), not brittle locators or coordinates
  6. Secret session/credential state lives in a separate store from shareable semantic knowledge, and a semantic-knowledge export contains no secrets

**Plans**: TBD

### Phase 4: Planner, Execution & Authenticated Sites

**Goal**: The user states an intent and Juno executes multi-step workflows end-to-end on any site — including authenticated sites — through a deterministic runtime that verifies consequences, records receipts, retries idempotently, and recovers locally
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: EXEC-01, EXEC-02, EXEC-03, VERIF-01, VERIF-02, IDMP-01, COMP-02, RECOV-01, RECOV-02, AUTH-01, AUTH-02
**Success Criteria** (what must be TRUE):

  1. User gives Juno an intent and it plans and executes a multi-step workflow end-to-end, prompting for confirmation on destructive steps
  2. Juno fills forms and enters data into dynamic fields that appear or change during interaction, and extracts data from a page into structured output
  3. After executing an operation, Juno verifies the expected state transition actually occurred — the consequence, not the gesture: a "Success" toast or click-completion alone never satisfies a postcondition
  4. Every state-mutating operation produces an inspectable execution receipt (operation, inputs, observations before/after, expected vs verified effects, confidence, recovery taken)
  5. Before retrying a failed state-mutating operation, Juno checks whether the intended effect already occurred — no duplicate sends, submissions, or orders from blind retries
  6. When a UI change breaks a grounding, Juno repairs the smallest affected layer via the local recovery hierarchy (retry grounding → equivalent semantic element → reobserve/recompile region → alternate path → replan → escalate to human) without discarding the site model — and saved workflows still execute correctly after layout changes
  7. Self-healing is evidence-based: a candidate re-grounding must match semantic context (role, surrounding entity, expected effect) before use, with stronger evidence required for high-risk operations — never a look-alike swap
  8. Juno operates on an authenticated site (e.g., Outlook or Instagram) using the user's own session, and an expired session is detected with a handback to the user for re-authentication

**Plans**: TBD

### Phase 5: Teach-by-Showing

**Goal**: The user demonstrates an action once and Juno learns a parameterized, reusable, secret-free skill — composed of typed operations, not an opaque recorded trajectory — the core differentiator
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: LEARN-01, LEARN-02, LEARN-03, OPS-02
**Success Criteria** (what must be TRUE):

  1. User demonstrates an action once in the browser and Juno records it semantically (accessibility tree + input events — no pixels or raw coordinates)
  2. The learned skill decomposes into composable typed operations (with inputs, outputs, preconditions, effects) from the operation library — not a single opaque recorded macro
  3. The learned skill is parameterized: a demonstration of "message Alice" becomes "message {recipient}", and invoking it with a different recipient works end-to-end
  4. Secrets entered during the demonstration (passwords, tokens) are redacted from the persisted skill
  5. The learned skill replays end-to-end on the real site in a later session, with destructive steps still gated by confirmation

**Plans**: TBD

### Phase 6: Portal Recognition

**Goal**: Skills learned on one site are recognized as reusable on other sites that share the same underlying portal
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: PORT-01, PORT-02
**Success Criteria** (what must be TRUE):

  1. Given two different company career pages built on the same portal (e.g., Greenhouse/Lever), Juno fingerprints both and reports that they share a portal
  2. A skill learned on one site is applied on a different site sharing the portal without re-demonstration
  3. Genuinely different portals are not falsely matched (a skill is not silently reused on an unrelated site)

**Plans**: TBD

### Phase 7: Voice Control

**Goal**: The full Juno capability is drivable by voice — a pure input modality over the same execution pipeline
**Mode:** mvp
**Depends on**: Phase 6
**Requirements**: VOICE-01, VOICE-02
**Success Criteria** (what must be TRUE):

  1. User speaks an intent and Juno maps it to the same execution pipeline as typed input, executing it end-to-end
  2. A spoken destructive action goes through the exact same confirmation gate as a typed one — voice cannot bypass the guardrail
  3. The same workflow can be driven interchangeably by voice and by typing

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 1.1 → 2 → 3 → 4 → 5 → 6 → 7. The hosted fixture lab is a bounded quick task; see [the evidence ledger](TESTABLE-MILESTONE.md).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Browser Core | 3/3 | Complete    | 2026-08-24 |
| 1.1. Host-Browser Runtime & Windows | 0/3 | Planned; not implemented | - |
| 2. Safe-Execution Guard | 0/TBD | Not started | - |
| 3. Site Compiler & Per-Site Memory | 0/TBD | Not started | - |
| 4. Planner, Execution & Authenticated Sites | 0/TBD | Not started | - |
| 5. Teach-by-Showing | 0/TBD | Not started | - |
| 6. Portal Recognition | 0/TBD | Not started | - |
| 7. Voice Control | 0/TBD | Not started | - |
