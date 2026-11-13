---
id: 261112-nq5
status: code_verified_deployment_blocked
---

# Real task and durable memory slice

Jack requested Coolify deployment at `juno.agentschool.io` and useful task execution inspired by Muse with strong memory. The new default screen runs a real public-project research task, with a later refresh/diff operation. The controlled semantic browser lab remains separate and functional.

## Delivered

- Typed, fixed-origin, read-only GitHub research using actual public metadata. Identity/schema/filter checks precede accepted results. The initial operation returns up to five projects; exact-repository refresh compares remembered baselines, including changes to archived status.
- Tasks start in the background, persist activity/results/errors, survive page navigation and become explicitly interrupted on server restart. Stable request IDs suppress duplicate execution; forgotten IDs remain UUID-only tombstones. A stop signal aborts in-flight source requests.
- Structured/versioned research defaults; editable notes with bounded revisions; query-matched recalled context; explicitly approved sourced project snapshots and named reusable search recipes. Saved baselines are never silently overwritten. Source descriptions remain untrusted data.
- Inspect/edit/forget/export controls, source observation times/staleness, task evidence and per-field differences. Forgetting a note also scrubs historical recalled copies without a race resurrecting them from an active task.
- Optional passphrase-protected workspace recovery using salted scrypt credentials separate from owner state and evidence exports. A fresh cookie context can reopen the same memory after container replacement; unrelated anonymous workspaces remain isolated.
- Existing JSON storage receives an additive migration. Same startup commands, Node/pnpm/Chrome and `/data` volume; no new dependencies or model credentials. SQLite/FTS learned website memory remains a later compiler milestone.

## Verification

See the companion VERIFICATION artifact. The live public task returned five actual projects. Refresh compared one explicitly remembered project; it found no metadata changes over that short interval. Controlled unit fixtures separately verify a real difference is reported. A fresh container using the same volume retained the full workspace, browser model/receipt, feedback and protected-workspace recovery.

## Decisions and friction

- No Muse workflow was supplied beyond the product reference. Open-source research is the stated first bounded vertical, not a claim of an arbitrary conversational assistant or Muse parity. Jack can steer the next operation after trying it.
- Initial live API smoke hit the shared egress IP's exhausted GitHub **core** quota while rereading every search result. Repository search already returns the required authoritative metadata. Search now validates that one response directly; refresh consistently uses exact-repository search. This reduces a five-result search from six requests to one. A nine-requests/minute source cap stays below the normal anonymous search quota; failures still remain explicit. No token, alternate identity, hidden source or rate-limit retry is used.
- A container-replacement harness initially reused a dead HTTP keep-alive socket. The verification client now closes its connections around replacement; the final complete run passed. No lost data or application failure was inferred from that client socket error.
- The saved blueprint was reviewed and needs no runtime/maintenance changes for this slice.

## Still pending

- **Permanent deployment:** Coolify saved token HTTP 401; `juno.agentschool.io` points to Porkbun parking rather than `54.157.57.51`. Exact Dockerfile, port 5123, one replica, volume and DNS instructions are in `docs/LAB.md`. No Coolify deployment, DNS update, public TLS or hosted redeploy persistence is claimed.
- Jack's user trial and UI-driven usability testing. All current new checks are unit/API/container checks, not a recorded browser walkthrough.
- Existing Codex feedback-confirmation finding still awaits Jack's approval under the org bot-response rule. The feedback API persists correctly; the old UI confirmation handler is unchanged.
- Full host-browser/Windows runtime, execution guard, natural-language planner/provider layer, SQLite per-site models, Rolo/Canvas/Instagram, teaching, cross-application semantics and voice.

Recommended next product slice: choose one task Jack would repeat weekly, teach a specific real application operation after the full guard/runtime boundaries are ready, and reuse the new episode/provenance/memory controls around it. Keep API task evidence distinct from learned browser model evidence.
