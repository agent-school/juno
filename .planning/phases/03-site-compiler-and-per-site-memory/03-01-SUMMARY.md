---
phase: 03-site-compiler-and-per-site-memory
plan: 01
status: complete
phase_status: in_progress
---

# Typed knowledge substrate

Added @juno/knowledge with strict SiteModel and OperationSpec contracts, structural/operation versions, semantic inventories, observed navigation, drift comparison, owner-isolated atomic history, bounded retention and explicit forgetting. Uses existing pinned dependencies; lockfile changes add only workspace importers.

The owned fixture now saves its typed contract, reloads/validates site knowledge before replay, exposes owner-scoped version history and supports Forget site model. Action receipts retain independent verification and secret-free audits. Profile/account state remains outside knowledge.

Verified schema rejection, unique/disabled targets, undeclared parameters, stable reordering, local drift, known-secret/credential-label omission, observed-only navigation, cross-owner isolation, process-store replacement, corruption rejection, history limits, API export and forgetting. The full standard browser/API suite passes.

Phase 3 remains open: autonomous site exploration, broader operation discovery and real-site compiler validation are not established. No authenticated-site, self-healing, teaching or Muse-parity claim. Next work should validate the compiler on a controlled multi-page real application before Phase 4 introduces intent planning and authenticated execution.
