# Requirements: Juno

**Defined:** 2026-08-21
**Core Value:** Turn any website into a durable, reusable semantic understanding — learned through safe exploration and teach-by-showing — so hard-to-automate actions can be automated reliably without destructive guessing.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Browser Core

- [ ] **BRWS-01**: User can open any website and have Juno load and navigate it
- [x] **BRWS-02**: Juno can read a page's semantic structure via the accessibility tree (roles, labels, text, state)
- [x] **BRWS-03**: Juno can locate and interact with elements (click, type, scroll, select) using semantic refs that fail safe when the page changes
- [ ] **BRWS-04**: Juno drives the browser through a persistent real-user profile (no stealth evasion)

### Safety

- [ ] **SAFE-01**: Juno classifies every action as read, write-benign, or write-destructive before executing it
- [ ] **SAFE-02**: Juno blocks destructive actions unless they were explicitly demonstrated or confirmed by the user
- [ ] **SAFE-03**: Juno can explore a site read-only without performing irreversible actions
- [ ] **SAFE-04**: Juno records an audit log of every state-mutating action
- [ ] **SAFE-05**: Juno treats all web page content as untrusted data, never as instructions (prompt-injection defense)
- [ ] **SAFE-06**: User can abort a run at any time (kill switch)

### Semantic Compiler

- [ ] **COMP-01**: Juno compiles a website into a durable typed semantic model of its pages, navigation, elements, and actions
- [ ] **COMP-02**: Juno re-identifies elements against the live page at replay time (self-healing), so saved knowledge survives layout changes

### Memory

- [ ] **MEM-01**: Juno saves learned site knowledge so it persists across sessions and reloads automatically per site
- [ ] **MEM-02**: Juno stores semantic descriptions (role/label/text), not brittle locators or coordinates
- [ ] **MEM-03**: Juno keeps secret session/credential state separate from shareable semantic knowledge (two-store split)

### Execution

- [ ] **EXEC-01**: User can give Juno an intent and have it execute a multi-step workflow end-to-end with confirmation on destructive steps
- [ ] **EXEC-02**: Juno can fill forms and enter data into dynamic fields
- [ ] **EXEC-03**: Juno can extract data from a page into structured output

### Authentication

- [ ] **AUTH-01**: Juno can work on authenticated sites (Instagram, Outlook) using the user's own session/profile
- [ ] **AUTH-02**: Juno detects an expired session and hands back to the user for re-authentication

### Teach-by-Showing

- [ ] **LEARN-01**: User can teach Juno an action by demonstrating it once, and Juno records it semantically (accessibility + input events, not pixels)
- [ ] **LEARN-02**: Juno generalizes a single demonstration into a parameterized, reusable skill (e.g., "message {recipient}" for any recipient)
- [ ] **LEARN-03**: Juno redacts secrets from learned skills before persisting them

### Portal Recognition

- [ ] **PORT-01**: Juno recognizes when different sites share the same underlying portal (e.g., job application portals) via fingerprinting
- [ ] **PORT-02**: Juno reuses a learned skill across sites that share a portal

### Voice

- [ ] **VOICE-01**: User can drive Juno by speaking; voice input maps to the same execution pipeline
- [ ] **VOICE-02**: Voice-driven destructive actions go through the same confirmation guardrail as typed input

### Operation Contracts

- [ ] **OPS-01**: Operations are typed first-class objects with declared inputs, preconditions, effects, risk level, and verification requirements (not raw interaction sequences)
- [ ] **OPS-02**: A learned skill decomposes into composable typed operations rather than one opaque recorded trajectory

### Verification

- [ ] **VERIF-01**: After executing an operation, Juno verifies the expected state transition actually occurred (consequence, not gesture — a "Success" toast alone never satisfies a postcondition)
- [ ] **VERIF-02**: Every state-mutating operation produces an execution receipt (operation, inputs, observations before/after, expected vs verified effects, confidence, recovery taken)

### Recovery

- [ ] **RECOV-01**: When a grounding breaks (UI changed), Juno repairs the smallest affected layer locally (retry grounding → equivalent semantic element → recompile region → alternate path → replan → escalate) without discarding the site model
- [ ] **RECOV-02**: Self-healing is evidence-based — a candidate re-grounding must match semantic context (role, entity, expected effect) before use, with stronger evidence required for high-risk operations

### Knowledge Versioning & Idempotency

- [ ] **VERS-01**: Compiled site knowledge is versioned (schema, groundings, observed UI version) so drift is detectable, regressions are localizable, and cached execution safety is knowable
- [ ] **IDMP-01**: Before retrying a failed state-mutating operation, Juno checks whether the intended effect already occurred (no duplicate sends, submissions, or orders from blind retries)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Observability

- **OBSV-01**: Session video recording and step-level logs for debugging failed runs

### Credential Management

- **CRED-01**: Managed credential vault with 2FA automation

### Advanced Execution

- **EXEC-04**: Multi-path execution routing — an operation executes via the best available mechanism (API, observed network call, DOM/AX, visual), not just the browser UI

### Learning

- **LRN-04**: Causal state-transition learning — predict semantic state S→S' per operation and improve from verified outcomes (prediction-before-action as a training signal)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Fully autonomous "just do it" mode (no confirmation) | Breaks the central safety constraint — wrong actions on real sites are destructive |
| Raw CSS/XPath selector automation as the primary mechanism | Brittle — layout changes silently break it; semantic refs are the correct default |
| Unbounded auto-extraction of web content into memory | Indirect prompt-injection risk; page content must cross an untrusted-input boundary |
| General desktop/OS computer-use in v1 | Scope explosion; browser-scoped compiler + safety model must be proven first |
| Anti-bot stealth evasion (Camoufox/Patchright, CAPTCHA solvers) | ToS/account-ban risk; Juno automates the user's own accounts via real profile + human handoff |
| No-code RPA / enterprise workflow builder | Off-mission; dilutes the compiler + teach-by-showing thesis |

## Definition of Done

- All v1 requirements implemented and verified per phase.
- Destructive actions never execute without a demonstration or explicit confirmation (verified by automated tests).
- Saved knowledge survives a session restart and replays correctly on a known site.
- One real motivating use case (e.g., send a message, sign a document) runs end-to-end with confirmation.

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BRWS-01 | Phase 1 | Pending |
| BRWS-02 | Phase 1 | Complete |
| BRWS-03 | Phase 1 | Complete |
| BRWS-04 | Phase 1 | Pending |
| SAFE-01 | Phase 2 | Pending |
| SAFE-02 | Phase 2 | Pending |
| SAFE-03 | Phase 2 | Pending |
| SAFE-04 | Phase 2 | Pending |
| SAFE-05 | Phase 2 | Pending |
| SAFE-06 | Phase 2 | Pending |
| COMP-01 | Phase 3 | Pending |
| OPS-01 | Phase 3 | Pending |
| VERS-01 | Phase 3 | Pending |
| MEM-01 | Phase 3 | Pending |
| MEM-02 | Phase 3 | Pending |
| MEM-03 | Phase 3 | Pending |
| EXEC-01 | Phase 4 | Pending |
| EXEC-02 | Phase 4 | Pending |
| EXEC-03 | Phase 4 | Pending |
| VERIF-01 | Phase 4 | Pending |
| VERIF-02 | Phase 4 | Pending |
| IDMP-01 | Phase 4 | Pending |
| COMP-02 | Phase 4 | Pending |
| RECOV-01 | Phase 4 | Pending |
| RECOV-02 | Phase 4 | Pending |
| AUTH-01 | Phase 4 | Pending |
| AUTH-02 | Phase 4 | Pending |
| LEARN-01 | Phase 5 | Pending |
| LEARN-02 | Phase 5 | Pending |
| LEARN-03 | Phase 5 | Pending |
| OPS-02 | Phase 5 | Pending |
| PORT-01 | Phase 6 | Pending |
| PORT-02 | Phase 6 | Pending |
| VOICE-01 | Phase 7 | Pending |
| VOICE-02 | Phase 7 | Pending |

**Coverage:**

- v1 requirements: 35 total
- Mapped to phases: 35
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-21*
*Last updated: 2026-08-21 after doctrine ingestion (DOCTRINE.md) and roadmap revision — 35/35 mapped*
