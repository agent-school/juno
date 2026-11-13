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

Verified at 2026-11-13T00:58:31Z on **https://juno.agentschool.io**. Coolify application `8jfncbyniz9knwex2dgx0yjo` is pinned to implementation `0667ab34344ebce66465f46f33275f1c9d601317`; deployment `udmfhqrwlnjtwlsnb5yhbu1q` finished. The existing named `/data` volume, one process and consistent container names were retained. Later documentation commits do not change the deployed UI assets.

The certificate-verifying HTTP/API harness seeded a separate workspace on the old implementation, exported its evidence, upgraded to the new commit, then compared its retained data and exercised fresh operations. All **25 assertions passed**; [structured deployment evidence](261113-0u5-DEPLOYMENT.json).

| Hosted check | Evidence |
|---|---|
| Existing preferences, notes, project baseline and search recipe retained | Export fields identical before/after upgrade |
| Existing research receipts, semantic model, browser receipt and saved effects retained | Export fields identical before/after upgrade |
| Protected-workspace recovery and anonymous isolation | Fresh cookie context empty; passphrase restores the original saved notes |
| Request-ID replay after upgrade | Existing task retains its start time; existing browser request returns its receipt with one saved interaction |
| Live research and shortlist refresh | Five validated GitHub projects; remembered project refreshed against its retained baseline |
| Deployed HTML, four app scripts/styles, fixture stylesheet and two fonts | All eight asset bodies match SHA-256 of the checked local implementation; fonts return `font/woff2` and WOFF2 bytes |
| Requested-domain TLS and public health | Certificate-verified HTTPS `/healthz` 200 before/after upgrade |

Research receipt: `9e1080b6-38a6-4929-bac5-e745e1194cb3`; refresh: `e34f3ca9-63a6-434c-aad1-b33bcddf457c`; verified browser receipt: `f0cf4165-7ada-43e4-b1dc-4c76925d7cd4`. Source records: `apify/crawlee`, `nanobrowser/nanobrowser`, `hangwin/mcp-chrome`, `Tencent/BrowserSkill`, `webdriverio/webdriverio`.

The first deployment attempt (`xs4o1rw1ye22dcduqixjiu6u`) failed because the full commit SHA was mistyped. It failed before container replacement; public health remained available. The successful retry resolved `HEAD` directly from Git. This is a recovered deployment error, not a product test failure.

## Limits

- The old feedback-confirmation handler remains unchanged, pending Jack's approval of that existing Codex finding. Feedback persists server-side.
- Coolify's cached `exited:unhealthy` status disagrees with public health checks; host Docker health is not independently inspected.
- The public task remains bounded, read-only GitHub API research. General site compilation, Muse parity, full safety guard and real Rolo/Canvas integrations remain unimplemented.
