import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compile, checkBindings } from '../../src/compiler.js';
import { InputSchema, durableTree, verifyInteraction, type Receipt } from '../../src/contracts.js';
import { Store } from '../../src/store.js';

const inputs = { person: 'Alice Smith' as const, note: 'A note', occurred_at: '2026-11-12', next_action: 'Send demo' };
const tree = { children: [
  { role: 'combobox', name: 'Person', children: [] },
  ...['Interaction note', 'Interaction date', 'Next action'].map(name => ({ role: 'textbox', name, children: [] })),
  { role: 'button', name: 'Capture interaction', ref: 'e16', box: { x: 1, y: 2, width: 3, height: 4 }, children: [] },
] };
describe('semantic binding boundary', () => {
  it('keeps bindings across reordering and rejects a renamed or duplicate control', () => {
    const model = compile(tree);
    expect(() => checkBindings({ children: [...tree.children].reverse() }, model)).not.toThrow();
    expect(() => checkBindings({ children: tree.children.slice(0, -1) }, model)).toThrow('observed 0');
    expect(() => compile({ children: [...tree.children, tree.children[4]!] })).toThrow('observed 2');
    // UUIDs can contain "e16" by chance; reject ephemeral reference fields structurally.
    for (const binding of Object.values(model.bindings)) expect(binding).not.toHaveProperty('ref');
    expect(JSON.stringify(durableTree(tree))).not.toContain('"box"');
  });
  it('rejects invalid dates and any undeclared input field', () => {
    expect(InputSchema.safeParse({ ...inputs, occurred_at: '2026-02-30' }).success).toBe(false);
    expect(InputSchema.safeParse({ ...inputs, url: 'https://example.com' }).success).toBe(false);
  });
  it('requires exact unique application effects rather than successful actions', () => {
    const record = { ...inputs, id: 'record', requestId: 'request' };
    expect(verifyInteraction([record], 'request', inputs).every(check => check.passed)).toBe(true);
    expect(verifyInteraction([], 'request', inputs).every(check => check.passed)).toBe(false);
    expect(verifyInteraction([record, record], 'request', inputs).every(check => check.passed)).toBe(false);
    expect(verifyInteraction([{ ...record, person: 'Bob Chen' }], 'request', inputs).find(check => check.name.startsWith('person'))?.passed).toBe(false);
  });
});
describe('durable evidence', () => {
  it('isolates owners and marks interrupted writes uncertain after a process restart', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'juno-store-'));
    try {
      const owner = 'a'.repeat(64);
      const store = new Store(directory);
      store.create(owner);
      store.update(owner, state => {
        state.model = compile(tree);
        state.feedback.push({ id: 'feedback', runId: null, text: 'A durable observation', createdAt: '2026-11-12' });
        state.receipts.push({ id: 'request', status: 'running' } as Receipt);
      });
      const restarted = new Store(directory);
      expect(restarted.read(owner).model?.bindings.submit.name).toBe('Capture interaction');
      expect(restarted.read(owner).feedback[0]?.text).toBe('A durable observation');
      expect(restarted.read(owner).receipts[0]?.status).toBe('uncertain');
      expect(restarted.read('b'.repeat(64)).model).toBeNull();
      expect(() => restarted.read('../outside')).toThrow('Invalid session');
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });
});
