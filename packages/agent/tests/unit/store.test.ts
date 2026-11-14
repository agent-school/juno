import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { RunStore } from '../../src/store.js';
import type { RunReceipt } from '../../src/index.js';

const directories: string[] = [];
const directory = () => { const result = fs.mkdtempSync(path.join(os.tmpdir(), 'juno-agent-store-')); directories.push(result); return result; };
const receipt = (): RunReceipt => ({
  schemaVersion: 1, id: randomUUID(), manifestHash: 'a'.repeat(64), modelVersion: randomUUID(), structuralRevision: 'b'.repeat(64), status: 'running',
  startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), durationMs: 0,
  steps: [{ id: 'contact', operation: 'contacts.create', contractVersion: 'c'.repeat(64), inputHash: 'd'.repeat(64), effectKey: 'e'.repeat(64), expected: { source: 'records', fields: ['person_name'] }, status: 'pending', mutationAttempted: false, recovered: false, audit: [] }],
});
afterEach(() => { for (const item of directories.splice(0)) fs.rmSync(item, { recursive: true, force: true }); });
describe('durable execution journal', () => {
  it('reloads a checkpoint and refuses a request identity change', () => {
    const location = directory(), first = new RunStore(location), value = receipt();
    first.put(value); first.close();
    const second = new RunStore(location);
    try {
      expect(second.get(value.id)).toEqual(value);
      expect(() => second.put({ ...value, manifestHash: 'f'.repeat(64) })).toThrow('identity');
      expect(second.get(value.id)).toEqual(value);
    } finally { second.close(); }
  });
  it('rejects a corrupted checkpoint rather than treating it as successful', () => {
    const location = directory(), store = new RunStore(location), value = receipt();
    store.put(value);
    const database = new DatabaseSync(path.join(location, 'runs.sqlite'));
    database.prepare('UPDATE runs SET receipt = ? WHERE id = ?').run(JSON.stringify({ ...value, status: 'verified' }), value.id);
    database.close();
    try { expect(() => store.get(value.id)).toThrow(); } finally { store.close(); }
  });
  it('excludes another process and releases the OS lock after process death', async () => {
    const location = directory(), store = new RunStore(location);
    const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../fixtures/lock-worker.ts', import.meta.url)), location], { cwd: fileURLToPath(new URL('../../../', import.meta.url)), stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
    try {
      const ready = await Promise.race([once(child, 'message'), once(child, 'exit').then(() => { throw new Error('Lock worker exited before acquiring its lock'); })]);
      expect(ready[0]).toBe('locked');
      expect(() => store.acquire()).toThrow('Another process');
      const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited;
      const release = store.acquire(); release();
      store.put(receipt());
    } finally { if (child.exitCode === null && child.signalCode === null) { const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited; } store.close(); }
  }, 10_000);
});
