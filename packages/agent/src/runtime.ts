import type { Page } from 'playwright';
import { setTimeout as pollDelay } from 'node:timers/promises';
import { createGuardedActor, SafetyBlocked, type BenignPolicy } from '@juno/browser';
import { compileSite, OperationContractSchema, SiteKnowledgeStore, type OperationContract } from '@juno/knowledge';
import { confinePage, validateBoundary, type SiteBoundary } from './boundary.js';
import { EffectObservationSchema, TaskPlanSchema, hash, type EffectObservation, type RunReceipt, type TaskPlan } from './contracts.js';
import { RunStore } from './store.js';
import { validateInputs } from './inputs.js';

export interface TrustedOperation {
  contract: OperationContract;
  /** Host-reviewed text parameter carrying a durable application-level idempotency key. */
  requestKey: string;
  /** Host-reviewed JSON request. Only this step can receive a one-shot network write grant. */
  request?: { step: number; path: string; body(context: { key: string; inputs: Readonly<Record<string, string | boolean>> }): unknown };
  /** Must inspect authoritative application state, not a success toast or action completion. */
  verify(context: { key: string; inputs: Readonly<Record<string, string | boolean>>; signal: AbortSignal }): Promise<EffectObservation>;
}
export interface RuntimeOptions {
  owner: string; knowledge: SiteKnowledgeStore; runs: RunStore; boundary: SiteBoundary;
  operations: readonly TrustedOperation[];
  /** Separate host authority. Risk labels in a saved model do not grant permissions. */
  benignPolicies?: readonly BenignPolicy[];
  /** A fresh dedicated context, service workers blocked. Never a daily browser profile. */
  openBrowser(): Promise<{ page: Page; close(): Promise<void> }>;
  timeoutMs?: number;
}
type Failure = NonNullable<RunReceipt['failure']>;
class Divergence extends Error { constructor(readonly kind: Failure) { super(kind); } }

/** Deterministic execution boundary for typed plans; no model calls or page-instruction tools. */
export class AgentRuntime {
  private readonly trusted: Map<string, TrustedOperation>;
  constructor(private readonly options: RuntimeOptions) {
    validateBoundary(options.boundary);
    this.trusted = new Map(options.operations.map(operation => {
      const contract = OperationContractSchema.parse(operation.contract);
      const field = contract.inputs[operation.requestKey];
      if (!field || field.kind !== 'text' || field.maxLength < 64 || contract.effects.some(effect => effect.key !== operation.requestKey)) throw new Error('Operations require a reviewed request-key field and matching effects');
      if (operation.request && (!Number.isInteger(operation.request.step) || operation.request.step < 0 || operation.request.step >= contract.steps.length || !options.boundary.writePaths?.includes(operation.request.path))) throw new Error('Invalid trusted write request');
      return [contract.id, { ...operation, contract }];
    }));
    if (this.trusted.size !== options.operations.length) throw new Error('Duplicate trusted operation');
    if (options.timeoutMs !== undefined && (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 100 || options.timeoutMs > 120_000)) throw new Error('Invalid execution deadline');
  }

  async run(value: unknown, options: { signal?: AbortSignal } = {}): Promise<RunReceipt> {
    const plan = TaskPlanSchema.parse(value), host = this.options;
    const release = host.runs.acquire();
    try { return await this.execute(plan, options.signal); }
    finally { release(); }
  }

  private async execute(plan: TaskPlan, external?: AbortSignal): Promise<RunReceipt> {
    const host = this.options, boundary = validateBoundary(host.boundary);
    // Validate the entire task before opening a browser or doing the first operation.
    const operations = plan.steps.map(step => {
      const operation = this.trusted.get(step.operation);
      if (!operation) throw new Error('Task references an unregistered host operation');
      validateInputs(operation.contract, operation.requestKey, step.inputs);
      return operation;
    });
    const normalized = { ...plan, steps: plan.steps.map(step => ({ ...step, inputs: Object.fromEntries(Object.entries(step.inputs).sort(([a], [b]) => a.localeCompare(b))) })) };
    const manifestHash = hash({ owner: host.owner, origin: boundary.origin, plan: normalized, contracts: operations.map(operation => hash(operation.contract)) });
    let receipt = host.runs.get(plan.id);
    if (receipt && receipt.manifestHash !== manifestHash) throw new Error('Request ID already belongs to a different task, inputs, owner or contract');
    if (receipt?.status === 'verified') return receipt;
    const model = host.knowledge.latest(host.owner, boundary.origin);
    if (!model || model.version !== plan.modelVersion || model.pages.some(page => !boundary.routes.includes(page.route)) || operations.some(operation => !model.operations.some(saved => saved.contract.id === operation.contract.id && saved.contractVersion === hash(operation.contract)))) throw new Error('Saved knowledge is missing or changed; explicitly compile and plan again');

    const now = () => new Date().toISOString();
    receipt ??= {
      schemaVersion: 1, id: plan.id, manifestHash, modelVersion: model.version, structuralRevision: model.structuralRevision,
      status: 'running', startedAt: now(), updatedAt: now(), durationMs: 0,
      steps: plan.steps.map((step, index) => ({ id: step.id, operation: step.operation, inputHash: hash(normalized.steps[index]!.inputs),
        contractVersion: hash(operations[index]!.contract), effectKey: hash({ owner: host.owner, origin: boundary.origin, task: plan.id, step: step.id }),
        expected: { source: operations[index]!.contract.verification.source, fields: [...new Set(operations[index]!.contract.effects.flatMap(effect => effect.fields))] },
        status: 'pending', mutationAttempted: false, recovered: false, audit: [] })),
    };
    const result = receipt;
    const save = () => { result.updatedAt = now(); host.runs.put(result); };
    result.status = 'running'; delete result.failure; save();
    const start = performance.now(), previousDuration = result.durationMs;
    const controller = new AbortController();
    let timedOut = false, browser: Awaited<ReturnType<RuntimeOptions['openBrowser']>> | undefined;
    let network: Awaited<ReturnType<typeof confinePage>> | undefined, revokeWrite: (() => void) | undefined;
    const abort = () => { revokeWrite?.(); controller.abort(); void browser?.page.close({ runBeforeUnload: false }).catch(() => {}); };
    const timer = setTimeout(() => { timedOut = true; abort(); }, host.timeoutMs ?? 30_000);
    external?.addEventListener('abort', abort, { once: true });
    const active = () => { if (external?.aborted || controller.signal.aborted) throw new Divergence(timedOut ? 'deadline' : 'cancelled'); };
    let current: RunReceipt['steps'][number] | undefined;
    try {
      active();
      for (const [index, step] of plan.steps.entries()) {
        active();
        current = result.steps[index]!;
        const operation = operations[index]!, contract = operation.contract;
        const inputs = Object.freeze({ ...step.inputs, [operation.requestKey]: current.effectKey });
        const verify = async () => {
          const signal = controller.signal;
          let onAbort: (() => void) | undefined;
          try {
            const cancelled = new Promise<never>((_, reject) => {
              onAbort = () => reject(new Divergence(timedOut ? 'deadline' : 'cancelled'));
              signal.addEventListener('abort', onAbort, { once: true });
            });
            active();
            const observation = EffectObservationSchema.parse(await Promise.race([operation.verify({ key: current!.effectKey, inputs, signal }), cancelled]));
            const fields = contract.effects.flatMap(effect => effect.fields);
            if (observation.source !== contract.verification.source || observation.key !== current!.effectKey ||
                observation.matchedFields.some(field => !Object.hasOwn(contract.inputs, field)) ||
                (observation.status === 'absent' && observation.recordCount !== 0) ||
                (observation.status === 'matched' && (observation.recordCount !== 1 || fields.some(field => !observation.matchedFields.includes(field))))) throw new Divergence('verification-unavailable');
            return observation;
          } catch (error) { if (error instanceof Divergence) throw error; throw new Divergence('verification-unavailable'); }
          finally { if (onAbort) signal.removeEventListener('abort', onAbort); }
        };

        // Reconcile durable application state even after a crash between write and receipt.
        const before = await verify();
        current.verification = before;
        if (before.status === 'matched') {
          current.recovered ||= current.status !== 'verified'; current.status = 'verified'; save(); current = undefined; continue;
        }
        if (current.status === 'verified') current.status = 'uncertain';
        save();
        if (before.status === 'conflict') throw new Divergence('effect-conflict');
        if (before.status === 'unknown') throw new Divergence('verification-unavailable');
        if (current.mutationAttempted || current.recovered) throw new Divergence('effect-unverified');
        current.status = 'running'; save();
        if (!browser) {
          browser = await host.openBrowser(); active();
          network = await confinePage(browser.page, boundary, 'execute');
        }
        const page = browser.page;
        const expectedUrl = `${boundary.origin}${contract.pageRoute}`;
        if (!boundary.routes.includes(contract.pageRoute)) throw new Divergence('stale-model');
        await page.goto(expectedUrl, { waitUntil: 'load', timeout: 8000 }); active();
        if (page.url() !== expectedUrl) throw new Divergence('grounding');
        let activeStep = -1;
        const { actor } = createGuardedActor(page, {
          runId: result.id, benignPolicies: host.benignPolicies,
          audit: async entry => {
            if (entry.status === 'started' && entry.risk !== 'read') current!.mutationAttempted = true;
            current!.audit.push(entry); save();
            if (entry.status === 'started' && entry.risk !== 'read' && operation.request?.step === activeStep) {
              revokeWrite = network!.permitWrite({ route: contract.pageRoute, path: operation.request.path, body: operation.request.body({ key: current!.effectKey, inputs }) });
            }
            if (['failed', 'blocked', 'aborted'].includes(entry.status)) revokeWrite?.();
          }, timeoutMs: 2500,
        });
        try {
          const observed = compileSite({ origin: boundary.origin, pages: [{ route: contract.pageRoute, tree: await actor.read() }], operations: [contract] }).pages[0]!;
          current.before = { route: observed.route, fingerprint: observed.fingerprint, targets: observed.elements.length }; save();
        } catch { active(); throw new Divergence('grounding'); }
        for (const [index, action] of contract.steps.entries()) {
          activeStep = index;
          active();
          // Knowledge may be forgotten or replaced while a task is awaiting a browser action.
          if (host.knowledge.latest(host.owner, boundary.origin)?.version !== model.version) throw new Divergence('stale-model');
          if (page.url() !== expectedUrl) throw new Divergence('grounding');
          const input = action.parameter ? inputs[action.parameter] : undefined;
          switch (action.method) {
            case 'click': await actor.click(action.target); break;
            case 'fill': await actor.fill(action.target, input as string); break;
            case 'selectOption': await actor.selectOption(action.target, input as string); break;
            case 'check': await actor.check(action.target, input as boolean); break;
          }
        }
        active();
        // A bounded snapshot is useful evidence, but never the source of success authority.
        try {
          const observed = compileSite({ origin: boundary.origin, pages: [{ route: contract.pageRoute, tree: await actor.read() }] }).pages[0]!;
          current.after = { route: observed.route, fingerprint: observed.fingerprint, targets: observed.elements.length }; save();
        } catch { /* A submit may navigate; independent state still decides the outcome. */ }
        let after = await verify();
        const verificationDeadline = performance.now() + 1500;
        while (['absent', 'unknown'].includes(after.status) && performance.now() < verificationDeadline) {
          // Retry only the independent read, never the browser mutation.
          await pollDelay(50, undefined, { signal: controller.signal }); active();
          after = await verify();
        }
        current.verification = after;
        if (after.status !== 'matched') throw new Divergence(after.status === 'conflict' ? 'effect-conflict' : 'effect-unverified');
        revokeWrite?.(); revokeWrite = undefined;
        current.status = 'verified'; save(); current = undefined;
      }
      active(); result.status = 'verified';
    } catch (error) {
      const kind: Failure = external?.aborted || controller.signal.aborted ? timedOut ? 'deadline' : 'cancelled'
        : error instanceof Divergence ? error.kind : error instanceof SafetyBlocked ? 'confirmation-required' : 'browser';
      result.failure = kind;
      result.status = current?.mutationAttempted || current?.recovered ? 'uncertain' : 'blocked';
      if (current) current.status = result.status;
    } finally {
      revokeWrite?.();
      clearTimeout(timer); external?.removeEventListener('abort', abort);
      try { await browser?.close(); }
      finally { result.durationMs = previousDuration + performance.now() - start; save(); }
    }
    return result;
  }
}
