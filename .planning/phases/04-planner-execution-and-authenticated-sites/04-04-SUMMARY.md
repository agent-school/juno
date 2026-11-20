---
phase: 04-planner-execution-and-authenticated-sites
plan: 04
status: partial
implementation: ee6213e68d26a77b2e6933abdf61e0337ae45c0f
---

# Live public-web interpretation and source review

Juno uses the existing metered AWS account through native Bedrock Converse. Earlier hosted runs used Claude Sonnet 4.5; the current deployment uses `us.anthropic.claude-opus-4-6-v1`. The saved OpenAI credential returned `ip_not_authorized`; OpenCode's official free route hit its usage limit. Credentials remain server-only runtime secrets, never build arguments, task input or repository content.

## Delivered

- Shared bounded JSON transport supports OpenAI Chat Completions and Bedrock Converse. A single final JSON object may have a formatting introduction/fence, including indentation; ambiguous objects, trailing text, truncation and tool responses remain rejected.
- Native planners select host-generated excerpt IDs. The host supplies exact observed quotes before validating answer provenance and literal extraction values. Current goals control formatting; historical tables do not require follow-up tables.
- Malformed decisions, invented references, invalid reads and grounding failures share two correction attempts. Invalid citations identify the rejected field and list observed excerpt IDs. Rejected proposals are untrusted correction context for this run only. Invalid actions do not execute.
- Grounded drafts stay private until a separate counted model call classifies every supplied answer/table part. A valid rejection can trigger up to two separate revisions, each requiring a new audit. The review format is a strict map from part IDs to issue codes; format repair receives review-specific instructions. Only curated part IDs/issue codes enter activity. Reviewer output cannot rewrite an answer or grant execution authority.
- Complete captured sources are reviewed when they fit. Larger prompts retain every cited quote with surrounding conditions and document openings, merge spans and mark omitted gaps. Actual serialized UTF-8 stays within 100 KB; unknown context requires more cited conditions or qualification. This reduces mistakes; it does not establish truth or completeness.
- Known official URLs can be opened directly before stating facts. Invalid EOF reads and link references can be corrected. Request/response budget failures retain observations and give curated diagnostics. The twelve-call, ten-page and two-minute caps are unchanged. Source excerpts retain short trailing text before claiming complete coverage.

## Evidence

Typechecks, 172 unit tests and all 36 browser/API tests pass. Native protocol-controlled browser coverage checks the full path from drafting and rejection to revision, review and publication, withholding the draft until accepted. Failed review/grounding publishes no answer. Four 32 KB ASCII sources and ten 32 KB multibyte sources fit the bounded review context while retaining a near-end policy and adjacent earlier-version exception. Browser request-budget exhaustion and invalid follow/EOF recovery have regression coverage. The dependent [PR #2](https://github.com/agent-school/juno/pull/2) also proves recovery and sign-out with all 500 workspace slots occupied; its review thread is resolved.

Historical hosted bb498fb acceptance covered the original Python venv/uv comparison (three live calls, six citations, two literal rows), exact fresh-source follow-up (ten calls, five citations, refreshed/reused site memory, no inherited rows), older-task reload with unchanged receipt, desktop/390px quote layout, active Stop with no hidden completion after more than two minutes/reload, and honest account/write refusal (one call, no pages).

abd2091 fixed URL-free runtime discovery, but the Node.js answer overgeneralized the >=27 Active LTS policy to older releases and inferred a production recommendation. Exact quotation provenance did not prevent this factual defect. Structured source review identified both defects locally; a fresh official-source Node.js goal then completed in six live calls with critique-driven correction. One-pass rewriting was insufficient. Bing was not used in those successful direct-source runs, so its reliability is not established.

Coolify job `fswkbxp5vehyxshfa8qjoa70` finished on `ee6213e`. After rollout, HTTPS `/healthz` returned HTTP 200 in `research-and-owned-fixture` mode. The hosted workspace reported Opus configured and completed actual model calls. Coolify's cached status still disagrees with live HTTPS.

### Reproduce the hosted checks

Open [Juno](https://juno.agentschool.io) in a fresh workspace. Select **Pursue the goal**, review each task, and confirm that review alone records no pages or model calls. Run the reviewed task and keep the receipt even if the task fails.

1. **Compare tools**, with [Python's venv docs](https://docs.python.org/3/library/venv.html) and [uv's environments docs](https://docs.astral.sh/uv/pip/environments/) as starting URLs: “Compare Python's standard-library venv with uv for creating Python virtual environments. Use both official sources. Explain the main differences and return a compact extraction table with each tool's create command as an exact source value, plus checked source quotes. This is a synthetic public-documentation test; do not install or execute anything.”
2. **Follow up** from that answer, using the same URLs: “For those same two tools, which Python interpreter is used to create a virtual environment, and can a missing requested Python version be downloaded? Re-read both official sources now, distinguish explicit source facts from anything unknown, and cite checked quotes. Do not run or install anything.” Require fresh observations, reused site memory and no table. If the parent failed, skip this dependent case.
3. **Discover Node.js**, leaving starting URLs empty: “Find the official Node.js release policy and state which release status is recommended for production. Distinguish Active LTS, Maintenance LTS and Current using checked source quotes. Do not execute code or install anything.” Check that version-scoped schedules are distinguished and production guidance is explicit in the sources.
4. **Discover Playwright**, leaving starting URLs empty: “Find the official Playwright documentation and identify which browser engines it supports. Return an answer with checked source quotes. Do not execute code or install anything.”

Hosted HTTP acceptance on 2026-11-20, in one fresh workspace:

| Case | Calls | Result |
|---|---:|---|
| Python comparison | 4 | Answered from both official pages with 10 exact citations and two literal rows. |
| Python follow-up | 8 | Reobserved both parent sources with newer timestamps and reused their site memory. Source review rejected the final draft after two revisions. |
| Node.js without URLs | 5 | Found the official releases page, but invalid reviewer output exhausted both format corrections. No answer was published; the policy interpretation remains unverified. |
| Playwright without URLs | 3 | Opened the official site directly and answered Chromium, Firefox and WebKit with two checked citations. This did not exercise Bing. |

All four reviews were inert. Each downloadable receipt matched its task record; the comparison receipt remained byte-identical after the later runs. Rejected outcomes retained source evidence and contained no answer, citations or rows. An answered follow-up with no inherited rows and older-task UI reload were previously observed, but were not reverified through the UI on this deployment.

## Remaining gates

Search-heavy pages can exhaust the browser request budget; supply direct sources for reproducibility. Partial/captured text and model review cannot prove all facts, scope or completeness. Physical mobile, Windows UI and the optional Engine written-request planner are separately untested here. Authenticated websites, arbitrary external writes, teaching, semantic repair, general desktop control and RUNTIME-03 firewall enforcement remain open. No Muse parity claim and no merge. PR #3 depends on PR #2; GitHub previously refused the latter's merge with HTTP 403. Coolify's cached health label still disagrees with live HTTPS checks.
