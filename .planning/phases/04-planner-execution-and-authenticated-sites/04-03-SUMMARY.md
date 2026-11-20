# 04-03 — General public-web tasks

## Outcome

Replaced the contact-specific Agent screen with a goal-first composer and a general public-web worker. Contact/follow-up execution and its 19-condition benchmark remain available under Engine tests. The public task representation has no contact fields or site-specific task templates.

The bounded loop supports search, direct public navigation, observed-link following, reading additional source windows, comparison/extraction decisions, exact-source citations and explicit refusal. It uses the semantic reader and versioned site compiler/store. A selected prior task supplies historical context for follow-ups; source facts require new observations. Evidence-only mode works without a model and makes no goal-completion claim.

The backend exposes workspace-isolated durable task review/run/stop/history/receipts/screenshots, restart inspection, per-domain knowledge and explicit forgetting. It shares the browser slot with both existing labs. Review is inert; a finished/interrupted request cannot silently run again. A fresh reviewed task is required.

## Safety boundary

All browser HTTP requests cross public-only, DNS-pinned Node transport with method/resource/byte/deadline budgets. Every DNS answer must be public, including mapped IPv6. Credentials, custom ports, known action URLs and private/reserved/metadata addresses are rejected. Redirect headers are never forwarded to Chromium: host code follows checked navigation redirects with a bounded loop. Subresource redirects are blocked. The browser uses a non-working proxy, disabled non-proxied UDP/QUIC, blocked WebSockets and service workers, and a fresh account-free context. No arbitrary code, selectors, credentials, write grants or host test origins are accepted from API/model JSON.

The model cannot mint evidence: cited quotes must appear in captured source text, and extracted values must appear in their quote. This establishes captured provenance, not semantic truth or full task completeness. OS/firewall enforcement remains an independent open gate.

## Verification so far

- Typecheck and 157 unit tests pass, including public/private address variants, mixed DNS results, canonical URLs, authority rejection, quote/value grounding, provider bounds, owner isolation, restart state, stop/cleanup, browser-slot exclusion and host-only credentials.
- Repository browser/API suite passes 35 tests, including the unchanged 19-condition execution matrix and new synthetic cross-origin goal-loop and hosted API checks.
- Synthetic loop navigates a product site and unrelated admissions site, follows pricing links, produces source-grounded comparison/extraction, persists multi-route knowledge, refuses invented quotes/raw actions and cancels a hung interpreter. Browser scripts cannot POST, cross into another private fixture or follow a metadata redirect.
- A real Chrome run read https://playwright.dev/, https://pptr.dev/ and https://docs.python.org/3/library/venv.html, capturing 2,946 / 2,446 / 18,937 characters respectively and saving knowledge for all three origins. This exercised source collection, not live language interpretation.
- Both public-worker browser tests pass in Docker Chromium. Replacing the local container retained two source pages, exact receipt, website knowledge, screenshot and personal note; finished-task replay was refused.
- Coolify deployed 5a6da72, then f7d48d8 in job `j4sfhoivwmame0ibkyiq41gk`. A real replacement retained the same source evidence, receipt, knowledge, screenshot and personal note. HTTPS, implementation SHA, six static asset hashes and persistent-volume identity matched. Referenced-parent deletion and implicit replay returned 409.
- Final frontend correction 53386ed is deployed in job `pimudrto0ejivojcsoosdiwg`; HTTPS, all six asset hashes and persistent-volume identity passed again. Coolify still caches `exited:unhealthy` despite these live checks.
- Recorded hosted Chromium UI testing on 53386ed passed goal-first composition, inert review, real Playwright/Puppeteer and unrelated Python source collection, exact selected-parent reload recovery, blank-composer reload, follow-up dependencies, source/receipt inspection, knowledge forgetting with retained task evidence, URL rejection, separate Engine tests, Research/Memory regression and 390px keyboard interaction. Real-poll measurements preserved draft/focus/caret/disclosures. [Primary annotated recording](https://app.devin.ai/sessions/d0f8409f16a04d4eb9746c4504fc750c?testRecording=ba0a6a52-598c-4f58-82ea-4406cb3d4292).

## Corrections verified

Review reproduced fragment-bearing chained redirects and dangling ready follow-up dependencies. f7d48d8 canonicalizes redirect keys/source URLs and returns a named 409 dependency conflict before parent deletion. Browser, unit and hosted API regressions pass. Initial hosted UI testing then found that reloading an older selected task opened the newest task. 53386ed preserves task/composer selection per tab, validates IDs against the current workspace and passes the exact hosted reproduction. The interrupted f7d48d8 recording is superseded by the corrected run.

## Limits

The stored OpenAI key returned HTTP 401; the current deployment has no configured model. General goal reasoning/navigation/comparison/extraction is implemented and exercised with a controlled interpreter; successful live provider-backed planning/answers must not be claimed. Evidence collection is usable independently. Public search is a bounded browser navigation and may encounter challenges; there is no bypass mechanism.

UI cancellation was not exercised: the task completed before the Stop click. Cancellation is covered by synthetic runtime/service/API tests. Live provider planning, generated answer/table UI, physical mobile and Windows UI remain untested in the recorded run. Accounts, real external writes, automatic executable operation discovery, arbitrary semantic repair, teach-by-showing, arbitrary desktop control and Muse parity remain open. No merge was performed. No blueprint changes were needed.
