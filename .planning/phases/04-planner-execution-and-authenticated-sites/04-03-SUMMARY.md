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
- Container, production deployment/persistence and recorded interface verification: pending at this checkpoint; append measured results before completion.

## Limits

The stored OpenAI key returned HTTP 401; the current deployment has no configured model. General goal reasoning/navigation/comparison/extraction is implemented and exercised with a controlled interpreter; successful live provider-backed planning/answers must not be claimed. Evidence collection is usable independently. Public search is a bounded browser navigation and may encounter challenges; there is no bypass mechanism.

Accounts, real external writes, automatic executable operation discovery, arbitrary semantic repair, teach-by-showing, arbitrary desktop control and Muse parity remain open. No merge is implied.
