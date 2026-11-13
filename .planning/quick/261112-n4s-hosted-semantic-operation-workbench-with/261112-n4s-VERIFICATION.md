# Verification — 2026-11-12

## Automated checks

| Check | Result | Evidence |
|---|---|---|
| `pnpm install --frozen-lockfile` | PASS | All 3 workspace projects; pinned pnpm 11.24.0 under Node 24.22.2 |
| `pnpm build` | PASS | Strict TypeScript across browser and lab; build is typecheck in this repo |
| `pnpm test` | PASS | 37 browser + 4 lab unit tests |
| `pnpm test:e2e` | PASS | 15 existing browser tests + 2 API-driven lab integration tests using real Chromium |
| Docker build | PASS | Node 24, bundled Playwright Chromium, unprivileged runtime, `/data` volume |
| Compose health + live compile/replay | PASS | `/healthz` healthy, 5 semantic actions, 5 verified postconditions |
| Container restart with durable volume | PASS | Same cookie recovers saved model/version, receipt, interaction and feedback; replaying same request adds no interaction |
| Human-driven UI usability | NOT RUN | Session preview available; Jack's checklist and feedback pending |
| Permanent public hosting | BLOCKED | Coolify saved API token and login rejected |

## Integration acceptance evidence

The first lab test exercises production HTTP server → BrowserSession → SemanticPageReader → compiler/checkBindings → SemanticActor → fixture POST → independent store verifier. It verifies new inputs, same-model replay across browser restarts/reordered DOM, precondition failure with zero actions after rename, explicit recompile/new version, ambiguous compile rejection, completed actions with failed no-effect verification, idempotent retries and conflicting request IDs, feedback and evidence export. The second checks isolated owner state, custom-header and cross-site mutation rejection, external URL schema rejection and source-route denial.

Unit tests assert that durable trees remove eN/box data, invalid dates/extra inputs fail, duplicate/wrong-person/wrong-field effects do not verify, owner paths cannot traverse, feedback/model survive reopening, and a running receipt becomes interrupted/uncertain after a store restart. Actual Chromium request confinement, mutation rate/cap exhaustion and stop timing are enforced in code but not separately adversarially exercised by this suite.

## Friction resolved

- Initial shell used Node 20; final checks explicitly used installed Node 24.22.2. System Chrome was missing; installed with `pnpm --filter @juno/browser exec playwright install chrome` before rerunning.
- The pre-existing example.com smoke test expected a heading no longer present in the current live page. Retained the public navigation check, checking the origin and observed semantic documentation link instead.
- Playwright inherited project extra headers in the supposed headerless request context. Explicitly reset the context's headers; rejection check then passed.
- Docker Hub rate-limited later manifest requests after the initial successful image build. Pulled the official public ECR mirror with the identical manifest digest `sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54` and tagged it locally for subsequent builds. No source registry or image change was required.

## Claim limits

No general compiler, real Rolo/Canvas/Instagram, authenticated account flow, teach-by-showing, Windows host-browser/CDP, full Phase 2 guard or model-vs-baseline benchmark was validated. Zero model calls/cost describes the deterministic fixture path only. Atomic JSON replacement protects against partial file writes; this is a single-process bounded lab, not a production database or multi-replica account system.
