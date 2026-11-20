# Agent workspace

Open [Juno](https://juno.agentschool.io) and select **Agent**. The main screen accepts a general goal and optional public starting URLs. The synthetic contact example is now in **Engine tests**, alongside its verified write/recovery matrix.

## General public-web tasks

1. Describe a goal: compare products, investigate documentation, find a policy, extract requirements or answer a sourced question. Optionally supply up to five HTTPS starting URLs. Examples help compose a task; they are not hard-coded workflows.
2. Select **Pursue the goal** for model-directed search, navigation, reading, comparison and extraction. The server needs `JUNO_PLANNER_API_KEY` and `JUNO_PLANNER_MODEL`. `JUNO_PLANNER_PROTOCOL` defaults to `openai`, with optional HTTPS `JUNO_PLANNER_ENDPOINT` for Chat Completions. For native AWS Bedrock, set the protocol to `bedrock-converse` and the endpoint to the HTTPS runtime **origin**, such as `https://bedrock-runtime.us-east-1.amazonaws.com`; the host binds the encoded model route. Credentials must be runtime-only secrets. The hosted service currently uses `us.anthropic.claude-opus-4-6-v1` through the existing metered AWS account.
3. Without a model, select **Collect source evidence** and supply at least one URL. This reads the starting websites, captures accessible text and links, and saves site structure. It deliberately does not claim to interpret or complete the goal.
4. **Review task** saves an immutable scope before opening a browser or calling a model. **Run reviewed task** starts the single shared worker. Watch events, source observations and browser frames; Stop retains captured evidence.
5. Model answers require exact quotes from captured source text. Extracted table values must occur in their quoted source. Native providers then check every draft answer/table part in a separate source-consistency call before publication. Rejected drafts remain private and require correction plus a new review. These checks reduce errors; they cannot establish factual truth or completeness. A source's own claim is not independent proof of its correctness.
6. **Review a follow-up** explicitly references the prior task's goal, answer and source URLs. Sources must be observed again before citation. **Website memory** reuses per-domain routes and semantic structure; it refreshes every page used as current evidence. No personal notes, accounts or browser cookies are implicitly imported.

The generic worker exposes `search`, `open`, observed-link `follow`, paginated source `read`, cited `finish` and `blocked` decisions. Clients/models cannot submit selectors, JavaScript, raw browser methods, credentials or execution authority. Every browser HTTP request uses a bounded DNS-pinned Node transport that rejects private/reserved IPs and non-GET/HEAD methods. Redirects are paused and followed by host code after validation; raw redirect headers never reach Chromium. Browser proxy/UDP/WebSocket/service-worker restrictions complement this boundary. This is not a completed OS/firewall sandbox acceptance claim. Subresource redirects, authenticated sessions, private networks, arbitrary external writes, PDFs/vision-only pages and challenges can remain unsupported.

Each task is limited to ten observed pages, twelve model calls (including planning, correction and source review) and two minutes; provider calls have a thirty-second bound. Invalid output, unknown references, invalid reads and grounding errors share two correction attempts. A valid review that rejects a draft can trigger up to two separate revisions inside the same task limits. Review prompts retain whole captured sources when they fit; larger contexts retain every cited quote with surrounding text and document openings, mark gaps, and stay within 100 KB of serialized UTF-8. Per-workspace limits are thirty tasks, twenty site origins and ten structural revisions per origin. Failed or interrupted tasks keep their evidence and publish no draft.

For discovery without starting URLs, known official URLs can be opened directly and must be observed before citation. Search pages may be thin or consume the request budget; direct-source success does not establish search reliability. Invalid reads at the end of captured text can be corrected, but the worker cannot read beyond captured text or bypass network budgets. Supplying direct source URLs makes bounded tasks more reproducible.

The general API is `/api/web`: state, task preparation, explicit run/stop, receipts/screenshots, site knowledge and forgetting. Saved files are under `/data/web-workspaces/<owner>` in Docker and share the existing workspace recovery identity. Task/knowledge forgetting is explicit; forgetting site structure does not erase source evidence already captured in task receipts.

## Engine tests: verified contact/follow-up execution

Select **Engine tests** for the owned application. This exercises the same typed executor as `pnpm agent:demo` and remains separate from the public-web worker.

1. Select **Use example** or enter a contact, email, follow-up note and date. Use synthetic data. Category and subscribed state are typed inputs.
2. Select **Review task**. Juno observes three approved pages when site knowledge is missing, validates the complete plan and saves it. No contact or follow-up is created during planning.
3. Review the two operations and their exact inputs. Select **Run reviewed task**. A dedicated headless browser executes the saved semantic operations.
4. Watch the step status and captured browser frames. The receipt records guarded actions and independent effect checks. A browser success message alone cannot produce a verified outcome.
5. Inspect **Saved in your contact workspace**. The backend reads these contact/follow-up records independently of the browser. Download the task receipt for the saved plan, verification evidence and audit.

The application is a private owned contact workspace, separate from real contacts and accounts. The target origin, routes, contracts, permissions and verifier are supplied by trusted server code. Clients cannot choose arbitrary URLs, selectors, contracts or request keys. The loopback application requires a private bearer token that is not returned by the API. Screenshots provide observation only.

## Stop, resume and failure trials

**Stop task** requests cancellation and preserves the saved request and journal. Inspect the receipt and stored results, then explicitly resume that same request. The runtime reads independent state before continuing: matching effects are reused; conflicting or unknown effects stop execution; an attempted mutation with no verifiable effect remains uncertain and is not blindly retried. Replaying a verified request adds no writes. A server restart reports an unfinished task as interrupted and never starts it automatically.

Failure trials let you reorder the owned page, rename or duplicate a target, show a false success, or introduce page instructions. These are controlled fixtures, not arbitrary-site success claims. Changing the trial does not authorize resubmission of an uncertain mutation. A new task ID represents a distinct request and can create new records even with equivalent inputs; inspect the old request before creating another.

Site memory lists saved versions and reviewed operations. Download site knowledge to inspect the complete saved semantic models and contracts. Observe refreshes the three approved routes without changing application records. Forget removes this site's semantic knowledge and invalidates saved plans that reference it; task history and application records remain. A newly observed version requires a newly reviewed task.

## Reliability checks

The in-app matrix runs the CLI's 19 checks in an isolated child workspace. Results appear as each check completes; a completed job has a downloadable report. **Stop after current check** cancels at a check boundary and keeps partial evidence. Checks do not add records to the task application's results. A hosted workspace retains at most five check jobs and 100 task plans; each task permits at most 20 inspections/execution attempts. There is one browser operation across Agent and Browser lab per server process.

## Optional language planning

The typed task form needs no model key. Written requests use the same server-only connection and protocol as public-web interpretation. Credentials are not accepted from the frontend. Only the reviewed contact operations are available to this interpreter. Every proposal is validated and saved for review before execution. A configured connection is not proof of valid provider authentication; failures leave task actions unexecuted.

Both protocols use bounded text-only inference, reject redirects, enforce a 30-second call timeout and a 64 KB response limit, and reject truncated or tool responses. A single final JSON object may have a text introduction or JSON fence; ambiguous objects and trailing text are rejected, and ignored prose never becomes an action. Every field still passes the host schema and safety boundary. Public-web providers receive the generated decision schema and select host-generated excerpt IDs; the host resolves these to exact observed quotes before the existing grounding validator runs. Models cannot supply the quote text for an ID or invent source IDs. Custom interpreter quote proposals remain subject to the same validator. Invalid JSON, unsupported decisions and rejected grounding can request at most two corrections combined within the original twelve-decision/two-minute budgets; no rejected decision executes and no rejected answer is saved as a result. Correction feedback identifies the invalid row field and includes the prior proposal as untrusted context scoped to this run, never another workspace. Only the current goal determines output format; historical table requests do not require follow-up tables. Connection, truncation and provider refusal failures stop immediately. Grounding checks provenance, not factual truth or completeness.

## Deployment and persistence

Run `pnpm lab` with Node 24 or use the existing Docker image. Docker sets both lab and agent browser channels to bundled Chromium. Hosted workspaces live beneath `JUNO_LAB_DATA_DIR/agent-workspaces` (`/data/agent-workspaces` in Docker), keyed by the existing workspace identity. SQLite journals, saved task plans, application state, screenshots, site knowledge and check reports persist on the existing `/data` volume. Workspace passphrase recovery restores the same identity and its agent history. The separate CLI still uses `JUNO_AGENT_DATA_DIR`.

Use one process/replica with persistent local storage. Keep the data directory private and backed up; receipts and screenshots contain task inputs and application data. This is not an encrypted credential vault. No daily browser profile or real-account credentials are used. Research, personal Memory and Browser lab remain available in their own tabs.

See the [hosted acceptance record](../.planning/phases/04-planner-execution-and-authenticated-sites/04-04-SUMMARY.md) for current and historical task results. Model output can still fail within the task budget. The optional Engine written-request planner is separately untested live. Automatic operation discovery, authenticated workflows, teaching, semantic repair and desktop control remain unfinished.
