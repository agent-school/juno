# Reproducible computer-use agent

Juno now has a reusable semantic task runtime, a provider-neutral intent boundary and a reproducible browser benchmark. Its reference adapter operates an owned three-page contact workspace: create a contact, then add a follow-up that requires that contact to exist. It verifies the stored records independently of the browser's success message.

This is a bounded browser-agent foundation. Arbitrary-site discovery, generalized self-healing, real-account support, teach-by-showing and desktop/vision control remain open. The hosted research desk does not expose this CLI yet.

## Try the complete loop

Use Node 24 LTS, pnpm 11.24.0 and system Google Chrome, as in the repository setup. No API key is required:

```sh
pnpm install --frozen-lockfile
pnpm agent:demo
pnpm agent:demo
```

The first invocation compiles three approved routes, persists their semantic model, executes two typed operations and prints `verified` with two application writes. The second invocation restarts the application, reloads its data and returns the same verified request with zero new writes. Both invocations close their dedicated Chrome context and fixture server.

```sh
# A different task; watch Chrome work in a desktop environment.
pnpm agent:demo --new-task --headed --name "Grace Hopper" --email grace@example.test

# Break a semantic label: this new task must stop before a write.
pnpm agent:demo --new-task --variant renamed

# Use an independent private workspace.
pnpm agent:demo --workspace /absolute/path/to/another-workspace
```

Default data lives under `.juno-agent/v1/demo/`; `JUNO_AGENT_DATA_DIR` changes the base directory. Task manifests contain inputs, and application data contains records; keep that directory private. Receipts contain input hashes, expected fields, independent verification results, structural observations, action audits and recovery state. Semantic models contain reusable identities and contracts, without filled input values, cookies or browser storage. These local files are not an encrypted secret vault.

The saved fixture port is reused after restart. An occupied port fails rather than attaching to an unrelated server. A new workspace gets its own port and identity. Changing existing task inputs requires `--new-task`; an uncertain request must be inspected before assigning a different ID. Duplicate prevention is scoped to a task/step identity, not arbitrary equivalent natural-language requests.

## Docker, including hosts without Node

The existing image includes the agent CLI and bundled Chromium:

```sh
docker build -t juno .
docker run --rm -v juno-agent-data:/data juno pnpm agent:demo
docker run --rm -v juno-agent-data:/data juno pnpm agent:demo
docker run --rm -v juno-agent-data:/data juno pnpm agent:benchmark
```

The named volume retains the application, task, knowledge and journal. The image sets `JUNO_AGENT_DATA_DIR=/data/agent` and `JUNO_AGENT_CHANNEL=chromium`. These commands launch an owned browser in the container; they are separate from the Windows host-Chrome/CDP launcher. No new Coolify deployment is implied.

## Natural-language interpretation

`planTask` accepts an injected `IntentInterpreter`, so the planner can use an affordable provider without coupling execution to it. `createChatInterpreter` supports OpenAI-compatible Chat Completions over HTTPS. It sends only the intent and a reviewed operation catalog, requests bounded JSON output and validates every proposed operation, parameter and task-step identity locally. It never exposes browser or confirmation capabilities to the model.

Configure `JUNO_PLANNER_API_KEY` securely in the process environment. The default model is `gpt-4.1-nano`; `JUNO_PLANNER_MODEL` and `JUNO_PLANNER_ENDPOINT` select another compatible provider, such as DeepSeek. Do not put credentials in task files or endpoint URLs.

```sh
pnpm agent:demo --new-task --plan-only --intent "Create Ada Lovelace, email ada@example.test, category Research, subscribed false. Then add a follow-up for that email, note Compare browser agents, date 2026-11-20."

# Inspect the private saved task.json, then execute that exact plan without another model call.
pnpm agent:demo
```

An accepted plan is atomically saved and fsynced before execution. Replays use that saved plan; interpretation is not rerun. Model output can still misunderstand an intent: schema validity is not semantic correctness. This adapter is currently validated with adversarial transport/contract tests. The attempted live OpenAI check returned HTTP 401 with the configured credential, so live model planning remains unverified. No browser writes followed that rejected request.

## Benchmark and evidence

```sh
pnpm agent:benchmark
pnpm agent:benchmark --trace
pnpm agent:benchmark --output /absolute/path/to/empty-directory
```

Each run owns its fixture, profile and application state and emits `report.json` plus per-scenario receipts. `--trace` adds Playwright traces for the synthetic pages. The output directory must be empty; use the demo to resume a previous workspace. The benchmark runs in CI through `pnpm test:e2e` and exits nonzero on any failed assertion.

The 17 checks cover read-only multi-page compilation and owner-isolated reload; two-operation composition and false checkbox values; application restart and cached requests; changed-input rejection; layout reordering; renamed and ambiguous controls; fake success and refusal to blindly retry; independent host authority; full-plan input validation; malformed verification; abort reconciliation; real process death between application commit and receipt commit; a stalled verifier deadline; loss of a previously verified effect; page-instruction isolation; and external/read-only network canaries.

The crash worker closes its owned Chrome before killing its Node process. This validates journal/lock recovery, not arbitrary browser/host power-loss cleanup. Benchmark assertions describe the owned fixture; they are not arbitrary-site success rates. Deterministic execution uses zero model calls.

## Runtime contract for another site

The exported `@juno/agent` surface separates four responsibilities:

1. `observeSite` visits one to twenty explicit canonical routes through the semantic reader and saves the model in `SiteKnowledgeStore`. It infers no executable behavior from page instructions. Interception remains active until the dedicated context is discarded.
2. `planTask` selects typed operations from contracts that match both the saved model and the trusted host catalog. The host assigns task/model IDs. All inputs are validated again before the runtime opens a browser.
3. `AgentRuntime` resolves fresh semantic preconditions, executes through `createGuardedActor`, and requires the host's independent verifier to match the request key and every expected field. Benign permissions are supplied separately by host code. Unknown/destructive writes stop with `confirmation-required`; this CLI does not implement interactive destructive-action approval.
4. `RunStore` durably records checkpoints before mutations. A separate SQLite database holds the process execution lock so journal commits remain durable; the OS releases the lock when a process dies. The store is local, one workspace per directory, with up to 100 run receipts. It is not a distributed lease service.

To add a site, provide explicit routes/resources, reviewed typed contracts, an independent state verifier and exact host permissions. Its application must expose a trustworthy per-operation request key or equivalent deduplication mechanism. The browser factory must own a fresh dedicated context with service workers blocked and must close it reliably. Never use a daily Chrome profile.

Recovery checks authoritative state before continuing. An existing matching effect is reused. An attempted mutation whose effect remains absent/unknown is held as uncertain, never resubmitted automatically. A conflicting effect or missing previously verified state stops downstream work. Only independent reads are polled; browser mutations are not retried.

Request interception, popup closure and websocket refusal are defense in depth. They do not sandbox JavaScript, undo already-issued requests, or prove authenticated-site safety. Auth expiration, safe interactive confirmations, dynamic-field discovery, evidence-based semantic repair and application/network isolation remain Phase 4 acceptance gates.
