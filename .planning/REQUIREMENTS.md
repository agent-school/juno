# Requirements: Juno

**Defined:** 2026-08-21
**Core Value:** Turn any website into a durable, reusable semantic understanding — learned through safe exploration and teach-by-showing — so hard-to-automate actions can be automated reliably without destructive guessing.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Browser Core

- [ ] **BRWS-01**: User can open any website and have Juno load and navigate it
- [ ] **BRWS-02**: Juno can read a page's semantic structure via the accessibility tree (roles, labels, text, state)
- [ ] **BRWS-03**: Juno can locate and interact with elements (click, type, scroll, select) using semantic refs that fail safe when the page changes
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

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Observability

- **OBSV-01**: Session video recording and step-level logs for debugging failed runs

### Credential Management

- **CRED-01**: Managed credential vault with 2FA automation

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
| BRWS-01 | TBD | Pending |
| BRWS-02 | TBD | Pending |
| BRWS-03 | TBD | Pending |
| BRWS-04 | TBD | Pending |
| SAFE-01 | TBD | Pending |
| SAFE-02 | TBD | Pending |
| SAFE-03 | TBD | Pending |
| SAFE-04 | TBD | Pending |
| SAFE-05 | TBD | Pending |
| SAFE-06 | TBD | Pending |
| COMP-01 | TBD | Pending |
| COMP-02 | TBD | Pending |
| MEM-01 | TBD | Pending |
| MEM-02 | TBD | Pending |
| MEM-03 | TBD | Pending |
| EXEC-01 | TBD | Pending |
| EXEC-02 | TBD | Pending |
| EXEC-03 | TBD | Pending |
| AUTH-01 | TBD | Pending |
| AUTH-02 | TBD | Pending |
| LEARN-01 | TBD | Pending |
| LEARN-02 | TBD | Pending |
| LEARN-03 | TBD | Pending |
| PORT-01 | TBD | Pending |
| PORT-02 | TBD | Pending |
| VOICE-01 | TBD | Pending |
| VOICE-02 | TBD | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 0
- Unmapped: 27 ⚠️

---
*Requirements defined: 2026-08-21*
*Last updated: 2026-08-21 after initial definition*
