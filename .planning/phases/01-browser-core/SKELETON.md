# Walking Skeleton — Juno

**Phase:** 1 (Browser Core)
**Generated:** 2026-08-21

## Capability Proven End-to-End

> Juno can launch a real Chrome session under a dedicated persistent profile, load a URL, read the page's semantic structure from the accessibility tree, and perform one real action on an element by semantic reference — verified end-to-end by an automated test.

This is the Phase-1 interpretation of the Walking Skeleton for a browser-automation product (no web app): project scaffold + persistent browser launch + URL load + one real semantic snapshot + one real semantic action, wired through every layer Juno will ever sit on.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Language/runtime | TypeScript 5.9.x on Node 22 LTS | Single language across browser automation, semantic model, agent, persistence (STACK.md) |
| Repo layout | pnpm workspace monorepo, `packages/*`, first package `@juno/browser` | Future `@juno/safety`, `@juno/compiler`, `@juno/memory` packages slot in without restructuring |
| Browser engine | Playwright 1.62.1 driving system Google Chrome via `channel: 'chrome'`; bundled Chromium supported behind the same launch option | Real-browser posture for BRWS-04; bundled-chromium revision mismatch on this machine makes system Chrome the working default |
| Perception | `page.ariaSnapshot({ mode: 'ai', boxes: true })` (YAML) → `yaml` package parse → zod-validated `PageTree` mirroring the future `ariaSnapshotJSON` node schema | The JSON API does not exist in 1.62.1; one-module YAML parse keeps migration to a one-line swap |
| Element referencing | Two-layer model: ephemeral `eN` refs (`aria-ref=eN` selector, in-session only) + durable semantic refs (`getByRole(role, { name, exact: true })`, strict mode) | Ephemeral refs are fast for immediate action; semantic refs are the only form persisted; strict mode delivers fail-safe grounding |
| Profile/persistence | `chromium.launchPersistentContext` with a dedicated userDataDir (default `~/.juno/profile`, override via `JUNO_PROFILE_DIR` env only) | Full cookie/localStorage/sessionStorage/IndexedDB fidelity; survives restarts; never the daily Chrome User Data dir |
| Safety posture | Headed by default (`headless: false`), no stealth tooling, typed error boundary (`GroundingTimeout`, `AmbiguousReference`, `ProfileInUseError`) | Anti-bot posture without evasion; every action surface is wrappable by the Phase 2 guard |
| Testing | Vitest (unit) + @playwright/test (e2e) against a local deterministic fixture HTTP server | Fast pure-TS unit tests; deterministic browser tests with no third-party site dependency |
| Logging | pino structured logs at every session/read/act step; profile-dir contents never logged | Audit-trail precursor for Phase 2 |

## Stack Touched in Phase 1

- [x] Project scaffold (pnpm workspace, TypeScript, Vitest + @playwright/test configs)
- [x] Browser runtime — persistent-context launch, navigation, profile lock guard
- [x] Perception — one real accessibility-tree read parsed into a typed model
- [x] Action — one real semantic-ref interaction (click) with observable effect
- [x] Dev deployment — documented local run command exercising the full stack (`pnpm --filter @juno/browser exec playwright test`)

## Out of Scope (Deferred to Later Slices)

- Safety guard: destructive-action classification, confirmation gates, audit log, kill switch (Phase 2)
- LLM usage of any kind — Phase 1 is pure deterministic browser layer
- Site-model compilation and per-site memory/persistence beyond the browser profile (Phase 3)
- Multi-step workflows, self-healing replay, authenticated-site handback (Phase 4)
- Teach-by-showing recording (Phase 5); portal fingerprinting (Phase 6); voice (Phase 7)
- Vision/screenshot fallback perception
- Stealth-evasion tooling of any kind (permanently out of scope per REQUIREMENTS.md)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: Safe-execution guard wrapped around the `SemanticActor` action surface (classification, gates, audit log, kill switch)
- Phase 3: Compiler turns explored snapshots into durable versioned typed site models in per-site SQLite memory
- Phase 4: Planner + deterministic executor drives multi-step workflows over compiled operations, with receipts/recovery/auth handback
- Phase 5: Teach-by-showing records demonstrations as compositions of typed operations
- Phase 6: Portal recognition generalizes learned skills across sites sharing a portal
- Phase 7: Voice input maps onto the same execution pipeline
