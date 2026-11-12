# Verification — real tasks and durable memory

Date: 2026-11-12. Runtime: Node 24.22.2, pnpm 11.24.0. This verifies the code/container slice; requested Coolify deployment remains blocked.

Subsequent hosting evidence is recorded in [261112-p1y](../261112-p1y-deploy-verified-juno-workbench-to-coolif/261112-p1y-VERIFICATION.md): the replacement credential works, temporary public HTTPS and Coolify redeploy persistence passed, and the requested hostname still awaits DNS. Statements below describe this earlier verification run.

## Automated checks

- `pnpm build`: passed both workspace type checks.
- `pnpm test`: 52 tests (37 browser-core + 15 lab/workspace) passed after the final task/source changes.
- `pnpm test:e2e`: 19 browser/HTTP integration tests (15 browser-core + 4 lab/workspace) passed. The existing browser-core tests run actual Chrome; lab API tests launch actual semantic Chromium execution. New workspace tests drive HTTP APIs, not the user interface.
- `node --check packages/lab/public/workspace.js` and `git diff --check`: passed.
- No pre-commit hook/config was present.

New cases cover user defaults, versioned/context-matched notes, source identity/schema/filter failures, incomplete search, source request budget, abort ownership, no external instruction execution, idempotency/conflicts, remembered baselines and field differences, note-forget races, interruption recovery, source/body/URL bounds, scrypt account recovery and wrong credentials, owner isolation, note correction/deletion, cross-origin rejection, ungrounded source saves, source-file denial and credential-free exports.

## Live external task and container replacement

Ran the production HTTP server in the built unprivileged Docker image with its existing named `/data` volume. A separate verification client used fresh synthetic workspace credentials (not committed or exported), then:

1. Saved Any-language/100-star preferences and an explicit browser-automation context note.
2. Protected the workspace. Started `search("browser automation")` with omitted overrides. The task recalled preference version 2 and one matching note.
3. Completed one live GitHub search request, validated five metadata records and requested filters. Actual source projects:
   - `vercel-labs/agent-browser`
   - `lightpanda-io/browser`
   - `SeleniumHQ/selenium`
   - `apify/crawlee`
   - `Skyvern-AI/skyvern`
4. Repeated the same request ID: returned the retained task with no repeated execution.
5. Explicitly remembered the first project and the search recipe. Refreshed the saved project through a live exact-repository query. Completed with one checked project, the original saved baseline/task ID and zero field changes in the short interval. A separate unit fixture verifies a 300→340 star change is correctly reported without changing the remembered baseline.
6. Compiled the owned fixture in actual Chromium and replayed `capture_interaction` with synthetic inputs. Verified all five postconditions and five semantic browser actions; saved API feedback.
7. Exported the workspace and checked no account hash/passphrase was present.
8. Force-replaced the container (`docker compose up -d --no-build --force-recreate --wait`) and confirmed the container ID changed, the health check passed and exported memory/tasks/receipts/feedback were identical.
9. Cleared the verification client's cookie and logged into the protected workspace. The same note, preference, project baseline, recipe and task history returned. Request-ID replays for both the research and browser fixture still returned existing receipts. An unrelated anonymous cookie context had zero tasks/notes.

The final complete run passed. `/healthz` returns `{"status":"ok","mode":"research-and-owned-fixture"}`. The application root serves the updated Tasks & memory screen. The existing session preview forwards that same healthy container; its authentication is Devin's preview gate, not permanent public hosting.

## Claim limits and unverified gates

- The live run observed unchanged project metadata; do not claim it discovered new releases or a substantive external change.
- Cross-device recovery was validated with separate HTTP cookie contexts, not two physical devices or a UI walkthrough.
- Metadata verification checks schema, identity, origin and requested filters. It does not read project source code or assess software quality/security/fitness.
- No general chat, LLM planning, private GitHub account, arbitrary web action, scheduled monitoring, external write, Notion memory sync or SQLite site compiler is implemented by this slice.
- HOST-02 is blocked by rejected Coolify credentials and parking DNS. No changes were made to DNS/Coolify, and no public deployment or hosted storage continuity is claimed.
- UI-driven usability/recording and Jack's trial are pending. The old feedback UI confirmation bug remains pending approval; feedback itself passes the API/container persistence check.
