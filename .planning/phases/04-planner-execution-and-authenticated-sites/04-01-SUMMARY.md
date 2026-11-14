---
phase: 04-planner-execution-and-authenticated-sites
plan: 01
subsystem: task-runtime
completed: 2026-11-14
implementation: bf1ec85
---

# Reproducible task-runtime foundation accepted

Added `AgentRuntime`, `RunStore`, typed task/proof schemas, `planTask` and an OpenAI-compatible interpreter. The model receives a reviewed operation catalog and proposes typed calls; host code supplies model/task identity and separate action permissions. Complete plans are validated before browser actions. The demo atomically saves/fsyncs accepted plans before execution and reloads them without replanning.

Each operation gets a stable owner/origin/task/step request key. The runtime verifies independent state before and after guarded execution, persists audit intent before mutation and stops downstream work on divergence. A separate SQLite process lock allows durable journal commits and is released by the OS after process death. Unknown writes require confirmation and remain blocked in this CLI; model risk labels never grant permission. Lost previously verified state is escalated, not recreated.

The reference task creates a contact with a false checkbox value, then a dependent follow-up on another page. A second invocation returns the saved verified request with zero extra writes. The benchmark checks seventeen safety/reproducibility conditions and writes JSON evidence with optional Playwright traces. The same demo and benchmark run in the existing Docker image with a persistent named volume, without host Node.

Validation: 134 repository unit tests (19 agent tests), 23 browser/API tests, two native CDP tests, 17/17 real Chrome checks and 17/17 bundled Chromium checks. A real worker is killed between application commit and receipt commit, then recovered without duplicate writes; Chrome is deliberately closed before that injected journal crash.

Live provider validation is blocked: the existing OpenAI credential returned HTTP 401 on one synthetic request. No plan was accepted and no application writes followed. Offline transport tests cover successful JSON, auth rejection, truncation, filtering/tool output and response budgets. Live interpretation, broader site adapters, authenticated sessions, dynamic fields, page extraction, interactive destructive confirmation, semantic repair and full Phase 4 acceptance remain open.
