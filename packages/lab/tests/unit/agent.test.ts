import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { makePlan } from '@juno/agent/owned';
import { AgentService } from '../../src/agent.js';

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }); });
function directory() { const value = fs.mkdtempSync(path.join(os.tmpdir(), 'juno-hosted-agent-')); directories.push(value); return value; }

describe('hosted worker restart boundaries', () => {
  it('exposes a saved in-flight task as interrupted after restart without opening a browser or retrying writes', () => {
    const root = directory(), owner = 'a'.repeat(64), plan = makePlan(randomUUID());
    const tasks = path.join(root, owner, 'tasks'); fs.mkdirSync(tasks, { recursive: true });
    fs.writeFileSync(path.join(tasks, `${plan.id}.json`), JSON.stringify({ id: plan.id, plan, title: 'Interrupted task',
      status: 'running', attempts: 1, source: 'form', createdAt: new Date().toISOString() }));
    const service = new AgentService(root);
    expect(service.state(owner).tasks[0]!.status).toBe('interrupted');
    expect(service.detail(owner, plan.id)).toMatchObject({ status: 'interrupted', receipt: null });
    expect(service.isBusy()).toBe(false);
    expect(service.state(owner).records).toEqual([]);
    expect(service.state('b'.repeat(64)).tasks).toEqual([]);
    expect(() => service.detail('b'.repeat(64), plan.id)).toThrow('not found');
    expect(fs.existsSync(path.join(root, owner, 'profiles'))).toBe(false);
    expect(() => service.start(owner, plan.id)).toThrow('knowledge was forgotten');
  });
  it('rejects invalid owner and task identifiers before reading any workspace files', () => {
    const service = new AgentService(directory());
    expect(() => service.state('../outside')).toThrow();
    expect(() => service.detail('a'.repeat(64), '../../outside')).toThrow();
  });
});
