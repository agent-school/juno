---
phase: 04-planner-execution-and-authenticated-sites
plan: 02
subsystem: hosted-agent
completed: 2026-11-18
implementation: a2c4cf7
---

# Hosted Agent integration accepted

The engine is available through the frontend and backend at https://juno.agentschool.io. Agent is the default view: compose a supported contact/follow-up task, review its saved typed plan before execution, run it, inspect browser frames and independently verified records, stop/resume the same request, recheck without duplicate writes, download receipts, inspect/download/forget site knowledge, and run or stop the existing 19-condition reliability matrix. Research, personal Memory, Browser lab and previous workspace recovery remain available.

The reviewed adapter is exported as `@juno/agent/owned`. `AgentService` partitions task plans, SQLite journals, synthetic application data, frames, knowledge and check reports by the existing workspace identity, under `/data/agent-workspaces`. One browser worker is shared with Browser lab. The private loopback application requires a server-held bearer token. Clients cannot choose origins, selectors, contracts, credentials or execution authority. Interrupted tasks require explicit inspection/resumption. Optional language planning remains server-configured and every accepted proposal still needs review.

Implementation d2195e5 connected the UI/API, bounded persistence and reliability jobs. Review follow-up a2c4cf7 registers preparation completion before acquiring resources, passes cancellation through compilation, waits for browser/journal/fixture cleanup and starts shutdown cancellation before draining HTTP clients. Three lifecycle regressions cover held cleanup and immediate shutdown; cancellation cannot save a new plan afterward.

Validation: typechecks; 146 unit tests; 30 browser/API tests; two native CDP tests; Docker build; 19/19 checks in local Chrome, bundled container Chromium and the hosted job. Local container replacement retained tasks, receipts, frames, knowledge, reliability reports and research notes. Production HTTP checks verified schemas/CSRF, ownership isolation, review-before-write, two independently verified effects, PNG/receipt downloads, 19/19 checks and check cancellation. Replaying the same request added zero writes.

Coolify deployment `3wbopiyho1yqswkd8ljcntos` pins a2c4cf7, replacing d2195e5 on the existing application and unchanged `/data` volume. HTTPS health and all three frontend asset hashes match. After replacement, the same workspace retained its task, receipt, screenshot, knowledge, reliability report and research note; replay added zero writes. Forget invalidated old plans without changing records; reobservation/new review restored usability. Coolify's cached `exited:unhealthy` status still disagrees with live checks.

Recorded hosted UI verification on a2c4cf7 passed using an isolated synthetic workspace: exact typed review-before-run, real Chromium execution and 11-action audit, independent results, reload/history/recheck, stop/resume, false-success uncertainty, renamed-control refusal, reordered execution, site-knowledge download/forget/observe, reliability stop and 19/19 completion, Research/Memory regressions and 390px keyboard review. Five identical real polls preserved draft, node identity, focus, caret and disclosure state under supplemental passive instrumentation. Evidence is attached in the [Devin session](https://app.devin.ai/sessions/d0f8409f16a04d4eb9746c4504fc750c?testRecording=c8594148-0221-4c02-8b3a-17d508aab3c1).

UI coverage limits: five-job cap; standalone ambiguous/injection/follow-up-renamed trials; shutdown during preparation; physical mobile; Windows Desktop; configured language planning; feedback submission. Ambiguity/injection are exercised by the UI-started matrix; preparation shutdown has controlled unit coverage. These are different forms of evidence, not substitutes for those omitted UI cases.

The existing Node 24/pnpm/Chrome blueprint was re-read and remains sufficient; no dependency or blueprint change was needed. CI passed on the implementation. Broader site discovery, authenticated workflows, teach-by-showing, semantic repair, interactive destructive approval, live provider success and RUNTIME-03 firewall acceptance remain open. This accepts the hosted integration, not full Phase 4 or Muse parity. Work stays in https://github.com/agent-school/juno/pull/3; no merge is performed.
