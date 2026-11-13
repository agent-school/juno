# Juno experiment lab

The application now opens on **Tasks**, a real public-project research and memory workbench. See [Tasks and memory](TASKS-AND-MEMORY.md) for its walkthrough and boundaries. Select **Browser lab** to run the controlled semantic browser experiment below; **Lab receipts** contains its evidence.

The lab runs a real headless Chromium instance for each compile/replay. It reads with `SemanticPageReader`, binds exact observed roles/names, executes with `SemanticActor`, re-observes the page and verifies the resulting fixture records independently. A fresh browser is launched for each operation; saved semantic bindings survive outside it.

This is a narrow compiler template for an owned fixture with known field meanings. It is not automatic site discovery, an AI planner, teach-by-showing, or the real Rolo integration. No LLM is involved. Measured times include browser startup; zero model calls/cost is a fact about this path, not a measured advantage over a baseline.

## Run locally

Use Node 24, `pnpm install --frozen-lockfile`, then `pnpm --filter @juno/browser exec playwright install chrome` and `pnpm lab`. The default port is 5123. `PORT` changes it; `HOST` defaults to `0.0.0.0`. `JUNO_LAB_DATA_DIR` defaults to `.juno-lab` relative to the working directory. Set an absolute path for hosting. `JUNO_LAB_CHANNEL=chromium` selects Playwright's bundled Chromium instead of system Chrome.

## Acceptance walkthrough

1. Click **Observe & compile**, inspect the saved operation and run with synthetic Alice inputs. Expect **verified**, five browser actions and five passing postconditions.
2. Change the person/note and run again. The saved model version stays the same and a new browser executes the parameterized inputs.
3. Select **Reordered fields**, run without recompiling. Expect verified with the same model version.
4. Select **Renamed submit button**, run the old model. Expect precondition failure and zero actions. Explicitly compile again and run. Expect verified with a new model version.
5. Select **Duplicate submit buttons**. Compile should reject ambiguity. No positional selector or guessed target is permitted.
6. Select **Write silently has no effect**, compile, then run. Expect a verification failure even though all five actions completed. No record should be added.
7. Open **Lab receipts**, inspect/download a receipt, save feedback, then export all evidence. Reload the browser: history and feedback remain. Known pending UI issue: feedback persists, but its confirmation can fail; avoid resubmitting it blindly. The fix awaits Jack's approval under the org bot-response setting.
8. Restart the server/container with the same data volume and browser cookie. Bindings, records and evidence remain. A run interrupted by a restart becomes **uncertain**, never silently retried.

The synthetic website form also works by hand. Manual form saves are fixture state, not Juno receipts. The user-visible form and automated browser use the same owner-scoped store.

## Hosting

Use a long-running Linux container with Chromium support and persistent disk. A Vercel/Netlify serverless function is not suitable for this browser process and local durable store. One replica only; this lab is not multi-process or production account infrastructure.

```bash
docker compose up --build -d
# Loopback http://localhost:5123; place a TLS reverse proxy in front for remote access.
docker compose logs -f juno
docker compose stop
# Keep the named juno-data volume to preserve evidence.
```

On Coolify:

1. Create an application from `agent-school/juno`, selecting the branch containing the lab until the PR is merged.
2. Select **Dockerfile** build pack, repository root, Dockerfile `/Dockerfile`, port `5123`.
3. Add persistent storage mounted at `/data`, writable by container UID 1000. This is required: without it a replacement container loses evidence.
4. Set the requested domain **`https://juno.agentschool.io`**. In Porkbun DNS, add **A · `juno` · `54.157.57.51`**, replacing any conflicting record specifically named `juno`. Preserve wildcard records, nameservers and unrelated records. Wait for this hostname to resolve to the server; enable Coolify's proxy/TLS and deploy. Start with 2 GB RAM and one replica. Use the Dockerfile's Node-based `/healthz` health check: disable Coolify's additional curl-based check. The Dockerfile selects bundled Chromium automatically. Enable consistent container names so redeploy stops the old writer before starting its replacement; use `--shm-size=256m --init` as custom Docker options.
5. Test both walkthroughs, replace the container and check that history, protected workspace login and remembered source baselines remain. Download evidence before upgrades/backups. Do not mount personal Chrome profiles. The research task needs no GitHub or model token; add no third-party secrets for this slice.

The workbench is deployed on Coolify at **https://juno.agentschool.io**, with a valid public certificate and named `/data` volume. Live source research, remembered baselines, workspace recovery and semantic Chromium execution passed HTTP checks, and retained data survived a Coolify container replacement. The application is pinned to a verified implementation commit on the PR branch; automatic deployment and preview deployments are disabled. [Deployment configuration and evidence](../.planning/quick/261112-p1y-deploy-verified-juno-workbench-to-coolif/261112-p1y-VERIFICATION.md).

On 2026-11-13, **`juno.agentschool.io`** resolved directly to `54.157.57.51` and its certificate-verified HTTPS health check returned 200. The temporary **https://juno.54.157.57.51.sslip.io** hostname remains an alternative. Protect a workspace with a passphrase before moving between hostnames: cookies do not transfer, but both Coolify hostnames use the same stored accounts. The earlier Devin preview uses separate storage.

The research desk redesign is pinned to `0667ab34344ebce66465f46f33275f1c9d601317`. Upgrade checks preserved existing task/memory, account recovery, semantic bindings, browser receipts and fixture effects; all eight deployed UI/font assets matched the checked implementation. [Redesign and upgrade verification](../.planning/quick/261113-0u5-rethink-juno-interface-using-impeccable-/261113-0u5-VERIFICATION.md).

Monitoring caveat: Coolify's API still reports `exited:unhealthy` despite successful deployments, application logs and public HTTPS/API checks. Its detected Dockerfile health check and named volume are confirmed, but actual host-level Docker health has not been independently inspected. Do not treat that cached field as proof of either health or outage; reconcile it separately. UI usability and Jack's trial remain pending.

## Boundaries

- Only a synthetic fixture is navigable by the browser executor. No URL entry, CDP endpoint, external account or arbitrary browser command is exposed. Outbound browser requests are restricted to this process's origin. The separate real-task service permits bounded read-only calls to GitHub's API.
- Owners have a random 256-bit HttpOnly SameSite cookie. Optional passphrase-protected workspace recovery restores the same owner on another device; credentials never join the evidence export. See the task documentation for limitations and retention behavior.
- Same-origin mutations require a custom header and reject cross-site fetch metadata. There is no CORS permission.
- One browser job runs globally, with bounded launch/navigation/action execution. A stop request closes the requesting owner's browser; it is a lab control, not proof of the complete Phase 2 guard.
- A request ID is persisted before execution. Repeating it returns its receipt without re-execution; reusing it for other inputs is rejected. Uncertain writes are not automatically retried. A new request ID means a new intended interaction.
- Hard caps: 500 owners; 100 runs, interactions and feedback notes per owner; 8 KB request bodies; 40 mutations/minute/owner. These keep this synthetic experiment bounded, not hardened against a determined public attacker.
- Models, fixture records, observations and feedback contain entered synthetic content. Server files are owner-readable and atomically replaced. Back up the volume; never commit it. A corrupted store fails instead of silently discarding evidence.
- Never equate successful clicking with success. The independent verifier checks one matching request, person, note, date and next-action values in fixture application state. Real Rolo verification must query its actual application state through a trusted adapter.

## Validation commands

`pnpm build`, `pnpm test`, `pnpm test:e2e`. Browser-backed lab tests drive the HTTP API, which launches real Chromium and the production reader/actor. They cover parameterization, model reuse, UI reordering, fail-closed label drift/ambiguity, explicit recompile, silent no-effect writes, duplicate suppression, evidence export, owner isolation and request boundaries. Unit tests additionally cover invalid dates, duplicate/wrong effects, persisted feedback/models and interrupted-write restart semantics.

UI usability, real-account flows, Windows/CDP and baseline comparisons require their own recorded evidence. They are not implied by these automated checks.
