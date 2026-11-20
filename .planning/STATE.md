---
gsd_state_version: 1.0
current_phase: 3
current_phase_name: Site Compiler and Per-Site Memory
status: in_progress
stopped_at: Native public-web research deployed; repeatable comparison and follow-up acceptance remain open
last_updated: "2026-11-20"
last_activity: 2026-11-20
last_activity_desc: Simplified source review output, improved citation correction and restored workspace recovery at capacity
state_head: ee6213e68d26a77b2e6933abdf61e0337ae45c0f
progress:
  total_phases: 8
  completed_phases: 2
  total_plans: 13
  completed_plans: 11
  percent: 25
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-24)

**Core value:** Turn any website into a durable, reusable semantic understanding — learned through safe exploration and teach-by-showing — so hard-to-automate actions can be automated reliably without destructive guessing.
**Current focus:** 04-04 connects the general public-web Agent to AWS Bedrock Converse using server-only credentials. The currently deployed Opus path requires a separate source-consistency check before publishing. Earlier Sonnet runs demonstrated hosted comparison, fresh-source follow-up, Stop, reload and account/write refusal; repeatable model performance remains an acceptance gate. Evidence collection is independently usable. Search-heavy pages can exhaust the request budget. Contact execution and the 19-condition matrix remain in Engine tests. Authenticated sites, repair, teaching, desktop control and RUNTIME-03 firewall enforcement remain open.

## Current Position

Phase: 3 — Site Compiler & Per-Site Memory
Plan: 03-01 substrate, 03-02 multi-page observer, 04-01 execution foundation, 04-02 hosted integration and 04-03 general public-web tasks complete as bounded slices; full phases remain open
Status: Phase 2 complete; Phase 01.1 has actual Windows evidence with RUNTIME-03 firewall acceptance open
Last activity: 2026-11-20 — Typechecks, 172 unit tests and 36 browser/API tests pass. Draft review now uses a fixed issue classification for each supplied part ID and receives review-specific retry feedback. Invalid citations identify the exact field and observed IDs. At 500 saved workspaces, existing users can recover or sign out without consuming a slot. See the [04-04 summary](phases/04-planner-execution-and-authenticated-sites/04-04-SUMMARY.md) for deployment evidence and remaining reliability limits.

Windows acceptance remains as recorded in 67b6098: actual Chrome/Docker execution and 12/12 startup interruption trials passed; enabled-firewall enforcement, other Windows configurations and forced host termination remain outside that evidence.

Review follow-up: 12a399c fixes boolean checkbox state through raw/guarded actors and common dotted/encoded site routes through one canonical pathname schema. Both failures were reproduced before the fix. Typechecks, 115 unit tests, 22 standard browser/API tests and the CDP tracer passed then. These fixes are now included in the hosted integration. No new environment dependencies or blueprint changes were needed.

Agent foundation (2026-11-14, implementation bf1ec85): `@juno/agent` adds bounded multi-page observation, typed catalog interpretation, guarded multi-operation execution, expected/verified effect receipts and crash-safe request recovery. `pnpm agent:demo` creates a contact and dependent follow-up; a second process reuses the verified task with zero writes. `pnpm agent:benchmark` passes 17/17 checks in Chrome and the Docker image's bundled Chromium. Full typechecks, 134 unit tests, 23 browser/API tests and two native CDP tests pass. Live OpenAI interpretation returned HTTP 401, so model-backed planning remains unverified; no application writes followed. See Phase 4 verification for scope and remaining gates. No hosted deployment occurred. Existing Node 24/Chrome blueprint covers this increment without changes.

Review follow-up 816ffe8: setup failure cleanup, exact query/fragment policy scope and audited one-shot network write grants are fixed. HTTP redirects are refused, and hostile page scripts cannot POST outside an approved payload. Reproduced lifecycle, scope and write-canary failures before the fixes. Typechecks, 141 unit tests, 23 browser/API tests and two native CDP tests pass; the expanded benchmark passes 19/19 in Chrome and rebuilt Docker Chromium. Browser lab's legitimate requestId query is explicitly host-reviewed and its full regression flow passes. No new environment dependencies, blueprint changes or hosted deployment.

Progress: 2/8 roadmap phases complete. Runtime and knowledge increments do not establish Muse parity or authenticated-site execution. See phase verification files for remaining gates.

## Performance Metrics

**Velocity:**

- Total plans completed: 10
- Average duration: -
- Total execution time: Not instrumented; see plan summaries and verification evidence

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | - | - |
| 01.1 | 2 accepted; launcher acceptance open | - | - |
| 02 | 1 | - | - |
| 03 substrate/observer | 2 | - | - |
| 04 foundation and hosted integration | 2 | - | - |

**Recent Trend:**

- Recently accepted: Phase 01.1 P01/P02 runtime and container harness; P03 launcher acceptance remains partial
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P02 | 12 min | 2 tasks | 8 files |
| Phase 01 P03 | 15 min | 2 tasks | 8 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Phase 1] Browser core established: persistent dedicated profile, SemanticPageReader (zod-validated a11y perception), SemanticActor (fail-safe semantic actions, GroundingError family for Phase 2 guard)
- [Phase 1] Empty pages capture as empty-string snapshots — PageTree root is a children wrapper, never a synthesized root node
- [Phase 1] Ephemeral eN refs carry captured identity and are re-validated against fresh snapshots before every action
- Roadmap: Safety guard (Phase 2) is co-developed immediately after the browser primitive — never deferred past first destructive-capable build
- Roadmap: COMP-02 (self-healing replay) placed in Phase 4 where replay is observable, not in the Phase 3 compiler phase
- Roadmap: Teach-by-showing (Phase 5) deliberately arrives after IR/planner/replay (Phase 4) — demonstrations need something to compile into
- Doctrine mapping: OPS-01 (typed operation contracts) and VERS-01 (versioned knowledge) live in Phase 3 — they are properties of what the compiler emits and stores; OPS-02 (compositional skills) lives in Phase 5 — decomposition needs Phase 4's operation library to exist
- Doctrine mapping: VERIF-01/02, IDMP-01, RECOV-01/02 all landed in Phase 4 — they are runtime-loop behaviors (predict → execute → verify → receipt → recover locally → retry safely), making Phase 4 the full doctrine runtime (11 requirements)

### Pending Todos

- Jack's lab trial: complete the in-app checklist, export evidence and leave feedback.
- Review recorded research/memory UI evidence with Jack; remaining UI gaps include nonzero diffs, naturally long-running polling, partial/interrupted outcomes and physical mobile devices. Instrumented equal-snapshot preservation passed separately.
- Reconcile Coolify's cached `exited:unhealthy` field with successful live checks; host Docker health has not been independently inspected.
- Jack's task/memory trial: search → explicitly remember → refresh/diff → correct/forget; select the next recurring real task.
- Decide with Jack whether newer Notion Rolo → Canvas validation order supersedes the older Instagram-first validation target.

### Blockers/Concerns

- Saved OpenAI access returns HTTP 401 `ip_not_authorized`; OpenCode's free route hit its usage limit. Existing Bedrock credentials now authenticate and complete hosted public-web goals. This uses the existing metered AWS account. Engine written-request planning remains separately untested live.

- Replacement Coolify token works and is saved. Public HTTPS and redeploy persistence passed on the temporary hostname; requested hostname DNS and valid HTTPS passed on 2026-11-13.
- Coolify API status disagrees with observed application availability. Keep that monitoring gap explicit.
- Agent is the public default view for bounded, model-driven public-web information goals. Engine tests contain the synthetic contact/follow-up operations. Research remains a separate deterministic GitHub workflow. Search completeness, authenticated actions and general Muse-style autonomy remain unfinished.

## Quick Tasks Completed

| # | Description | Date | Implementation commit | Directory |
|---|-------------|------|-----------------------|-----------|
| 261112-n4s | Hosted semantic operation lab with durable receipts and evidence gates | 2026-11-12 | 11a8acc | [Quick task](quick/261112-n4s-hosted-semantic-operation-workbench-with/) |

## Quick Task Deliverables and Remaining Gates

| # | Delivered slice | Remaining gate | Directory |
|---|---|---|---|
| 261112-nq5 | Live project research, refresh/diff, user-controlled durable memory, protected-workspace recovery | User/UI trial; hosting evidence followed in 261112-p1y | [Plan, summary and verification](quick/261112-nq5-real-open-source-research-tasks-with-sou/) |
| 261112-p1y | Coolify deployment, valid public HTTPS on temporary and requested hostnames, live research/browser checks and hosted memory/account persistence across redeploy | Monitoring discrepancy and user/UI trial | [Plan, summary and verification](quick/261112-p1y-deploy-verified-juno-workbench-to-coolif/) |
| 261113-0u5 | Impeccable-informed research desk and memory interface deployed on requested domain; 25 hosted assertions including asset hashes, recovery and upgrade persistence passed | Jack's own trial and monitoring discrepancy; recorded UI verification followed in 261113-2ca | [Plan, summary and verification](quick/261113-0u5-rethink-juno-interface-using-impeccable-/) |
| 261113-2ca | Recorded hosted research/memory/recovery and lab UI trial; empty-state and stale-notice corrections with shipped-client regressions, deployed to requested domain | Jack's own trial, listed UI coverage limits and monitoring discrepancy | [Plan, summary and verification](quick/261113-2ca-fix-empty-research-workspace-initializat/) |
| 261113-mny | Actual Windows matrix; two Ctrl-C startup-race corrections; final real Chrome sweep 12/12 and full semantic/lifecycle rerun passed | RUNTIME-03 enabled-firewall enforcement; Windows 10/11 and other backends unverified | [Plan and summary](quick/261113-mny-fix-windows-ctrl-c-startup-ownership-cle/) |
| 261113-o3i | False checkbox input and canonical route review regressions reproduced/fixed; typecheck, 115 unit tests, 22 browser/API tests and CDP tracer pass | Broader compiler and firewall gates unchanged; hosted revision unchanged | [Plan and summary](quick/261113-o3i-fix-value-aware-checkbox-actions-and-can/) |

- Phase 5 (Teach-by-Showing): single-demonstration → parameterized-skill generalization is MEDIUM confidence in research — needs a spike during planning
- Phase 6 (Portal Recognition): portal fingerprinting approach needs empirical validation against real job portals (Greenhouse, Lever, Workday)
- Cross-cutting: Instagram anti-bot feasibility needs a dedicated spike before Instagram messaging is an acceptance criterion

## Deferred Items

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-11-20
Stopped at: Native Bedrock inference and workspace recovery fixes are deployed. See 04-04 for current hosted and historical UI evidence. Public-web repeatability, authenticated workflows, semantic repair and RUNTIME-03 firewall acceptance remain open. No PR was merged.
Resume file: .planning/phases/04-planner-execution-and-authenticated-sites/04-VERIFICATION.md
