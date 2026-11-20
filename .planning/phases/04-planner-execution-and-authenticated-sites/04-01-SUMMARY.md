---
phase: 04-planner-execution-and-authenticated-sites
plan: 01
subsystem: task-runtime
completed: 2026-11-14
implementation: 816ffe8
---

# Reproducible task-runtime foundation accepted

Added `AgentRuntime`, `RunStore`, typed task/proof schemas, `planTask` and an OpenAI-compatible interpreter. The model receives a reviewed operation catalog and proposes typed calls; host code supplies model/task identity and separate action permissions. Complete plans are validated before browser actions. The demo atomically saves/fsyncs accepted plans before execution and reloads them without replanning.

Each operation gets a stable owner/origin/task/step request key. The runtime verifies independent state before and after guarded execution, persists audit intent before mutation and stops downstream work on divergence. A separate SQLite process lock allows durable journal commits and is released by the OS after process death. Unknown writes require confirmation and remain blocked in this CLI; model risk labels never grant permission. Lost previously verified state is escalated, not recreated.

The reference task creates a contact with a false checkbox value, then a dependent follow-up on another page. A second invocation returns the saved verified request with zero extra writes. The benchmark checks nineteen safety/reproducibility conditions and writes JSON evidence with optional Playwright traces. The same demo and benchmark run in the existing Docker image with a persistent named volume, without host Node.

Validation: 141 repository unit tests (21 agent tests), 23 browser/API tests, two native CDP tests, 19/19 real Chrome checks and 19/19 bundled Chromium checks. A real worker is killed between application commit and receipt commit, then recovered without duplicate writes; Chrome is deliberately closed before that injected journal crash.

Review hardening 816ffe8 removes standing approved-path POST access. A durable authorized action arms one host-reviewed route/path/JSON request, consumed before dispatch with expiry and failure/abort revocation. Page scripts cannot use it for a different body or repeat it. Redirects cannot forward authorized payloads. Exact full-URL benign policies deny unreviewed query/fragment variants; Browser lab binds its generated query explicitly. Failed host setup always releases acquired fixture resources.

Live provider validation is blocked: the existing OpenAI credential returned HTTP 401 on one synthetic request. No plan was accepted and no application writes followed. Offline transport tests cover successful JSON, auth rejection, truncation, filtering/tool output and response budgets. Live interpretation, broader site adapters, authenticated sessions, dynamic fields, page extraction, interactive destructive confirmation, semantic repair and full Phase 4 acceptance remain open.
