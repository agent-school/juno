# Verification — Coolify hosting

Verified 2026-11-12T18:10:17Z using HTTPS HTTP/API clients, with certificate verification enabled. These are hosted functional checks, not a UI usability recording.

## Deployment configuration

| Setting | Observed configuration |
|---|---|
| Coolify | `https://coolify.agentschool.io`, version 4.7.5 |
| Project / environment | Juno / production |
| Project UUID | `e3npddnpnkfzbmhhjpi3wlam` |
| Application UUID | `8jfncbyniz9knwex2dgx0yjo` |
| Server / destination | Existing localhost server / coolify Docker network |
| Source | Public `agent-school/juno`, branch `devin/1794501600-juno-hosted-lab` |
| Pinned implementation | `ffb652068a7af50690ae66ceda3e778b99c73f63` |
| Build | Repository-root Dockerfile, `/Dockerfile` |
| Container port | 5123; no direct public port mapping |
| Persistent volume | `8jfncbyniz9knwex2dgx0yjo-juno-workbench-data` mounted at `/data` |
| Storage UUID | `n7jcqnqnztvnavsqqw9oyv0i` |
| Resources | 2 GB memory / 1.5 CPU / `--shm-size=256m --init` |
| Single writer | Consistent container name enabled; old container stopped before replacement |
| Health | Image's Node-based `/healthz` check detected; extra Coolify curl check disabled |
| Deployment triggers | Automatic and preview deployment disabled |
| Usable hostname | `https://juno.54.157.57.51.sslip.io` |
| Requested hostname | `https://juno.agentschool.io` configured, DNS pending |

The initial Coolify build completed (`wyutdbznmn6zopnnq3sy7inq`). The final verification replacement also completed (`ljtfvgf5zux3uya0m7qborbn`). Public `/healthz` and the application root return HTTP 200 with valid HTTPS.

## Live task and persistence evidence

1. Created an isolated synthetic workspace, saved TypeScript/100-star preferences and an explicit browser-automation note, then protected it with a generated passphrase. The passphrase was not committed or exported.
2. Started a live `browser automation` search with omitted filters. The task applied stored defaults, recalled the note, completed successfully and retained API source URLs. All returned projects matched language and minimum-star filters:
   - `apify/crawlee`
   - `nanobrowser/nanobrowser`
   - `hangwin/mcp-chrome`
   - `Tencent/BrowserSkill`
   - `webdriverio/webdriverio`
3. Remembered the first project and a reusable recipe. Refreshed the project against its saved baseline, with a completed live source observation.
4. Compiled the owned fixture using deployed Chromium and replayed synthetic Alice inputs through the semantic reader/actor. Its receipt was `verified`, with five passing effect assertions.
5. Verified a fresh anonymous cookie context was empty, then restored the protected workspace in that separate context. Export excluded the passphrase and account hash/salt fields.
6. Requested a real Coolify redeployment. After replacement, notes, projects, recipes, preferences, full task receipts, semantic model, browser receipts and saved fixture effects were identical to the pre-replacement export.
7. Logged into the protected workspace from another fresh cookie context after replacement. Memory and account recovery persisted.
8. Replayed both original request IDs. The research task returned its original completion time; the browser write returned its original receipt and still had exactly one saved interaction.
9. Confirmed Coolify still configured the named `/data` volume and detected the image health check; public `/healthz` remained HTTP 200.

Trace IDs: search `16353179-490b-4ed8-89d8-5da31c4cbb94`; refresh `59ed1536-b75f-479d-818e-2980cd1d52ba`; browser receipt `c37af760-ad80-47bd-bb33-2919e4a8b7d0`. Synthetic test workspaces are isolated from users.

## Limits and outstanding evidence

- Coolify's API reports the cached application status `exited:unhealthy` although its container is present, application logs show a listening server, deployments finish, and public HTTPS/API checks pass before and after replacement. An initial verification assertion requiring `running:healthy` therefore failed. It was replaced with separate checks of the configured image health check, named volume and actual HTTP availability, preserving this discrepancy explicitly. Docker health has not been independently inspected on the host; no claim that the Coolify badge is correct is made.
- DNS still returns the Porkbun parking CNAME for `juno.agentschool.io`, resolving to `207.207.210.107` / `207.207.210.229`. Coolify's DNS zone list is empty. Add A `juno` → `54.157.57.51`, replacing a conflicting record specifically named `juno` while preserving wildcard/unrelated records. Requested-domain TLS remains unverified.
- Temporary-host cookies do not transfer to another hostname. Protected workspace recovery can restore the same Coolify data after DNS is connected. The earlier Devin preview uses separate storage; no migration/import feature is claimed.
- This verifies read-only GitHub API tasks and the owned synthetic fixture. It does not establish a semantic model of external GitHub UI, Muse parity, real Rolo/Canvas support, browser UI usability or physical-device recovery.
- No other application, DNS record, global proxy or server monitoring setting was changed. No merge was performed.
