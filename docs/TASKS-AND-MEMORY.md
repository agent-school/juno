# Real task workbench and durable memory

Juno's first external task is public open-source project research. Enter a topic such as `browser automation` or `local memory`, optionally override language/minimum stars, and run it. The server searches GitHub's public API, checks up to five project identities and current metadata against your requested structured filters, and saves a receipt. Descriptions are author-provided data; stars, activity and license fields are observations, not endorsements or license/legal advice. Results are ordered by stars, not an overall quality ranking. This does not read source code or prove that a library fits your requirements.

The second operation refreshes up to five explicitly remembered projects and compares their new metadata with the saved baseline. **Refresh does not overwrite memory.** Review the changes, then choose **Update remembered baseline** for the observations you want to retain. This is on-demand refresh, not scheduled monitoring.

No external account or model key is needed. These are two deterministic API operations, not open-ended chat, autonomous browsing or Muse parity. The separate **Browser lab** still uses the real semantic browser core on an owned synthetic fixture. API task evidence does not validate a semantic browser model of GitHub, Rolo, Canvas or arbitrary sites. Phase 01.1 and Phase 2 remain pending.

## Memory and provenance

| Layer | Stored evidence | How it affects later work |
|---|---|---|
| Runtime | Current task steps, stop signal, verified partial results | Activity persists before and during source checks; work continues after the starting HTTP request returns |
| Episodes | Original request, resolved filters, recalled preference version/note revisions/baselines, source requests, results, errors, timing | Inspect/download every attempt; interrupted tasks never claim completion or silently restart |
| Source knowledge | User-approved project snapshots with canonical GitHub URLs and actual API request URLs, observation/save times, originating task ID, `github-api` origin and `source-checked` confidence | Refresh compares fields to the remembered snapshot; seven-day-old snapshots are visibly stale |
| User context | Versioned language/star preferences and editable notes marked `user`/`user-provided` | Structured preferences become default filters; up to four notes matching query words appear for review as context |
| Reusable operation | User-approved named search with fixed resolved filters | Replay reads fresh sources with those exact settings; it does not silently change when defaults change |

Only explicit save controls create long-term notes, source snapshots and search recipes. Task receipts persist automatically as execution evidence. User-provided notes are not interpreted into commands or filters; the UI states this boundary. Web descriptions never become instructions, code, notes or learned site models. Canonical source links are constructed from validated repository identities rather than returned URLs.

Notes can be corrected; the last five previous revisions remain inspectable. Forgetting a note deletes its history and also scrubs its text from recalled task context, including a task with a source request in flight. Forgetting a project removes its future watchlist baseline, including recalled baseline copies, but public source observations can remain in receipts. Task inputs and results remain until you choose **Forget task receipt**. Explicitly saved memories survive deletion of their originating receipt; their source URL and observation time remain. UUID-only tombstones prevent accidentally resubmitting a forgotten request.

**Export workspace** downloads task evidence and memory along with the existing lab data. It never includes account credentials. Exports can contain your private notes: keep them private. Export is a download, not an automatic backup or an import/sync integration. No Notion or second-brain content is copied into Juno automatically.

## Continuing on another device

An anonymous workspace is associated with a random 256-bit HttpOnly SameSite cookie. To reopen it elsewhere, expand **Protect this workspace or open an existing one**, choose a unique 3–32 character workspace name and a passphrase of at least 12 characters, then select **Protect this workspace**. On the other device use **Open existing** with those credentials. Your existing notes and task receipts stay in that workspace. Opening a different workspace never merges data; account changes reload the page and clear local pending task inputs.

The server stores salted scrypt password hashes in `/data/accounts`, separate from the workspace JSON and exports. Passphrases are not sent to research sources or put in browser storage. Account attempts are globally limited, and wrong/unknown credentials use the same failure message. HTTPS is required for a remote deployment; the reverse proxy must set `X-Forwarded-Proto: https` so the cookie is Secure. The app also rejects cross-site mutations and framing by other origins.

This is a small single-server workspace system, not enterprise identity infrastructure. There is no password reset, MFA, token/session management, at-rest encryption, owner administration or multi-replica support. Keep a recovery copy of the passphrase; clearing cookies without a protected workspace loses access. Sign-out switches the current browser to a fresh anonymous workspace; it does not revoke other devices. Losing the server's volume loses accounts and memory.

## Storage, limits and recovery

The slice extends the existing bounded atomic JSON store, using an additive migration that preserves older lab records. It does not introduce an independent memory database or native build dependency. This is deliberately limited to one server/replica. The doctrine's SQLite/FTS per-site store remains the path for full learned website models, structured cross-site knowledge and larger-scale retrieval. No vector database is justified by these exact filters and small note lists.

All state and account files live under `JUNO_LAB_DATA_DIR`, `/data` in the image. A persistent volume and backup are required. Process/container replacement with that volume preserves memory, account hashes and receipts. An interrupted research task becomes `interrupted`; retained source checks may be incomplete. It requires a new explicit request to refresh. A browser fixture write retains its separate `uncertain` recovery behavior.

Bounds: 500 workspaces, 100 protected workspaces, 100 retained tasks/workspace, 1,000 retired task IDs, 50 notes (2,000 characters, five old revisions), five remembered projects, 20 search recipes, 8 KB request bodies, 40 mutations/minute/workspace, 20 account attempts/minute globally, nine source requests/minute globally, one research task at a time, and six task starts/minute globally. Each research task has a 55-second deadline, each fixed-origin GET an eight-second timeout and a 512 KB response cap. GitHub also imposes its own unauthenticated limits, independent of these caps; rate-limit failures are saved explicitly without invented results, automatic retries, alternate identities or hidden fallback sources.

Only `https://api.github.com` receives source requests. Redirects are rejected, and returned project identities and metadata are schema checked before requested filters are verified. Search uses the metadata in its single authoritative API response; refresh uses exact-repository search queries, including archived projects. The server spends at most nine source requests per minute, below GitHub’s normal anonymous search quota. Partial search, unavailable source, stale filter mismatch, schema mismatch, cancellation and timeout are visible in receipts. No public task endpoint accepts an arbitrary URL, browser/CDP operation, executable recipe or external write. These boundaries do not replace the full future execution guard for authenticated sites.

## Try it

1. In **Memory**, save TypeScript and 100 stars as preferences. Save a note about browser automation and accessible semantics.
2. In **Research**, research `browser automation` using saved defaults. Inspect the resolved filters, recalled note, source links and receipt. Recent research stays in the navigation; Working memory shows your shortlist and **Check for changes**. A source failure should be visible rather than shown as success.
3. Remember a project and the search recipe. Reload and inspect **Memory**; both survive.
4. Protect the workspace and open it in a second browser. Check that memory and preferences return. A separate anonymous browser starts empty.
5. Refresh remembered projects. Inspect the old baseline, new observation time and field changes. Update a baseline explicitly if desired.
6. Correct a note, inspect its revision, then forget it. Export your workspace and check that the forgotten note text is gone. Forget task receipts separately if their inputs contain material you want removed.
7. Restart/replace the container with the same volume; reopen the protected workspace and verify that preferences, remembered projects, recipes and history remain.

Unit tests use controlled GitHub responses to verify changes, source failures, idempotency, context deletion races and interruption. HTTP integration tests check workspace recovery/isolation, cross-site rejection, memory correction/deletion and credential-free export without relying on public network availability. Live public API/container checks are recorded separately in the GSD verification artifact. UI-driven usability validation is separate and pending user approval.
