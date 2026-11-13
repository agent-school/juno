# Guarded execution and site knowledge

`createGuardedActor` is the production execution boundary above the unchanged browser primitives. Unknown interactions default to destructive and require an explicit, expiring, one-shot confirmation bound to the exact method, semantic target, input and page. Only host-reviewed, exact origin/path/reference policies can classify a mutation as benign. Read-only mode blocks every mutation, including trusted benign ones. Page labels, source text and model-declared risks cannot grant authority. The confirmation/abort control object belongs in trusted UI/host code and must never become an agent or page tool.

Audit intent is persisted before an action. Persistence failure prevents execution; outcomes record completion, failure or abort without input values or page text. `completed` describes a browser action, not a verified effect. The lab's separate verifier still checks an exact, unique application-state consequence. Abort prevents subsequent actions and closes the controlled page to interrupt browser work; it cannot undo effects already committed. BrowserSession/SemanticActor remain low-level trusted development primitives, not unguarded planner tools.

`@juno/knowledge` compiles explicitly supplied page observations into schema-versioned `SiteModel` objects and host-reviewed `OperationSpec` contracts. A contract declares typed inputs, unique enabled semantic preconditions, parameterized actions, risk, expected record effects and an independent verification source. An observed button does not become a learned behavior. Unknown affordances remain observations, and every operation remains marked `requires-runtime-verification` until execution produces its own receipt.

Knowledge stores role/name/scope identities, enabled state, structural fingerprints, observed same-origin navigation and versioned contracts. It excludes ephemeral handles, coordinates, noninteractive page text, field values, cookies, storage, URL queries and fragments. Credential-shaped and supplied known-secret labels are omitted. Unknown sensitive material embedded in otherwise ordinary labels cannot be universally recognized; host secret redaction and controlled observations remain required before sharing unfamiliar-site knowledge.

The single-writer store retains ten revisions per site and at most twenty sites per workspace, with a 256 KB model budget. It validates schemas and fingerprints on reload, deduplicates unchanged structure, survives process replacement, isolates owners and supports explicit forgetting. Hashes detect accidental inconsistency; they are not signatures against an attacker who controls the filesystem. The atomic JSON store follows the existing hosted lab's storage pattern; SQLite migration remains a future storage improvement.

Browser profiles/session secrets and hashed account credentials remain in their separate private stores. Semantic knowledge never reads them. The hosted lab stores knowledge under `/data/site-knowledge`, while account hashes remain under `/data/accounts`; its temporary fixture browser profiles are outside both stores. Only the controlled fixture is exposed for browser execution.

Browser lab's saved operation now includes its typed site model. **Site versions (JSON)** inspects retained revisions. **Forget site model** clears the model and its versions, retaining old execution receipts. API boundaries:

- `GET /api/site-knowledge`: owner-scoped validated revision history.
- `POST /api/site-knowledge/forget` with `{}` and `x-juno-request: 1`: forget that workspace's fixed fixture site and clear its current binding.
- Existing compile/run/export endpoints include the current typed model and value-free action audit.

This increment provides a guarded runtime and a typed, durable compiler substrate. It does not establish autonomous arbitrary-site exploration, general behavior discovery, authenticated-site execution, evidence-based self-healing, teach-by-showing or Muse parity. Phase 3 remains open for broader compiler validation; Phase 4 must add intent planning, verified composition, idempotent recovery and session-expiry handback before real-account workflows expand.
