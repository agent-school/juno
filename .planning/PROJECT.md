# Juno

## What This Is

Juno is a semantic website compiler: a tool that takes any website, builds a durable semantic model of its structure and behavior through exploration and testing, and permanently saves that understanding per site (Instagram, Outlook, any job portal). The user can teach Juno how a site works by demonstrating an action, and Juno learns, persists, and later replays that knowledge to automate things that are otherwise very hard to automate. Its product form is a Chromium-based browser with a built-in chat panel (built on open-source Chromium scaffolding) — the user talks to Juno beside the page it is learning or driving. Voice is a planned later modality over the same pipeline.

## Core Value

Turn any website into a durable, reusable semantic understanding — learned through safe exploration and teach-by-showing — so hard-to-automate actions (messaging someone on Instagram, signing a contract, sending email when no API is exposed, applying to jobs) can be automated reliably without destructive guessing.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Juno can load any website and explore it to build a semantic model of its structure (pages, navigation, elements)
- [ ] Juno can test interactions safely, without performing destructive or irreversible actions
- [ ] User can teach Juno an action by demonstrating it once, and Juno learns how to reproduce it
- [ ] Learned knowledge is permanently saved and reloaded per website, so it persists across sessions
- [ ] Juno can execute saved automations end-to-end (e.g., message on Instagram, sign a contract, send email in Outlook, apply to a job)
- [ ] Juno recognizes shared portals across sites (e.g., many job applications use the same portal) and reuses learned knowledge
- [ ] Juno can be driven by voice

### Out of Scope

- Nothing explicit yet — boundaries to be refined during requirements definition.

## Context

Juno sits in the "AI browser agent / computer use" space (OpenAI Operator, Anthropic Computer Use, Skyvern, Browserbase, etc.), but its core differentiator is the combination of three things: (1) a *compiler* mental model — a website is compiled into a semantic model rather than driven one-off, (2) *teach-by-showing* — instead of the AI guessing how a site works (and breaking things), the user demonstrates and the AI learns, and (3) *persistent per-site memory* — learned knowledge is permanently saved and reused, turning each site into an automatable surface.

The motivating use cases are concrete automation jobs that normal tooling can't reach because there is no exposed API:
- Messaging people on Instagram
- Signing a contract
- Sending email in Outlook when the API is not exposed
- Updating time tracking on whatever web app you're in
- Extracting data you otherwise can't get
- Applying to jobs — where many different applications share the same underlying portal, so one learned skill generalizes

A key constraint the user emphasized: **websites often cannot be freely tested**, because a wrong test can cause real damage (send the wrong message, submit a form, sign something). Safe exploration and human-in-the-loop demonstration are therefore central, not optional polish.

## Constraints

- **Safety**: Never perform destructive or irreversible actions during autonomous exploration/testing; destructive actions require either an explicit demonstration or an explicit confirmation.
- **Persistence**: Learned site knowledge must survive across sessions — it is not ephemeral per-task context.
- **Cost**: Prefer affordable LLMs (e.g. DeepSeek flash-tier models) via a provider-agnostic layer; lean on user demonstration and deterministic replay to minimize per-step LLM usage.
- **First validation target**: Instagram messaging is the v1 proof use case — highest anti-bot risk, so it needs an early feasibility spike rather than a late one.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Product form: Chromium-based browser with built-in chat panel (open-source Chromium scaffolding) | User interacts by chatting beside the live page — demonstration and observation happen in the same surface | — Pending |
| Instagram messaging is the first v1 proof use case | It is the motivating vision; accepted anti-bot risk, mitigated by real persistent profile + human handoff + early feasibility spike | — Pending |
| Affordable LLMs (DeepSeek flash-tier) via provider-agnostic layer, not premium-tier models | Cost constraint; teach-by-showing + deterministic replay reduce reliance on per-step LLM reasoning | — Pending |
| Voice is a later modality, not v1-critical | User confirmed text/chat-first; voice wraps the same intent pipeline once stable | — Pending |
| Teach-by-showing over autonomous guessing | Testing can be destructive, so the user demonstrates to teach safely | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-21 after initialization*
