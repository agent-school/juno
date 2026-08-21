# Roadmap: Juno

## Overview

Juno is built bottom-up along its dependency chain: first a browser primitive that can load, read (via the accessibility tree), and act on any website with semantic references; then a code-enforced safe-execution guard so the primitive can never destroy anything silently; then the novel core — a semantic site compiler writing durable knowledge into per-site persistent memory. On top of that substrate come the user-facing capabilities in dependency order: intent-driven multi-step execution (including authenticated sites and self-healing replay), teach-by-showing (demonstration → parameterized skill), cross-site portal recognition (one learned skill generalizes across sites sharing a portal), and finally voice as a pure input modality over the same pipeline. Safety is co-developed with execution, never deferred — every phase after Phase 2 inherits its guards.

**Milestone:** v1 (MVP)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Browser Core** - Load any site, read its accessibility tree, act via semantic refs under a real-user profile
- [ ] **Phase 2: Safe-Execution Guard** - Code-enforced action classification, destructive-action gates, audit log, kill switch, injection defense
- [ ] **Phase 3: Site Compiler & Per-Site Memory** - Compile explored sites into durable typed semantic models that persist across sessions
- [ ] **Phase 4: Planner, Execution & Authenticated Sites** - Intent → end-to-end multi-step workflows with self-healing replay on any site, including authenticated ones
- [ ] **Phase 5: Teach-by-Showing** - Demonstrate an action once; Juno learns a parameterized, secret-free, reusable skill
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
**Plans**: TBD

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
**Plans**: TBD

### Phase 3: Site Compiler & Per-Site Memory
**Goal**: Juno compiles explored sites into durable typed semantic models that are saved per site and reloaded automatically across sessions
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: COMP-01, MEM-01, MEM-02, MEM-03
**Success Criteria** (what must be TRUE):
  1. After safe exploration of a site, Juno has a saved typed semantic model of its pages, navigation, elements, and actions
  2. After restarting Juno completely, revisiting the site reloads its knowledge automatically — nothing is relearned
  3. Stored knowledge consists of semantic descriptions (role/label/text), not brittle locators or coordinates
  4. Secret session/credential state lives in a separate store from shareable semantic knowledge, and a semantic-knowledge export contains no secrets
**Plans**: TBD

### Phase 4: Planner, Execution & Authenticated Sites
**Goal**: The user states an intent and Juno executes multi-step workflows end-to-end on any site — including authenticated sites — with self-healing replay
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: EXEC-01, EXEC-02, EXEC-03, COMP-02, AUTH-01, AUTH-02
**Success Criteria** (what must be TRUE):
  1. User gives Juno an intent and it plans and executes a multi-step workflow end-to-end, prompting for confirmation on destructive steps
  2. Juno fills forms and enters data into dynamic fields that appear or change during interaction
  3. Juno extracts data from a page into structured output
  4. A saved workflow still executes correctly after the site's layout changes (elements are re-identified against the live page, not stale selectors)
  5. Juno operates on an authenticated site (e.g., Outlook or Instagram) using the user's own session, and an expired session is detected with a handback to the user for re-authentication
**Plans**: TBD

### Phase 5: Teach-by-Showing
**Goal**: The user demonstrates an action once and Juno learns a parameterized, reusable, secret-free skill — the core differentiator
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: LEARN-01, LEARN-02, LEARN-03
**Success Criteria** (what must be TRUE):
  1. User demonstrates an action once in the browser and Juno records it semantically (accessibility tree + input events — no pixels or raw coordinates)
  2. The learned skill is parameterized: a demonstration of "message Alice" becomes "message {recipient}", and invoking it with a different recipient works end-to-end
  3. Secrets entered during the demonstration (passwords, tokens) are redacted from the persisted skill
  4. The learned skill replays end-to-end on the real site in a later session, with destructive steps still gated by confirmation
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
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Browser Core | 0/TBD | Not started | - |
| 2. Safe-Execution Guard | 0/TBD | Not started | - |
| 3. Site Compiler & Per-Site Memory | 0/TBD | Not started | - |
| 4. Planner, Execution & Authenticated Sites | 0/TBD | Not started | - |
| 5. Teach-by-Showing | 0/TBD | Not started | - |
| 6. Portal Recognition | 0/TBD | Not started | - |
| 7. Voice Control | 0/TBD | Not started | - |
