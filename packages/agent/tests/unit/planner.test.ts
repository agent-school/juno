import { describe, expect, it, vi } from 'vitest';
import { compileSite } from '@juno/knowledge';
import { planTask, createChatInterpreter } from '../../src/planner.js';
import { contracts, makePlan } from '../../benchmark/host.js';

function catalog() {
  const model = compileSite({ origin: 'https://owned.invalid', pages: contracts.map(contract => ({ route: contract.pageRoute, tree: { children: [{ role: 'form', name: contract.id === 'contacts.create' ? 'Create contact' : 'Add follow-up', children: contract.preconditions.map(condition => ({ role: condition.target.role, name: condition.target.name, children: [] })) }] } })), operations: contracts });
  const operations = contracts.map(contract => ({ contract, requestKey: 'request_id', verify: vi.fn() }));
  return { model, operations };
}
describe('intent interpretation boundary', () => {
  it('binds a proposal to host task/model IDs and excludes internal request keys from the catalog', async () => {
    const { model, operations } = catalog(), expected = makePlan(model.version);
    const interpret = vi.fn(async request => {
      expect(request.catalog).toHaveLength(2);
      expect(request.catalog[0].inputs).not.toHaveProperty('request_id');
      expect(request).not.toHaveProperty('page');
      return { steps: expected.steps };
    });
    const plan = await planTask({ intent: 'Create the contact and add the follow-up', model, operations, interpret, id: expected.id });
    expect(plan).toEqual(expected);
    expect(interpret).toHaveBeenCalledOnce();
    expect(operations.every(operation => operation.verify.mock.calls.length === 0)).toBe(true);
  });
  it.each(['unknown-operation', 'raw-action', 'internal-key', 'wrong-type', 'bad-date', 'empty', 'duplicate-id'])('rejects untrusted proposal: %s', async attack => {
    const { model, operations } = catalog(), proposal = { steps: makePlan(model.version).steps };
    if (attack === 'unknown-operation') proposal.steps[0]!.operation = 'messages.send';
    if (attack === 'raw-action') Object.assign(proposal.steps[0]!, { selector: '#submit', method: 'click' });
    if (attack === 'internal-key') proposal.steps[0]!.inputs.request_id = 'Injected key';
    if (attack === 'wrong-type') proposal.steps[0]!.inputs.subscribed = 'false';
    if (attack === 'bad-date') proposal.steps[1]!.inputs.due_date = '2026-02-30';
    if (attack === 'empty') proposal.steps = [];
    if (attack === 'duplicate-id') proposal.steps[1]!.id = proposal.steps[0]!.id;
    await expect(planTask({ intent: 'User task', model, operations, interpret: async () => proposal })).rejects.toThrow();
  });
  it('does not call an interpreter when saved and reviewed contracts differ', async () => {
    const { model, operations } = catalog(), interpret = vi.fn();
    operations[0]!.contract = { ...operations[0]!.contract, risk: 'write-destructive' };
    await expect(planTask({ intent: 'User task', model, operations, interpret })).rejects.toThrow('not backed');
    expect(interpret).not.toHaveBeenCalled();
  });
  it('honors pre-aborted interpretation and refuses credential-bearing endpoints', async () => {
    const { model, operations } = catalog(), interpret = vi.fn(), controller = new AbortController(); controller.abort();
    await expect(planTask({ intent: 'User task', model, operations, interpret, signal: controller.signal })).rejects.toThrow();
    expect(interpret).not.toHaveBeenCalled();
    for (const endpoint of ['http://provider.invalid/chat', 'https://user:key@provider.invalid/chat', 'https://provider.invalid/chat?key=private']) expect(() => createChatInterpreter({ apiKey: 'private', model: 'test', endpoint })).toThrow();
  });
});
