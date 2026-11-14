import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { BrowserSession, type BenignPolicy, type SemanticRef } from '@juno/browser';
import { SiteKnowledgeStore, type OperationContract } from '@juno/knowledge';
import { AgentRuntime, RunStore, observeSite, type TaskPlan, type TrustedOperation } from '../src/index.js';
import { RecordsSchema } from './fixture.js';

export const owner = createHash('sha256').update('juno-owned-contact-workspace').digest('hex');
const target = (form: string, role: string, name: string) => ({ role, name, exact: true as const, scopeChain: [{ role: 'form', name: form, exact: true as const }] });
const text = (maxLength: number) => ({ kind: 'text' as const, required: true as const, maxLength });
function contract(kind: 'contact' | 'followup'): OperationContract {
  const contact = kind === 'contact', form = contact ? 'Create contact' : 'Add follow-up';
  const bindings: [string, SemanticRef, 'fill' | 'check' | 'selectOption'][] = contact ? [
    ['person_name', target(form, 'textbox', 'Contact name'), 'fill'],
    ['contact_email', target(form, 'textbox', 'Contact email'), 'fill'],
    ['category', target(form, 'combobox', 'Category'), 'selectOption'],
    ['subscribed', target(form, 'checkbox', 'Subscribed'), 'check'],
  ] : [
    ['contact_email', target(form, 'textbox', 'Contact email'), 'fill'],
    ['note', target(form, 'textbox', 'Follow-up note'), 'fill'],
    ['due_date', target(form, 'textbox', 'Follow-up date'), 'fill'],
  ];
  bindings.push(['request_id', target(form, 'textbox', 'Request ID'), 'fill']);
  const submit = target(form, 'button', contact ? 'Save contact' : 'Save follow-up');
  return {
    id: contact ? 'contacts.create' : 'followups.add', risk: 'write-benign',
    pageRoute: contact ? '/contacts/new.html' : '/follow-ups/new.html',
    inputs: contact ? {
      person_name: text(100), contact_email: text(200), category: { kind: 'enum', required: true, maxLength: 20, choices: ['Research', 'Partner'] },
      subscribed: { kind: 'boolean', required: true, maxLength: 1 }, request_id: text(64),
    } : { contact_email: text(200), note: text(1000), due_date: { kind: 'calendar-date', required: true, maxLength: 10 }, request_id: text(64) },
    preconditions: [...bindings.map(([, identity]) => identity), submit].map(identity => ({ kind: 'unique-enabled', target: identity as OperationContract['steps'][number]['target'] })),
    steps: [...bindings.map(([parameter, identity, method]) => ({ method, target: identity as OperationContract['steps'][number]['target'], parameter })), { method: 'click', target: submit }],
    effects: [{ kind: 'record-matches-inputs', source: 'contact-workspace.records', key: 'request_id', fields: bindings.map(([name]) => name).filter(name => name !== 'request_id'), unique: true }],
    verification: { kind: 'independent-state', source: 'contact-workspace.records', required: true },
  };
}
export const contracts = [contract('contact'), contract('followup')];
export function hostFor(directory: string, origin: string, options: { headless?: boolean; trace?: boolean } = {}) {
  const knowledge = new SiteKnowledgeStore(path.join(directory, 'knowledge'));
  const runs = new RunStore(path.join(directory, 'runs'));
  const boundary = { origin, routes: ['/contacts/index.html', '/contacts/new.html', '/follow-ups/new.html'], readPaths: ['/app.js', '/api/state'], writePaths: ['/api/records'] };
  const operations: TrustedOperation[] = contracts.map((contract, index) => ({
    contract, requestKey: 'request_id',
    request: { step: contract.steps.length - 1, path: '/api/records', body: ({ key, inputs }) => ({
      kind: index === 0 ? 'contact' : 'followup', key, fields: Object.fromEntries(Object.entries(inputs).filter(([name]) => name !== 'request_id')),
    }) },
    verify: async ({ key, inputs, signal }) => {
      const response = await fetch(`${origin}/api/state`, { signal: AbortSignal.any([signal, AbortSignal.timeout(2500)]), redirect: 'error' });
      if (!response.ok) throw new Error('Independent state unavailable');
      const records = RecordsSchema.parse(await response.json()).filter(record => record.key === key);
      const record = records[0];
      const matchedFields = record && record.kind === (index === 0 ? 'contact' : 'followup') ? Object.keys(record.fields).filter(field => record.fields[field] === inputs[field]) : [];
      const matched = records.length === 1 && contract.effects[0]!.fields.every(field => matchedFields.includes(field));
      return { source: contract.verification.source, key, recordCount: records.length, matchedFields, status: matched ? 'matched' : records.length ? 'conflict' : 'absent' };
    },
  }));
  // These permissions come only from the explicit fixture host contracts above.
  const policies: BenignPolicy[] = contracts.flatMap(contract => contract.steps.map((step, index) => ({ id: `owned.${contract.id}.${index}`, origin, pathname: contract.pageRoute, method: step.method, ref: step.target })));
  let serial = 0;
  const openBrowser = async () => {
    const profile = path.join(directory, 'profiles', randomUUID());
    const session = new BrowserSession({ profileDir: profile, headless: options.headless ?? true, channel: process.env.JUNO_AGENT_CHANNEL === 'chromium' ? 'chromium' : 'chrome', serviceWorkers: 'block' });
    try {
      const page = await session.launch();
      const trace = options.trace ? path.join(directory, 'traces', `${++serial}.zip`) : undefined;
      if (trace) { fs.mkdirSync(path.dirname(trace), { recursive: true }); await page.context().tracing.start({ screenshots: true, snapshots: true }); }
      return { page, close: async () => {
        try { if (trace) await page.context().tracing.stop({ path: trace }); }
        finally { await session.close(); fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
      } };
    } catch (error) { await session.close(); fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); throw error; }
  };
  return {
    knowledge, runs, boundary, operations, policies, openBrowser,
    compile: async () => {
      const browser = await openBrowser();
      try { return await observeSite({ page: browser.page, boundary, operations: contracts, store: knowledge, owner }); }
      finally { await browser.close(); }
    },
    runtime: (overrides: Partial<ConstructorParameters<typeof AgentRuntime>[0]> = {}) => new AgentRuntime({ owner, knowledge, runs, boundary, operations, benignPolicies: policies, openBrowser, ...overrides }),
  };
}
export function makePlan(modelVersion: string, inputs: { name?: string; email?: string; note?: string; due?: string } = {}): TaskPlan {
  const email = inputs.email ?? 'ada@example.test';
  return { schemaVersion: 1, id: randomUUID(), modelVersion, steps: [
    { id: 'create-contact', operation: 'contacts.create', inputs: { person_name: inputs.name ?? 'Ada Lovelace', contact_email: email, category: 'Research', subscribed: false } },
    { id: 'add-followup', operation: 'followups.add', inputs: { contact_email: email, note: inputs.note ?? 'Compare semantic browser agents', due_date: inputs.due ?? '2026-11-20' } },
  ] };
}
