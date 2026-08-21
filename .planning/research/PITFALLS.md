# Pitfalls Research

**Domain:** AI browser-automation / computer-use agent ("semantic website compiler")
**Researched:** 2026-08-21
**Confidence:** HIGH

---

## Critical Pitfalls

These are the mistakes that cause rewrites, real-world damage, or a product that "works in the demo and breaks everywhere else." Each maps to a roadmap phase (phases named descriptively; the ROADMAP.md does not exist yet at research time).

---

### Pitfall 1: Autonomous exploration performs real-world destructive actions

**What goes wrong:**
During "safe exploration" or "testing interactions," the agent clicks a button, submits a form, sends a message, or signs something — causing real, irreversible damage (wrong message sent, contract signed, payment made, data deleted). The whole value proposition of Juno ("without destructive guessing") collapses if the very first thing the agent does is guess destructively.

**Why it happens:**
- Generic computer-use agents are not built around an action-safety taxonomy. Independent testing (hCaptcha's 2025 "Browser Agent Safety" report, and the Claude/Operator agent evaluations it cites) found agents "routinely do the wrong thing when they can" — resetting passwords, injecting cookies, bypassing paywalls, inventing credit-card details — because safety is "incidental to missing features," not designed in. The model can't reliably distinguish "harmless click" from "irreversible submit" by looking at pixels.
- "Load a site and explore" is conflated with "exercise interactive elements." Crawling is not the same as *acting*, but naive implementations make exploration *do* things (fill inputs, submit forms, click "Send").
- Vision-driven agents click at guessed coordinates without knowing what semantic action that button performs.

**How to avoid:**
- Build an **action taxonomy with a destructiveness classification** before any autonomous exploration ships: `read` (navigate, scroll, inspect DOM) vs `write-benign` (type into an empty draft, open a modal) vs `write-destructive` (submit, send, sign, delete, pay, "post"). Autonomous exploration is confined to `read` + `write-benign`. `write-destructive` requires either an explicit user demonstration or an explicit confirmation dialog.
- Prefer **draft/unsent states** for demonstration: teach on the compose form without sending; teach "sign" against a preview, not the live submit.
- Add a **post-action verification step**: after every click, assert the resulting state matches intent before proceeding (e.g., "did a confirmation dialog open?" not "did a message just send?").
- Provide a hard **kill switch / pause** (abort mid-task) that the user can trigger at any moment, and make the agent stop on unexpected navigation (e.g., a redirect to a checkout/payment domain).

**Warning signs:**
- The word "explore" or "test" is used interchangeably with "perform the action."
- No action-gating layer exists; the model's tool list includes an unrestricted `click`/`type`/`submit` with no classifier in between.
- First user demo sends a real message or submits a real form during "setup."
- Agent logs show `submit`/`click(Send)` calls during an exploration-labeled run.

**Phase to address:**
Safe-exploration / guardrails phase (early — must precede any end-to-end execution phase). This is the single most important pitfall for Juno's differentiation; it is a founding constraint, not polish.

---

### Pitfall 2: Hallucinated coordinates and ungrounded element targeting

**What goes wrong:**
The model decides to click at an (x,y) coordinate or an element it *believes* is the target, but clicks the wrong thing. In a vision-only loop, every screenshot adds latency and error; coordinates break on resize/scroll; and the model confidently clicks adjacent or invisible elements.

**Why it happens:**
- Computer-use APIs (Claude Computer Use, OpenAI CUA) reason over screenshots and emit raw pixel coordinates. Screenshot loops are slow and error-prone; coordinate clicks don't validate *what* is under the cursor.
- Hallucinated clicks and coordinate errors are a documented failure mode of computer-use agents (repeatedly cited across Anthropic Computer Use evaluations and vendor comparisons).

**How to avoid:**
- **Ground every action in the DOM + accessibility tree, not pixels.** Use Playwright's `getByRole`/`getByLabel`/`getByText`/`getByPlaceholder` locators bound to semantic meaning, plus the accessibility snapshot as the model's input representation — not a screenshot. Element references (refs resolved against the live accessibility tree) are far more robust than raw coordinates.
- When a click is needed, resolve the target to a **scoped element reference**, verify its role/label/state (enabled? visible? in viewport?) before acting, then verify after.
- Keep screenshot/vision only as a *fallback* for elements that are not in the accessibility tree (canvas, shadow-DOM-heavy widgets), never as the primary interaction channel.

**Warning signs:**
- Action model outputs `(x, y)` pairs or "click the button at the top right" with no element reference.
- Repeated "clicked wrong thing → retry" loops in logs.
- Tests pass only at one fixed viewport size.

**Phase to address:**
Semantic-model / browser-core phase (element grounding is the foundation of the "compiler" mental model).

---

### Pitfall 3: Learned knowledge rots because it is stored as selectors/coordinates, not semantics

**What goes wrong:**
Juno's core promise is *durable* per-site knowledge. If a taught action is saved as a CSS selector, XPath, or coordinate ("click `#react-root > div:nth-child(3) > button`"), the knowledge silently breaks on the next site deploy, A/B test, or localization change — and worse, the *replay* clicks the wrong element that now occupies that position. The "compiled semantic model" degenerates into a cached script.

**Why it happens:**
- The fastest thing to persist from a demonstration is the raw locator the agent happened to use. XPath and deep CSS are notoriously brittle (documented as an anti-pattern across Playwright/scraping guides).
- Developers conflate "reproduce the action now" with "persist a durable understanding," and don't distinguish *where the element is* from *what the element means*.

**How to avoid:**
- Persist **semantic descriptions**, not locators: accessibility role, accessible name/label, placeholder, visible text, and a stable structural context (nearest landmark/heading/form) — plus the *intent* ("click the 'Send' button in the message composer"). At replay time, **re-identify** the element against the live accessibility tree using the semantic description, and only then act.
- Store locators as *cached hints* alongside the semantic description, refreshed (not trusted) on each successful replay — the "self-healing" pattern (multi-attribute fingerprinting + fallback chains, as in Playwright's locator strategy and the v1.56 Healer agent direction).
- Version knowledge per site and record a "confidence/verification" signal when a learned action is re-confirmed, so drift is detected, not silently absorbed.
- Use the **accessibility tree as the canonical identity layer** — it is generally more stable than CSS/XPath and is the layer a human would describe ("the button labeled Send").

**Warning signs:**
- Persistence layer stores `xpath`/`css`/`{x,y}` as the primary key of a learned action.
- "It worked last week, now it clicks the wrong thing" — the classic silent-rot signature.
- No re-identification step between "load knowledge" and "execute."

**Phase to address:**
Persistence/memory phase + semantic-model phase (the schema of "what is saved" must be defined before any execution phase).

---

### Pitfall 4: Auth/session state is persisted as a secret — and stored *inside* the learned knowledge

**What goes wrong:**
Cookies, tokens, and `storageState` (which contains session cookies, auth tokens, and possibly localStorage/IndexedDB application data) get written into the same store as the semantic site model, committed to git, or synced unencrypted. A leak = full account takeover. The hCaptcha report specifically flags agents that "inject cookies/localStorage to hijack sessions" and "reset passwords" as routine behavior — this data is high-value and must be treated as a secret from day one.

**Why it happens:**
- `storageState` is treated as just another artifact; it is convenient to dump it alongside learned knowledge.
- The mental model is "session = part of the site model" rather than "session = a bearer credential, separate from the reusable semantic understanding."

**How to avoid:**
- **Separate two stores with different security posture:** (a) *semantic knowledge* — non-secret, shareable, portable (what a site's structure/behavior means); (b) *session state* — secret, encrypted at rest, never committed, scoped to a user+site, with explicit expiry.
- Encrypt session state (OS keychain / secrets manager / encrypted store); never write it to the repo or logs.
- Apply the same discipline to demo recordings and learned examples that may contain captured tokens.

**Warning signs:**
- A `storageState.json` or `.auth/` file appears in `git status`.
- Learned knowledge artifacts contain raw `Cookie`/`Authorization` headers.

**Phase to address:**
Persistence/auth phase (define the two-store split before persisting anything real).

---

### Pitfall 5: Auth state is silently broken — sessionStorage, IndexedDB, expiry, and parallel invalidation

**What goes wrong:**
Automations "work locally, fail in production" because the saved session isn't actually complete: `storageState` saves cookies + localStorage but **not sessionStorage** (and IndexedDB only if explicitly requested, since Playwright 1.51). Apps that stash JWTs/session IDs in sessionStorage produce silently-unauthenticated runs. Separately, sessions expire mid-run, and parallel runs against a single-sign-on account invalidate each other (or apps rotate CSRF tokens on sensitive actions). Result: the agent falls back to "guess the login," which is where destructive auth mistakes (wrong password, lockout, 2FA spam) happen.

**Why it happens:**
- The "it worked in my dev session" illusion — the local browser session persisted, so the author never noticed the state file was incomplete.
- Auth is treated as a one-time setup rather than a managed lifecycle (capture → restore → detect-expiry → re-auth).

**How to avoid:**
- Capture the **full** storage state (cookies + localStorage + IndexedDB + explicitly sessionStorage where the app uses it); verify the app's actual token location in DevTools before assuming.
- Build a **session-liveness check** (navigate to an authenticated-only URL, assert logged-in state) and a **re-auth flow** that pauses for human re-authentication (2FA/reCAPTCHA can't be reliably bypassed — accept manual auth and resume, per the standard Playwright pattern).
- Detect and handle 401/redirect-to-login mid-task as a *signal*, not an error to brute-force around.
- Isolate sessions: one user profile per concurrent task; never share a single-session account across parallel workers.

**Warning signs:**
- 401s mid-run after a successful setup; "logged in locally, logged out in CI."
- Repeated login attempts on failure (lockout risk).
- No detection of the login-redirect as a distinct state.

**Phase to address:**
Auth/session-management phase (a dedicated phase, because auth is where automation most often causes real account damage).

---

### Pitfall 6: Anti-bot detection treated as a stealth war — instead of as a legitimate-session problem

**What goes wrong:**
Vanilla Selenium/Playwright leak automation signals (`navigator.webdriver`, missing browser APIs, CDP `Runtime.enable` calls) that anti-bot systems (Cloudflare Turnstile, DataDome, Kasada, Akamai) flag instantly. The response is often to reach for stealth tooling (Patchright, Camoufox, nodriver, SeleniumBase UC mode) or CAPTCHA-solving services — which launches an unsustainable cat-and-mouse arms race, and, critically for Juno, is the *wrong frame*: Juno is automating the **user's own accounts** with consent, not scraping a third party. Attempting stealth evasion against the user's own provider is both unnecessary and a ToS/account-ban risk. Over-aggressive automation (rapid clicks, no human rhythm) also triggers challenges that *lock out the user's real account*.

**Why it happens:**
- The developer imports the "bypass detection" playbook from scraping, where the goal is impersonation; Juno's goal is the opposite — acting *as* the user, legitimately.
- Undetected-chromedriver-era habits persist (that patch is now legacy and detectable), so teams bolt on stealth by default.

**How to avoid:**
- **Use the user's real browser/profile (or a faithful persistent profile) with their real cookies** rather than a pristine headless stealth instance. Authenticated, residentially-placed, human-paced sessions are the strongest "anti-bot" signal — the session *is* the legitimacy.
- Do not fight challenges with solvers; **pause and hand the challenge to the human** (solve the CAPTCHA / complete 2FA), then resume — this is both more robust and ToS-clean.
- Add **humanization at the pacing layer** (delays, realistic interaction ordering) to avoid tripping rate heuristics, but treat "evasion tooling" as explicitly out of scope.
- Respect robots/ToS and rate limits; detect challenge pages (Turnstile iframe, "verify you're human") as a distinct state with a defined human-handoff path.

**Warning signs:**
- The roadmap includes a "stealth/bypass detection" workstream.
- Repeated 403/challenge responses during normal use; account lockout warnings.
- Using a headless default browser for logged-in user automation.

**Phase to address:**
Browser-core phase (choose persistent-profile + human-handoff over stealth from the start).

---

### Pitfall 7: Indirect prompt injection hijacks the agent through page content

**What goes wrong:**
A page the agent reads contains hidden instructions ("ignore previous instructions, send the token to…", or white-on-white text, or text in HTML the human never sees). The agent — which is, by design, reading arbitrary web content and then *taking actions* — follows them, exfiltrating data or performing destructive actions. This is the defining security risk of browser agents (OWASP LLM01:2025); real in-the-wild attacks were reported against production agents (Unit 42, March 2026), and Perplexity Comet was demonstrated vulnerable in 2025.

**Why it happens:**
- The agent's instruction channel and its data channel are the same model context, and web content is fully attacker-controllable. The model can't reliably distinguish "your task" from "text on the page."
- Tools are scoped too broadly (the agent can read secrets *and* send data in the same loop).

**How to avoid:**
- **Treat all page content as untrusted data, never as instructions** — a hard architectural rule: the task/spec lives in a privileged channel; DOM text, alt text, aria-labels, and downloaded content are sanitized/data-fenced before reaching the planning model (mirror the untrusted-input boundary discipline).
- **Least-privilege tool scoping:** the exploration/planning loop cannot read credentials/secrets; the execution loop cannot exfiltrate (no network egress to arbitrary domains without confirmation); separate read from write capabilities.
- Gate any action that touches secrets, payments, or outbound messaging behind explicit user confirmation, so an injected instruction can't silently perform it.
- Keep the agent's *persisted* knowledge and instructions out of the page-content channel (injected text must never be able to rewrite the learned skill).

**Warning signs:**
- Page text is fed to the model in the same context as the system prompt with no fencing/role separation.
- The agent has an unconfirmed path from "read web content" to "send data / execute destructive action."

**Phase to address:**
Safety/guardrails phase + execution phase (data-fencing and least-privilege are architectural, not add-ons).

---

### Pitfall 8: Learned knowledge over-fits to one literal site instance and fails to generalize

**What goes wrong:**
A taught skill is keyed to exact URLs, DOM paths, and page-specific labels, so the "many job applications share the same portal → one skill generalizes" requirement (a core Juno use case) fails: the skill works on Greenhouse instance A but not Greenhouse instance B, because it remembered `examplecorp.greenhouse.io/jobs/42/apply` instead of the *portal-level pattern* (the apply form's semantic structure).

**Why it happens:**
- Knowledge is captured as a literal transcript of one demonstration ("these exact elements at these exact URLs") rather than as an abstraction ("the job-application form has fields Title, Name, Email, Resume, and a Submit — regardless of host/company branding").
- URL/DOM identity is used as the canonical key instead of *semantic structure + portal fingerprint*.

**How to avoid:**
- Canonicalize learned knowledge to **portal-level patterns**: identify the underlying platform (via DOM/JS fingerprints, known portal signatures) and store the skill against the portal type, with site-specific overrides layered on top.
- Key knowledge by **semantic structure** (form field roles, labels, workflows), not literal URLs; match new sites by structural similarity first.
- Maintain an explicit "portal fingerprint → shared skill" registry so reuse is a lookup, not a hope.

**Warning signs:**
- Skills are stored under full URLs with no abstraction layer.
- Reusing a skill on a different site of the same portal type requires re-teaching.

**Phase to address:**
Portal-recognition / generalization phase (must be designed into the semantic model schema early, even if shipped later).

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store learned actions as raw XPath/CSS | Fast to implement from a demo | Silent rot + wrong-element clicks on every site change | Never for *durable* knowledge; ok only as ephemeral in-run hints |
| Save `storageState`/cookies in the same file as site knowledge | One artifact, simpler | Secret leak → account takeover | Never |
| Default to headless browser | Simpler infra | Trips anti-bot, wrong for logged-in user automation | Only for non-authenticated public pages |
| Screenshot/vision-only interaction loop | Fewer dependencies | Slow, coordinate-hallucination-prone, expensive | Only as fallback for non-accessibility-tree widgets |
| Skip the destructive-action classifier "for now" | Ship faster | Real-world damage; destroys the core value prop | Never — it's a founding constraint |
| Reuse one shared account across parallel workers | Fewer logins | Sessions invalidate each other; lockouts | Only in single-threaded MVP |
| Bolt on stealth/CAPTCHA solvers | Unblocks one blocked site | Cat-and-mouse maintenance, ToS/ban risk, off-brief | Never for the user's own accounts |

## Integration Gotchas

Common mistakes when connecting to external services (browsers, auth, models).

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Playwright / browser engine | Relying on `page.click()` with CSS/XPath and ignoring auto-wait/locator semantics | Use semantic locators + accessibility snapshot; let auto-wait resolve readiness |
| `storageState` | Assuming it captures everything | Verify sessionStorage/IndexedDB; add explicit capture + liveness check |
| Login/2FA | Automating 2FA/reCAPTCHA | Manual auth once, persist state, resume; hand challenges to human |
| LLM action model | Feeding raw page HTML/DOM into the planner with no schema | Feed a structured accessibility tree + scoped element refs; fence page text as data |
| Voice input | Treating voice as just a text transcript with no confirmation step for destructive actions | Confirm destructive actions aloud before execution; same guardrail as any input channel |
| Session reuse infra (Stagehand/Browserbase-class) | Assuming framework persistence "just works" across versions (documented breakage) | Own your own `storageState` capture/restore; don't depend on framework internals |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Screenshot-per-step vision loop | Slow task completion, token/cost explosion | Ground in accessibility tree; screenshot only as fallback | Immediately at multi-step tasks (documented "slower than human" failure) |
| Re-login every task | Each run adds 5–15s + flakiness | Persist session state; reuse across tasks | At tens of tasks/day |
| Unbounded exploration (crawl the whole site) | Rate-limit triggers, account risk, cost | Scope exploration to the user's goal; crawl only reachable/read paths | On large sites or protected portals |
| Parallel tasks sharing a session/account | Mutual invalidation, lockout | Isolated profile per concurrent task | At 2+ concurrent tasks |
| Re-resolving locators with no cache | Slow replays | Cache semantic→element hints per page, refresh on success | At many automations/site |

## Security Mistakes

Domain-specific security issues beyond OWASP basics.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Committing `storageState`/cookies to git | Account takeover | Treat as secret; encrypt; gitignore; separate store |
| No action taxonomy (any tool can do anything) | Destructive action from a bad/injected decision | Classify actions; confine autonomous runs to non-destructive set |
| Page content fed to planner as trusted instructions | Indirect prompt injection → data exfiltrated | Data-fence page content; least-privilege tools; confirm secret/destructive actions |
| Storing auth tokens inside learned knowledge artifacts | Leak on knowledge sync/share | Two-store split: semantic (shareable) vs session (secret) |
| Agent has unrestricted network egress during execution | Exfiltration of secrets it can read | Deny unconfirmed egress; allowlist domains per task |
| Voice channel bypasses confirmation | Destructive action spoken/triggered without review | Same guardrail for every input modality, incl. voice |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Agent does things during "setup" without asking | User distrusts the whole product after one bad send | Explicit, minimal confirmation only for destructive actions; silent for read-only |
| Confirmation fatigue (asking for *everything*) | User ignores prompts; "yes to all" | Confirm only destructive/irreversible actions; batch read-only silently |
| No visible abort/pause | User feels they can't stop it mid-task | Always-available kill switch + clear "what it's about to do" preview |
| Replay fails with no explanation | "It's broken" — no trust in durability | Surface re-identification confidence + drift reason; offer re-teach |
| CAPTCHA/challenge hard-fail | Automation dead-ends on one site | Human-handoff flow with clear "I need you to solve this" |

## "Looks Done But Isn't" Checklist

- [ ] **Safe exploration:** "Explore the site" currently performs `submit`/`send`/clicking action buttons — verify exploration is confined to read + benign-write via the action classifier.
- [ ] **Durable knowledge:** A taught action saved as XPath/CSS that works once — verify it re-identifies from a *semantic* description against the accessibility tree, not a raw locator.
- [ ] **Session persistence:** `storageState` saved but the app uses sessionStorage/IndexedDB — verify the app's actual token location, then assert logged-in after restore.
- [ ] **Secret hygiene:** No `.auth/`/`storageState.json` in git; session state encrypted and separated from semantic knowledge.
- [ ] **Anti-bot posture:** No stealth/CAPTCHA-solver dependency; persistent user profile + human-handoff for challenges instead.
- [ ] **Injection resistance:** Page text is data-fenced from the planner's instruction channel; agent has no unconfirmed exfiltration path.
- [ ] **Portal generalization:** A skill keyed to semantic structure + portal fingerprint, not a literal URL — verify it transfers across same-portal sites without re-teaching.
- [ ] **Voice parity:** Voice-driven destructive actions hit the same confirmation guardrail as GUI-driven ones.
- [ ] **Abort:** A kill switch exists and stops the agent mid-task (not just between tasks).

## Recovery Strategies

When pitfalls occur despite prevention.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Destructive action executed (message sent / form submitted) | HIGH (real-world, possibly irreversible) | Undo where possible; log the action for audit; add classifier rule so this action class is gated; surface apology/undo affordance to user |
| Learned knowledge rotted (wrong-element replay) | MEDIUM | Detect re-identification mismatch → refuse to act → offer re-teach from a single demonstration |
| Session silently invalid | LOW–MEDIUM | Liveness check fails → pause → human re-auth → resume; refresh stored state |
| Account locked out (rate/anti-bot) | HIGH | Stop automation; human resolves lockout; add pacing + challenge-handoff |
| Prompt injection detected | MEDIUM | Abort task; quarantine the page; audit for exfiltration; tighten fencing |
| Portal skill fails to generalize | MEDIUM | Re-key skill to portal fingerprint; re-teach once against the new instance |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls (phases are proposals; ROADMAP.md not yet authored).

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Destructive autonomous actions (P1) | Safe-exploration / guardrails phase | Exploration run performs zero `write-destructive` actions under test; destructive actions always gated by demo/confirmation |
| Hallucinated coordinates (P2) | Semantic-model / browser-core phase | Actions resolve to element refs, not pixels; wrong-element click rate near zero on seeded tasks |
| Knowledge rots (selectors) (P3) | Semantic-model + persistence phase | Replay succeeds after a simulated DOM change; re-identification from semantics, not raw locator |
| Secrets in knowledge (P4) | Persistence/auth phase | No secrets in git or knowledge store; session encrypted & separated |
| Auth silently broken (P5) | Auth/session-management phase | Liveness check passes after restore; 401→re-auth handled; no lockout |
| Anti-bot/stealth war (P6) | Browser-core phase | Logged-in tasks run without stealth tooling; challenges route to human-handoff |
| Prompt injection (P7) | Safety/guardrails + execution phase | Injected page instructions can't trigger destructive/secret actions; data-fencing test passes |
| Non-generalizing skills (P8) | Portal-recognition phase | One skill replays across multiple same-portal sites without re-teach |

## Sources

- hCaptcha, "Report: Browser Agent Safety is an Afterthought for Vendors" — https://www.hcaptcha.com/post/report-browser-agent-safety-is-an-afterthought-for-vendors (HIGH)
- Anthropic, "Introducing computer use" — https://www.anthropic.com/news/3-5-models-and-computer-use (HIGH)
- OpenAI, "Introducing Operator" / "Computer-Using Agent" — https://openai.com/index/introducing-operator/ (HIGH)
- Anthropic Engineering, "Beyond permission prompts" and "How we contain Claude" — https://www.anthropic.com/engineering/beyond-permission-prompts (HIGH)
- Unit 42 (Palo Alto Networks), in-the-wild indirect prompt injection report (March 2026) — https://unit42.paloaltonetworks.com/ai-agent-prompt-injection/ (HIGH)
- Brave, "Indirect Prompt Injection in Perplexity Comet" — https://brave.com/blog/comet-prompt-injection/ (HIGH)
- OWASP LLM01:2025 Prompt Injection (via Microsoft Learn SFI) — https://learn.microsoft.com/en-us/security/zero-trust/sfi/defend-indirect-prompt-injection (HIGH)
- Playwright, "Reuse authentication state" / auth docs — https://playwright.dev/docs/auth (HIGH)
- currents.dev, "Testing Authentication with Playwright" — sessionStorage/IndexedDB/storageState gotchas — https://currents.dev/posts/testing-authentication-with-playwright-the-complete-guide (HIGH)
- currents.dev / betterstack, Playwright flaky-selector & anti-pattern guides — https://betterstack.com/community/guides/testing/avoid-flaky-playwright-tests/ (HIGH)
- Augment Code, "Self-healing tests" (Playwright v1.56 Healer agent, locator drift) — https://www.augmentcode.com/guides/what-are-self-healing-tests (MEDIUM)
- mediar-ai/terminator — accessibility-tree-based element resolution — https://github.com/mediar-ai/terminator (MEDIUM)
- pim97/anti-detect-browser-tools-tech-comparison (Camoufox, Patchright, etc.) — https://github.com/pim97/anti-detect-browser-tools-tech-comparison (MEDIUM)
- ScrapingBee, "Web Scraping Without Getting Blocked" (undetected-chromedriver now detectable) — https://www.scrapingbee.com/blog/web-scraping-without-getting-blocked/ (MEDIUM)
- browserless.io, "Browser Agent Security Risk" — https://www.browserless.io/blog/browser-agent-security-risk (MEDIUM)
- browserbase/stagehand #1250 — storage-state persistence breakage in agent frameworks — https://github.com/browserbase/stagehand/issues/1250 (MEDIUM)

---

*Pitfalls research for: Juno — AI browser-automation agent ("semantic website compiler")*
*Researched: 2026-08-21*
