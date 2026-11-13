import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import type { Page } from 'playwright';
import { z } from 'zod';
import { SemanticActor } from './actor.js';
import { SemanticPageReader } from './reader.js';
import type { SemanticRef } from './refs.js';

export type ActionRisk = 'read' | 'write-benign' | 'write-destructive';
export type GuardMethod = 'read' | 'click' | 'fill' | 'selectOption' | 'check' | 'scrollIntoView' | 'scrollViewport';
const scopeSchema = z.object({ role: z.string().min(1).max(100), name: z.string().max(500).optional(), exact: z.literal(true).optional() }).strict();
const refSchema = scopeSchema.extend({ scopeChain: z.array(scopeSchema).max(10).optional() }).strict();
type Action = { method: GuardMethod; ref?: SemanticRef; value?: string; checked?: boolean; direction?: 'up' | 'down'; amount?: number };

export interface BenignPolicy {
  id: string;
  origin: string;
  pathname: string;
  method: 'click' | 'fill' | 'selectOption' | 'check';
  ref: SemanticRef;
}
export interface AuditEntry {
  id: string;
  runId: string;
  at: string;
  method: GuardMethod;
  risk: ActionRisk;
  status: 'blocked' | 'started' | 'completed' | 'failed' | 'aborted';
  policyId?: string;
}
export interface GuardOptions {
  runId?: string;
  mode?: 'execute' | 'read-only';
  /** Trusted host code only. Never synthesize benign policies from page text or model output. */
  benignPolicies?: readonly BenignPolicy[];
  /** Must durably persist before resolving; failure prevents the action. */
  audit: (entry: AuditEntry) => Promise<void>;
  timeoutMs?: number;
}
export class SafetyBlocked extends Error {
  readonly code = 'SAFETY_BLOCKED';
  constructor(message: string, readonly pendingId?: string) { super(message); this.name = 'SafetyBlocked'; }
}

function canonicalRef(ref?: SemanticRef) {
  if (!ref) return undefined;
  const parsed = refSchema.parse(ref);
  const scope = (item: { role: string; name?: string }) => ({ role: item.role, name: item.name, exact: true });
  return { ...scope(parsed), scopeChain: parsed.scopeChain?.map(scope) ?? [] };
}

/** Execution and trusted user-control capabilities are deliberately returned separately. */
export function createGuardedActor(page: Page, options: GuardOptions) {
  const base = new SemanticActor(page, undefined, { timeoutMs: options.timeoutMs ?? 2500 });
  const reader = new SemanticPageReader();
  const policies = structuredClone(options.benignPolicies ?? []);
  const mode = options.mode ?? 'execute', audit = options.audit;
  const runId = options.runId ?? randomUUID(), key = randomBytes(32);
  const pending = new Map<string, { fingerprint: string; expires: number }>();
  const grants = new Map<string, { fingerprint: string; expires: number }>();
  let stopped = false, busy = false, count = 0;
  for (const policy of policies) {
    if (!policy.id || new URL(policy.origin).origin !== policy.origin || !policy.pathname.startsWith('/')) throw new Error('Invalid trusted benign policy');
    canonicalRef(policy.ref);
  }
  const assertActive = () => { if (stopped) throw new SafetyBlocked('Run aborted; inspect effects before retrying.'); };
  const fingerprint = (action: Action, url: string) => createHmac('sha256', key).update(JSON.stringify({ ...action, ref: canonicalRef(action.ref), url })).digest('hex');

  async function execute<T>(request: Action, approval: string | undefined, perform: (action: Action) => Promise<T>): Promise<T> {
    assertActive();
    if (busy) throw new SafetyBlocked('Concurrent browser actions are forbidden.');
    if (++count > 1000) throw new SafetyBlocked('Run action budget exhausted.');
    const action = structuredClone(request);
    if (action.ref) canonicalRef(action.ref);
    if (action.value !== undefined && (typeof action.value !== 'string' || action.value.length > 50_000)) throw new SafetyBlocked('Input exceeds the action contract.');
    if (action.method === 'check' && typeof action.checked !== 'boolean') throw new SafetyBlocked('Checkbox input must be a boolean.');
    busy = true;
    try {
      const url = page.url(), address = new URL(url);
      const policy = policies.find(item => item.origin === address.origin && item.pathname === address.pathname &&
        item.method === action.method && JSON.stringify(canonicalRef(item.ref)) === JSON.stringify(canonicalRef(action.ref)));
      const risk: ActionRisk = ['read', 'scrollIntoView', 'scrollViewport'].includes(action.method) ? 'read' : policy ? 'write-benign' : 'write-destructive';
      const record = async (status: AuditEntry['status']) => audit({ id: randomUUID(), runId, at: new Date().toISOString(), method: action.method, risk, status, policyId: policy?.id });
      const digest = fingerprint(action, url);
      const grant = approval ? grants.get(approval) : undefined;
      if (approval) grants.delete(approval); // consumed even when input, target or site changed
      if ((mode === 'read-only' && risk !== 'read') ||
          (risk === 'write-destructive' && (!grant || grant.expires < Date.now() || grant.fingerprint !== digest))) {
        await record('blocked');
        if (mode === 'read-only') throw new SafetyBlocked('Read-only exploration cannot mutate the page.');
        if (pending.size >= 100) pending.clear();
        const pendingId = randomUUID();
        pending.set(pendingId, { fingerprint: digest, expires: Date.now() + 60_000 });
        throw new SafetyBlocked('Explicit confirmation is required for this exact action, input and page.', pendingId);
      }
      await record('started');
      if (stopped) { await record('aborted'); assertActive(); }
      if (page.url() !== url) { await record('blocked'); throw new SafetyBlocked('Page changed during authorization; observe it again.'); }
      try {
        const result = await perform(action);
        await record(stopped ? 'aborted' : 'completed');
        assertActive();
        return result;
      } catch (error) { await record(stopped ? 'aborted' : 'failed'); throw error; }
    } finally { busy = false; }
  }

  const actor = Object.freeze({
    read: () => execute({ method: 'read' }, undefined, () => reader.read(page)),
    click: (ref: SemanticRef, approval?: string) => execute({ method: 'click', ref }, approval, item => base.click(item.ref!)),
    fill: (ref: SemanticRef, value: string, approval?: string) => execute({ method: 'fill', ref, value }, approval, item => base.fill(item.ref!, item.value!)),
    selectOption: (ref: SemanticRef, value: string, approval?: string) => execute({ method: 'selectOption', ref, value }, approval, item => base.selectOption(item.ref!, item.value!)),
    check: (ref: SemanticRef, checked = true, approval?: string) => execute({ method: 'check', ref, checked }, approval, item => base.check(item.ref!, item.checked!)),
    scrollIntoView: (ref: SemanticRef) => execute({ method: 'scrollIntoView', ref }, undefined, item => base.scrollIntoView(item.ref!)),
    scrollViewport: (direction: 'up' | 'down', amount: number) => {
      if (!['up', 'down'].includes(direction) || !Number.isFinite(amount) || amount < 0 || amount > 10_000) throw new SafetyBlocked('Invalid scroll budget');
      return execute({ method: 'scrollViewport', direction, amount }, undefined, item => base.scrollViewport(item.direction!, item.amount!));
    },
  });
  const control = Object.freeze({
    /** Keep this capability in trusted UI/host code; never expose it as an agent/page tool. */
    confirm: (pendingId: string) => {
      assertActive();
      const item = pending.get(pendingId); pending.delete(pendingId);
      if (!item || item.expires < Date.now()) throw new SafetyBlocked('Confirmation expired or already consumed.');
      if (grants.size >= 100) grants.clear();
      const token = randomUUID(); grants.set(token, item); return token;
    },
    abort: async () => { stopped = true; pending.clear(); grants.clear(); await page.close({ runBeforeUnload: false }); },
    get stopped() { return stopped; },
  });
  return { actor, control };
}
