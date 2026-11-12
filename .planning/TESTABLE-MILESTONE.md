# Testable milestone and evidence ledger

## Current reality

Browser Core is the only complete roadmap phase. Phase 01.1 has three plans and no implementation summaries. Phase 2 has no executable plans. The lab is a separately scoped GSD quick task, not completion of phases 2–5.

The newer Notion experiments (September 2026) recommend a controlled Rolo operation, then external read-only Canvas. AGENTS/PROJECT still describe Instagram as the first proof. Preserve the Instagram feasibility question, but recommend Rolo → Canvas as the next validation sequence; get Jack's decision before changing the product's first-market thesis.

## Evidence gates

| Gate | Acceptance evidence | Status |
|---|---|---|
| LAB-01 | Compile live fixture semantics; persist role/name bindings without eN refs | Passed browser integration + unit checks |
| LAB-02 | Reuse model with new inputs and a new browser; independently verify all effects | Passed browser integration |
| LAB-03 | Reorder DOM; fail on renamed/ambiguous controls; recover by explicit recompile | Passed browser integration |
| LAB-04 | Reject no-effect writes; suppress duplicate requests; preserve uncertain writes | Passed integration + restart unit checks |
| LAB-05 | Export durable receipts/feedback; session isolation and restart persistence | Passed integration + live container restart |
| HOST-01 | Reproducible container + persistent volume + health check | Passed Docker build and Chromium smoke/restart |
| HOST-02 | Public HTTPS deployment + persistence after redeploy | Blocked on refreshed Coolify access |
| UAT-01 | Jack completes lab checklist and submits feedback | Awaiting user trial |
| RUNTIME-01..05 | Execute existing 01.1 plans including Windows host-browser smoke test | Not implemented |
| SAFE-01..05 | Full code-enforced guard, confirmations, audit, injection boundaries, kill switch | Not implemented |
| ROLO-01 | Real `capture_interaction(person,note,occurred_at,next_action)` with real application-state verifier and one UI mutation | Not implemented |
| EVAL-01 | Repeated Rolo runs vs named baseline: success, latency, actions, tokens/cost, failure categories | Not implemented |
| CANVAS-01 | Read-only upcoming-coursework over several authenticated GT courses, sources and failure trace | Not implemented |

## Recommended next increments

1. Finish this lab's user trial and permanent hosting. Convert the exported feedback into small GSD tasks with run IDs, expected/actual state and exact acceptance evidence.
2. Complete the existing 01.1 Windows runtime plan and Phase 2 guard before connecting a browser that can mutate real accounts. The lab's fixture confinement is not a substitute.
3. Add the real Rolo adapter for the same typed contract and a trusted application-state verifier. Deliberately rename/move a control and preserve the old call. Keep Rolo-specific bindings out of the operation contract.
4. Run a small predefined suite repeatedly against a named baseline under the same conditions. Include every failed/uncertain attempt; report compile cost separately from replay cost. Do not claim speed/reliability gains from one clean run.
5. Move to Canvas read-only extraction only after Rolo's verified loop survives a mutation. Record inaccessible courses/external tools; do not submit coursework. Prefer APIs for later calendar writes.

## Source map

- [Prototype requirements](https://www.notion.so/3d98a2eef320811987a2da7e59600eeb)
- [Controlled Rolo experiment](https://www.notion.so/3d98a2eef32081a6aaeddd78b815150c)
- [External Canvas benchmark](https://www.notion.so/3d98a2eef32081088d32c3c9e6c57b78)
- [Brain research synthesis](https://brain.jack-luo.com/n/philosophy/hermes-findings-on-semantic-website-compiler) — reported landscape numbers, not independently validated benchmark results.
- [.planning/DOCTRINE.md](DOCTRINE.md) — authoritative architecture.
- [Quick task plan](quick/261112-n4s-hosted-semantic-operation-workbench-with/261112-n4s-PLAN.md)
