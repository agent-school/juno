# The Semantic Website Compiler

> **Canonical architectural doctrine for Juno — provided by the project owner 2026-08-21.**
> This document is the authoritative technical vision. All planning artifacts (REQUIREMENTS.md, ROADMAP.md, phase plans) must conform to it. When a plan conflicts with this doctrine, the doctrine wins.

## A Technical Doctrine for Reliable Computer-Use Agents

The Semantic Website Compiler is based on a fairly simple observation: modern computer-use agents are reasoning at the wrong abstraction layer.

A human using Salesforce does not think:

> Find the DOM node whose text is "Accounts," click coordinates near its center, wait 800 ms, inspect the new DOM, then locate an input.

The human thinks:

> Open the Northstar account.

Likewise, when working in QuickBooks, a human thinks:

> Find the overdue invoice and send a reminder.

The website exposes pixels, DOM nodes, accessibility elements, JavaScript state, network requests, forms, routes, buttons, tables, modals, and other implementation details. But the actual task exists at a higher semantic level: customers, invoices, applications, messages, approvals, balances, files, orders, permissions, statuses, and operations on those things.

The central thesis of the Semantic Website Compiler is therefore:

> **Compile raw computer interfaces into a typed, task-conditioned semantic representation of the underlying application, then plan against that representation and execute through a deterministic, verified runtime.**

The target architecture is:

```text
Website / Application
        ↓
Observation
        ↓
Semantic Compilation
        ↓
Typed Semantic State + Operation Graph
        ↓
Task Planning
        ↓
Deterministic Execution
        ↓
Verification
        ↓
Recovery / Learning
```

Or, even more succinctly:

```text
website → semantic graph → planner → deterministic executor → verifier
```

This distinction matters enormously.

We are not trying to build a model that becomes increasingly good at clicking buttons.

We are trying to make clicking buttons increasingly irrelevant to the reasoning process.

---

# 1. A Website Is Not Its DOM

One of the easiest architectural mistakes is to equate a web application with the DOM.

The DOM is merely one observation channel.

A modern application exposes information through many partially overlapping representations:

```text
Pixels / screenshots
DOM
Accessibility tree
JavaScript application state
URLs and navigation state
Cookies / browser storage
Network requests
Internal and public APIs
Forms and events
Historical interaction traces
```

Each source contains information the others may not.

A visually rendered table may have poor DOM semantics.

An accessibility node may tell us that an element is a button but not what business operation the button initiates.

A network request may reveal an internal entity ID that is invisible to the user.

A screenshot may expose grouping, hierarchy, disabled state, warnings, badges, and spatial relationships that are difficult to infer from HTML alone.

The job of the compiler frontend is to fuse these observations into a more useful intermediate representation.

The system therefore should not ask:

> What HTML is currently visible?

It should ask:

> What application state does this evidence imply?

---

# 2. The Compiler Mental Model

The compiler analogy should be taken seriously rather than used merely as branding.

A traditional compiler turns messy source syntax into progressively more structured intermediate representations before finally lowering them into machine instructions.

The Semantic Website Compiler should work similarly.

## Pass 1: Observation and normalization

Raw inputs:

```text
DOM
AX tree
screenshot
browser state
network state
application state
prior interaction trace
```

become a normalized interface representation.

At this stage we care about things such as:

```text
visible controls
text
roles
bounding boxes
input states
form relationships
tables
lists
navigation
modals
element identifiers
network-backed entities
```

This is still close to the interface.

## Pass 2: Semantic lifting

The compiler then tries to answer a substantially more important question:

> What does this interface mean?

A row becomes an invoice.

A collection of fields becomes a customer record.

A badge becomes an invoice status.

A button becomes an affordance such as `send_reminder`.

A modal becomes a confirmation step for an operation.

Instead of reasoning about elements, we begin reasoning about entities and state.

## Pass 3: Operation discovery

The compiler determines what operations appear possible in the current state.

Examples:

```text
open_customer
edit_customer
create_invoice
send_invoice
send_reminder
approve_expense
upload_document
submit_application
archive_conversation
```

These operations have types, inputs, preconditions, effects, and verification requirements.

## Pass 4: Task conditioning

We do not need a perfect ontology of Salesforce before completing one Salesforce task.

Compilation should therefore be task-conditioned.

If the task is:

> Send reminders for every overdue Northstar invoice.

the compiler should aggressively prioritize:

```text
customer entities
invoice entities
invoice ownership
due date
payment status
reminder affordances
confirmation state
```

and largely ignore unrelated portions of the application.

This keeps the representation small, cheap, and interpretable.

## Pass 5: Planning

The planner operates primarily on semantic objects and operations.

It might produce:

```text
find_customer("Northstar")
list_invoices(customer="Northstar")
filter(status="overdue")
for each invoice:
    send_reminder(invoice)
```

Notice what is absent.

No XPath.

No button coordinates.

No CSS selectors.

No screenshot reasoning.

Those are execution concerns.

## Pass 6: Lowering

Only when an operation is ready to execute do we lower it into a website-specific implementation.

For example:

```text
send_reminder(invoice_481)
```

might lower to:

```text
API call
```

or:

```text
DOM interaction
```

or:

```text
accessibility-tree interaction
```

or:

```text
visual click
```

depending on which execution path is available, permitted, and reliable.

This is the equivalent of compiling an intermediate representation into target-specific instructions.

---

# 3. The Semantic Graph

The heart of the system is the semantic representation.

A useful graph should capture at least:

```text
Entities
Properties
Relationships
State
Affordances
Operations
Effects
Provenance
Confidence
```

Consider a webpage containing an invoice.

The browser may expose:

```html
<tr>
  <td>481</td>
  <td>Northstar</td>
  <td>$4,200</td>
  <td class="red">Overdue</td>
  ...
</tr>
```

The semantic compiler should produce something closer to:

```text
Invoice #481
    belongs_to → Northstar
    amount → $4,200
    status → overdue
    supports_action → send_reminder
```

The important transformation is:

```text
interface structure
        ↓
application meaning
```

Once that transformation happens, planning becomes dramatically easier.

The planner no longer needs to rediscover what every table cell means during every action.

---

# 4. Operations Are First-Class Objects

One of the strongest ideas from our earlier discussions was that actions themselves should become typed objects.

An operation should not simply mean:

```text
click(button)
```

An operation should have a contract.

Conceptually:

```yaml
name: send_invoice_reminder

inputs:
  invoice_id: InvoiceID

preconditions:
  - invoice.exists
  - invoice.status == overdue
  - user.can_contact_customer

effects:
  - reminder.created
  - customer_notified

postconditions:
  - activity_log_contains_reminder

permissions:
  level: external_communication

approval:
  required_if: amount > configured_threshold

idempotency:
  duplicate_window: 24h

execution_paths:
  - api
  - browser_dom
  - browser_visual

recovery:
  - recompile_current_view
  - find_alternate_grounding
  - request_human_review

verification:
  - inspect_activity_log
  - inspect_network_response
```

The exact serialization format is secondary.

The conceptual contract is what matters.

Every important operation should answer:

1. What inputs does this operation require?
2. Under what conditions is it valid?
3. What state change should it cause?
4. What unintended side effects can occur?
5. What permissions are required?
6. Can executing it twice cause damage?
7. How do we know it actually worked?
8. How can we recover if something unexpected happens?

This transforms browser automation from a sequence of gestures into something much closer to a transactional system.

---

# 5. Planning and Execution Must Be Separated

This is probably the single most important architectural boundary.

LLMs are useful for:

```text
interpretation
ambiguity resolution
semantic inference
planning
exception handling
```

They are much worse as a replacement for a deterministic runtime.

A weak architecture looks like:

```text
LLM:
observe screen
decide click
click
observe screen
decide click
click
observe screen
...
```

Every interaction becomes another inference call.

State is repeatedly reconstructed.

Small errors accumulate.

Latency compounds.

Costs compound.

Reliability becomes dependent on the language model never becoming confused.

The Semantic Website Compiler should instead behave more like:

```text
LLM / semantic system:
understand task
understand application state
construct operation plan

Runtime:
execute operation
execute operation
execute operation
verify
```

Reason at semantic boundaries.

Execute deterministically between those boundaries.

Then replan only when reality diverges from expectation.

This creates an important operating principle:

> **Compile once, execute many. Recompile on divergence.**

That is where a large fraction of the potential speed and cost improvement comes from.

---

# 6. Grounding Should Happen as Late as Possible

Another important principle is what we called reasoning semantically and grounding at the last possible moment.

Consider:

```text
Semantic intention:
    Send invoice reminder

Reusable operation:
    send_reminder(invoice)

Website implementation:
    open kebab menu
    click "Send reminder"
    confirm modal
```

The first two layers should remain relatively stable even if the website changes its UI.

The third may change constantly.

Keeping these layers separate lets us reuse reasoning while replacing only the fragile website-specific execution mapping.

This leads naturally to three levels:

```text
1. Semantic intention
2. Reusable operation
3. Website-specific execution
```

A general computer-use agent should attempt to generalize heavily at levels one and two while accepting that some specialization at level three is unavoidable.

---

# 7. Verification Is Not Optional

Many browser agents treat successful interaction as evidence of successful completion.

That is a serious reliability mistake.

Clicking "Submit" does not mean the form was submitted.

A network timeout may have occurred.

A validation error may have appeared elsewhere on the page.

A modal may have remained open.

Authentication may have expired.

A duplicate request may have been rejected.

The runtime should therefore reason explicitly about expected state transitions.

Before acting:

```text
State A
```

The system predicts:

```text
operation O
        ↓
expected State B
```

After acting, it observes the application again and asks:

```text
Did State B actually occur?
```

This is prediction-before-action.

Every meaningful operation should produce an execution receipt containing evidence.

Conceptually:

```text
ExecutionReceipt
    operation
    inputs
    timestamp
    execution_path
    observations_before
    observations_after
    expected_effects
    verified_effects
    confidence
    side_effects
    recovery_taken
```

This makes failures diagnosable and creates training data for later improvement.

The standard for completion should be:

> Do not verify the gesture. Verify the consequence.

---

# 8. Recovery Should Be Local, Not Catastrophic

Interfaces change.

Selectors break.

Buttons move.

Experiments change layouts.

Permissions change.

Popups appear.

Session state expires.

A robust system therefore cannot assume that compiled execution paths remain valid forever.

But the opposite extreme is also bad.

If one selector fails, we should not throw away all accumulated knowledge and ask an expensive model to rediscover the entire application.

Recovery should be hierarchical.

For example:

```text
1. Retry deterministic grounding
2. Search equivalent semantic element
3. Reobserve affected interface region
4. Recompile affected operation grounding
5. Try alternate execution path
6. Replan operation
7. Escalate to human
```

The important concept is **local recompilation**.

If the "Send Reminder" button moves, the semantics of invoices do not suddenly become invalid.

Repair the smallest layer that broke.

---

# 9. Self-Healing Must Be Evidence-Based

"Self-healing automation" sounds attractive, but careless self-healing can make systems more dangerous.

Suppose:

```text
button[data-testid="send-reminder"]
```

disappears.

The system finds another red button labeled "Send."

Blindly replacing the selector could produce catastrophic behavior.

Repair should therefore involve semantic and causal evidence.

A candidate replacement should be tested against:

```text
context
role
surrounding entity
expected effect
historical traces
postcondition verification
```

High-risk operations should require stronger evidence before a repaired grounding becomes persistent.

Self-healing should mean:

> Detect drift, infer a candidate repair, execute safely, verify the result, then update the compiled representation.

It should not mean:

> Find something that looks vaguely similar and hope.

---

# 10. Execution Should Be Multi-Path

The browser UI should not become a religion.

Sometimes the most reliable way to execute an operation is:

```text
public API
```

Sometimes:

```text
observed network request
```

Sometimes:

```text
DOM / accessibility interaction
```

Sometimes:

```text
visual computer use
```

Sometimes:

```text
desktop automation
```

And sometimes:

```text
human approval or intervention
```

The operation should exist independently of its execution mechanism.

Conceptually:

```text
Operation
    ↓
Execution Router
    ├── API
    ├── Browser
    ├── Desktop
    └── Human
```

This was part of the broader idea we previously called **Verified Action Infrastructure**.

The long-term asset is not a giant collection of selectors.

It is a library of typed, permissioned, self-healing operations whose execution can be routed through the best available mechanism.

---

# 11. The System Should Learn Causal State Transitions

A major step beyond traditional imitation learning is to train the system to understand what actions cause.

Instead of merely learning:

```text
when screen looks like X → click location Y
```

we want:

```text
given semantic state S
operation A
predict semantic state S'
```

This creates better generalization because many applications implement the same business transition differently.

Examples:

```text
draft → submitted
unpaid → paid
unapproved → approved
open → closed
unassigned → assigned
cart → order
candidate → interviewed
```

UI differences become secondary.

A useful training task is therefore:

> Given the current semantic state and a candidate action, predict the resulting semantic state.

The verifier can later compare that prediction against reality.

This joins planning, execution, verification, and learning into the same causal model.

---

# 12. Reusable Skills Should Be Compositional

The system should avoid storing entire workflows as giant opaque trajectories.

Instead, workflows should decompose into reusable semantic operations.

For example:

```text
find_record
open_record
filter_collection
extract_fields
update_field
upload_document
submit_form
send_message
verify_status
```

Then:

```text
"Process insurance application"
```

might compile into a composition of these operations.

The distinction from ordinary "agent skills" matters.

A skill should preferably have:

```text
typed inputs
typed outputs
known preconditions
known effects
verification
recovery behavior
```

rather than being a natural-language paragraph telling an agent what it usually does.

Natural-language SOPs are useful for bootstrapping.

Compiled operations are what make execution reliable.

---

# 13. Memory Should Exist at Multiple Timescales

The system needs several kinds of memory, and they should not be conflated.

### Runtime state

What is happening right now?

```text
current application
current user
current task
current entity
current workflow position
```

### Session history

What actions have occurred during this task?

Useful for:

```text
recovery
duplicate prevention
context
auditability
```

### Application memory

What have we learned about this software?

```text
entity schemas
operations
navigation
groundings
known failure modes
UI versions
```

### Cross-application semantic memory

What abstractions transfer across software?

For example:

```text
customer
invoice
approval
message
document
submission
status transition
```

The long-term opportunity is increasingly to move knowledge upward from:

```text
website-specific interaction
```

toward:

```text
reusable operational semantics
```

---

# 14. Task Conditioning Prevents the Semantic Graph From Becoming a Science Project

There is a temptation to compile an entire application into a perfect knowledge graph.

That would likely be expensive, slow, brittle, and unnecessary.

A compiler should produce the representation necessary for the requested task.

Suppose the application contains:

```text
CRM
billing
analytics
support
marketing
admin
```

but the user requests:

> Update Sarah's phone number.

There is no reason to fully model the analytics system.

Task conditioning lets the compiler construct the relevant semantic slice.

We can think of compilation as:

```text
compile(application, task, history)
    → relevant_semantic_state
```

rather than:

```text
compile(application)
    → complete_world_model
```

This difference is crucial if we want the system to remain economical.

---

# 15. The Planner Should Operate on an API-Like World

A successful semantic representation should make an application feel almost as though it exposes an API even when it does not.

Instead of:

```text
click("Accounts")
wait()
find("Northstar")
click(row[3])
```

the planner should effectively perceive:

```text
accounts.search(name="Northstar")
accounts.open(account_id)
```

That does not necessarily mean the website literally exposes those endpoints.

It means the compiler has created an API-like abstraction.

This gives us the important commercial and technical framing:

> **Turn software interfaces into usable operational interfaces for agents.**

Or more ambitiously:

> **Compile authenticated applications into versioned, typed, verifiable operation graphs.**

---

# 16. Versioning Is Important

Compiled application knowledge should have versions.

The system should be able to represent:

```text
ApplicationSchema v17
OperationGrounding v31
ObservedUIVersion abc123
```

because web applications evolve.

Versioning allows us to know:

```text
what changed
what was previously working
what operations depend on the changed region
whether a regression is global or local
whether cached execution remains safe
```

Without versioning, "learning" can easily turn into a mutable pile of undocumented heuristics.

---

# 17. Determinism Should Be Maximized, Not Worshipped

The deterministic core is a means, not an ideology.

Some environments genuinely contain ambiguity.

The goal should therefore be:

> Push probabilistic reasoning toward interpretation boundaries and keep known execution paths deterministic wherever possible.

A healthy architecture looks approximately like:

```text
Ambiguous world
      ↓
Probabilistic interpretation
      ↓
Typed representation
      ↓
Deterministic execution
      ↓
Probabilistic anomaly detection when necessary
      ↓
Deterministic verification where possible
```

We should not ask an LLM to reason about something that a type checker, state machine, schema validator, database, or simple program can determine perfectly.

Likewise, we should not force brittle deterministic rules onto genuinely ambiguous visual or linguistic situations.

The advantage comes from putting each technique where it belongs.

---

# 18. Safety and Permissions Belong Inside the Operation Model

High-reliability agents cannot bolt safety on at the end.

Operations need explicit risk semantics.

Examples:

```text
read_customer
risk: low

modify_customer
risk: medium

send_external_email
risk: medium

issue_refund
risk: high

delete_account
risk: critical
```

Operations should expose information such as:

```text
required_permissions
approval_rules
maximum_value
recipient constraints
allowed domains
reversibility
```

This also enables humans to grant agents capabilities rather than simply handing them unrestricted browser sessions.

That is much closer to how mature operating systems and databases manage authority.

---

# 19. Idempotency and Duplicate Prevention Are Core Reliability Features

Computer-use agents frequently operate in uncertain environments.

A timeout after clicking "Send" raises an unpleasant question:

> Did the request fail, or did the request succeed and the confirmation fail?

Retrying blindly may send two emails, place two orders, submit two forms, or create duplicate records.

The runtime therefore needs idempotency semantics.

Before retrying, it should attempt to determine whether the intended effect has already occurred.

This is one reason state verification and semantic entities are so important.

We cannot build reliable long-running automation out of:

```text
try:
    click()
except:
    click_again()
```

---

# 20. Evaluation Must Measure the Architecture We Actually Care About

Traditional browser benchmarks can overemphasize whether an agent happened to complete a task once.

We need more diagnostic metrics.

### Semantic compilation

```text
entity extraction accuracy
relationship accuracy
affordance accuracy
state accuracy
operation inference accuracy
```

### Execution

```text
operation success rate
grounding success rate
latency
cost
deterministic replay success
```

### Verification

```text
false success rate
false failure rate
postcondition accuracy
```

False success is especially dangerous.

An agent that believes a failed payment succeeded is worse than an agent that admits uncertainty.

### Recovery

```text
recovery success
local repair success
UI drift tolerance
mean operations between human interventions
```

### Generalization

Evaluation should deliberately vary:

```text
layouts
copy
theme
viewport
ordering
DOM structure
navigation
A/B experiments
application versions
```

The system should be rewarded for preserving semantics across these changes.

### End-to-end economics

Ultimately we also care about:

```text
task success
task latency
cost per successful task
human interventions per task
compile cost amortized across executions
```

A compiler architecture is only interesting if compilation pays for itself.

---

# 21. Important Training Techniques

Several techniques naturally follow from this architecture.

## Prediction before action

Predict the semantic state transition an operation should cause before executing it.

## Domain randomization

Vary layouts and visual implementations while preserving semantic meaning so models cannot simply memorize superficial UI structure.

## Compositional training

Train reusable atomic and mid-level operations, then evaluate novel compositions of them.

## Exploration

Allow agents in safe or sandboxed environments to test affordances and infer what actions do.

## Verifier-grounded learning

Use verified outcomes, not merely recorded clicks, as training signals.

A trajectory should be considered successful because the intended state transition occurred, not because it resembled a demonstration.

## Out-of-distribution evaluation

Test on interfaces, versions, workflows, and combinations not present in training.

Otherwise we risk convincing ourselves that memorization is generalization.

---

# 22. What We Should Explicitly Avoid

Several architectures superficially resemble the Semantic Website Compiler while violating its core thesis.

## Anti-pattern 1: LLM controls every click

```text
observe → LLM → click → observe → LLM → click
```

Useful as a fallback or bootstrap mechanism.

Bad as the permanent architecture.

## Anti-pattern 2: Giant DOM dump

Sending an enormous HTML tree to a model is not semantic compilation.

It is merely expensive context stuffing.

## Anti-pattern 3: Selector collection disguised as semantics

A database containing:

```text
send_button = "#button-714"
```

is not an operation graph.

It contains grounding information but no meaning.

## Anti-pattern 4: Workflow macros

Recording 47 clicks and replaying them is automation, but it is not semantic automation.

## Anti-pattern 5: Trusting UI acknowledgments

A toast saying "Success" should not automatically satisfy a business-level postcondition.

## Anti-pattern 6: Unbounded self-healing

The agent should not silently rewrite high-risk execution behavior merely because something changed.

## Anti-pattern 7: Natural-language skills without contracts

Natural language helps humans describe intent.

It should not substitute for typed operation semantics when reliability matters.

---

# 23. Suggested Core Types in the Repository

Regardless of implementation language, the repository should make the conceptual boundaries obvious.

At minimum, the architecture should have first-class equivalents of:

```text
Observation

SemanticEntity

SemanticState

Relationship

Affordance

OperationSpec

OperationPlan

Grounding

ExecutionResult

ExecutionReceipt

VerificationResult

RecoveryDecision

Trace
```

One possible separation is:

```text
observer/
    Collect raw evidence.

compiler/
    Transform observations into semantic IR.

ir/
    Canonical typed semantic representations.

planner/
    Turn user intent into semantic operation plans.

operations/
    Define reusable operation contracts.

grounding/
    Lower semantic operations into executable targets.

runtime/
    Deterministically execute plans.

verifier/
    Check actual versus expected effects.

recovery/
    Handle divergence and local recompilation.

memory/
    Store application-specific and reusable knowledge.

learning/
    Convert traces and verified executions into improved models.

evals/
    Measure compilation, execution, verification,
    recovery, drift robustness, and end-to-end reliability.
```

The precise directory names can change.

The boundaries should not.

---

# 24. The Runtime Loop

A canonical execution loop should look approximately like:

```text
observe
↓
compile semantic state
↓
plan semantic operations
↓
select next operation
↓
check preconditions
↓
select execution path
↓
ground operation
↓
predict expected state transition
↓
execute deterministically
↓
observe result
↓
verify postconditions
↓
record receipt
↓
continue
```

If verification fails:

```text
classify divergence
↓
attempt local recovery
↓
recompile affected state
↓
reground operation
↓
retry safely if permitted
↓
otherwise replan
↓
otherwise escalate
```

This loop should be one of the most stable conceptual contracts in the entire codebase.

---

# 25. Where Models Should Actually Be Used

The architecture is not anti-model.

It is anti-unnecessary-model.

Models are especially valuable for:

```text
semantic interpretation
entity linking
page-purpose inference
affordance inference
operation discovery
ambiguous grounding
task decomposition
exception classification
repair proposals
cross-application abstraction
```

Models are less valuable when the answer is already known.

Once we know:

```text
Operation:
send_reminder(invoice_481)

Grounding:
known

Preconditions:
satisfied

Expected postcondition:
known
```

we generally should not ask a large model to decide what to do again.

The compiler should progressively convert uncertainty into executable knowledge.

That is arguably the deepest principle behind the entire project.

---

# 26. The Compounding Asset

A normal agent starts almost from scratch every time.

A semantic compiler should accumulate knowledge.

The first execution on an application may be expensive:

```text
observe
interpret
discover
ground
verify
```

The hundredth execution should increasingly resemble:

```text
load compiled schema
confirm current version
execute known operation
verify
```

When the application changes:

```text
detect affected region
repair affected grounding
continue
```

This creates the possibility of a compounding reliability advantage.

The product gets better not merely because the foundation model gets better, but because the system progressively converts probabilistic exploration into reusable deterministic infrastructure.

---

# 27. The Larger Product Thesis

There are several related formulations of the idea, and we should preserve their hierarchy rather than mixing them together.

The narrow technical formulation is:

> **Compile authenticated web applications into versioned, typed, verifiable operation graphs that run through a deterministic runtime and can repair themselves when the underlying application changes.**

The broader platform formulation is:

> **Observe repeated computer work, identify the reusable operations hidden inside it, and progressively compile those operations into reliable automation.**

The infrastructure formulation is:

> **Verified Action Infrastructure: typed, permissioned, self-healing operations with explicit preconditions, postconditions, authorization, recovery, verification, and audit receipts.**

These are not competing ideas.

They are layers of the same thesis.

The Semantic Website Compiler discovers and constructs the operational model.

The operation graph represents that model.

The runtime executes it.

The verifier determines whether reality matches our expectations.

The learning system improves the compiler and operation library.

Together they form infrastructure for reliable action in external software.

---

# 28. The Standard We Should Hold the Repository To

Whenever we make an architectural decision, we should ask:

### Does reasoning happen at the semantic level?

or are we accidentally reasoning about selectors and pixels?

### Are operations typed?

or are they merely sequences of interactions?

### Are planning and execution separated?

or does an LLM control every microscopic action?

### Are outcomes verified?

or do we assume execution means success?

### Can knowledge be reused?

or does every task begin from scratch?

### Is UI-specific information isolated?

or has website-specific logic leaked through the entire system?

### Can the system detect divergence?

or does it fail silently when the interface changes?

### Can it repair the smallest broken abstraction?

or must it rediscover the entire workflow?

### Is uncertainty explicit?

or do we quietly convert guesses into facts?

### Does successful execution generate reusable knowledge?

or is every trajectory immediately forgotten?

If the repository cannot answer these questions clearly, it is probably drifting away from the original thesis.

---

# 29. The Principle to Remember

If only one idea survives, it should be this:

> **The purpose of the Semantic Website Compiler is to progressively turn an uncertain visual-computing problem into a typed software-execution problem.**

At the beginning, the system may know almost nothing.

It sees pixels, DOM nodes, text, controls, requests, and partial state.

Through observation and inference, it constructs meaning.

Through interaction, it discovers operations.

Through verification, it learns their effects.

Through repeated successful executions, it converts those discoveries into reusable operational infrastructure.

So the progression is:

```text
pixels
→ elements
→ entities
→ state
→ operations
→ typed plans
→ deterministic execution
→ verified state transitions
→ reusable compiled knowledge
```

That progression is the Semantic Website Compiler.

The final goal is not a browser agent that is extraordinarily good at using websites like a human.

The stronger goal is a system that learns enough about software that it increasingly **does not need to behave like a human at all**.
