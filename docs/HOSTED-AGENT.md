# Agent workspace

Open [Juno](https://juno.agentschool.io) and select **Agent**. This screen uses `@juno/agent` through the hosted backend; browser actions, receipts, verification and recovery use the same runtime as `pnpm agent:demo`.

## Run a supported task

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

The typed task form needs no model key. Written requests require `JUNO_PLANNER_API_KEY` and `JUNO_PLANNER_MODEL` in the server environment; `JUNO_PLANNER_ENDPOINT` optionally selects an HTTPS OpenAI-compatible endpoint. Credentials stay server-side and are not accepted from the frontend. Only the reviewed contact operations are available to the interpreter. Every proposal is validated and saved for review before execution. A configured connection is not proof of valid provider authentication; failures leave task actions unexecuted. Successful live provider planning remains an explicit verification gate.

## Deployment and persistence

Run `pnpm lab` with Node 24 or use the existing Docker image. Docker sets both lab and agent browser channels to bundled Chromium. Hosted workspaces live beneath `JUNO_LAB_DATA_DIR/agent-workspaces` (`/data/agent-workspaces` in Docker), keyed by the existing workspace identity. SQLite journals, saved task plans, application state, screenshots, site knowledge and check reports persist on the existing `/data` volume. Workspace passphrase recovery restores the same identity and its agent history. The separate CLI still uses `JUNO_AGENT_DATA_DIR`.

Use one process/replica with persistent local storage. Keep the data directory private and backed up; receipts and screenshots contain task inputs and application data. This is not an encrypted credential vault. No daily browser profile or real-account credentials are used. Research, personal Memory and Browser lab remain available in their own tabs.

Hosted API integration and container checks are recorded in GSD. Interactive usability testing of the new Agent screen is tracked separately from API tests. Authenticated websites, arbitrary-site discovery, teach-by-showing, semantic repair, destructive-action approval and general desktop control remain unfinished.
