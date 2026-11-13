# Verification — Juno research desk

Date: 2026-11-13. Node 24.22.2, pnpm 11.24.0. This task changes the workbench interface and static font serving, preserving task, memory, account and Browser lab APIs.

## Local evidence

| Check | Result |
|---|---|
| `node --check` for both frontend scripts | Passed |
| `pnpm build` (workspace typecheck) | Passed |
| `pnpm test` | 52 passed: 37 browser-core, 15 lab/workspace |
| `pnpm test:e2e` | 19 passed: 15 browser-core, 4 lab/workspace HTTP integration |
| Local font HTTP response | 200, `font/woff2`, local Public Sans/Sora with OFL licenses |
| Static rendered review | Research, Memory, Browser lab, Lab receipts and Roadmap at 1440, 390 and 320px; no page overflow or load-time JavaScript errors |
| Source-result rendering | Actual GitHub API search for `browser automation`, TypeScript, 100+ stars: five records; explicit API saves supplied a project, note and recipe for populated-state visual review |
| Requested-domain HTTPS | A `54.157.57.51`; certificate-verified `/healthz` and root return 200 |

Static review covers rendered hierarchy, text, source rows, responsive layout, fonts and empty/populated collections. It does not establish UI submission, filter, keyboard, account-recovery or polling-edit usability. Those flows and Jack's trial remain pending approval/testing. Existing shell integration checks exercise the backend contracts independently.

## Deployment

Redesign deployment and upgrade-persistence checks pending. The existing Coolify app remains on the previously verified implementation until this task's code is committed and pinned. Keep the named `/data` storage, one process and consistent container names.

## Limits

- The old feedback-confirmation handler remains unchanged, pending Jack's approval of that existing Codex finding. Feedback persists server-side.
- Coolify's cached `exited:unhealthy` status disagrees with public health checks; host Docker health is not independently inspected.
- The public task remains bounded, read-only GitHub API research. General site compilation, Muse parity, full safety guard and real Rolo/Canvas integrations remain unimplemented.
