import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebAgentService } from '../../src/web-agent.js';
import { runWebTask } from '@juno/agent/web';

vi.mock('@juno/agent/web', async importOriginal => ({ ...await importOriginal<typeof import('@juno/agent/web')>(), runWebTask: vi.fn(async (options: Parameters<typeof runWebTask>[0]) => {
  options.task.status = 'running'; options.save(options.task);
  await new Promise<void>(resolve => { if (options.signal.aborted) resolve(); else options.signal.addEventListener('abort', () => resolve(), { once: true }); });
  options.task.status = 'stopped'; options.save(options.task);
}) }));
const roots: string[] = [];
const owner = 'a'.repeat(64), other = 'b'.repeat(64);
const input = { goal: 'Find the requirements and compare public sources', urls: ['https://example.com'], mode: 'evidence' };
function service(busy = () => false) { const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'juno-web-')); roots.push(directory); return { directory, service: new WebAgentService(directory, busy) }; }
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

describe('durable general browser service', () => {
  it('isolates owners, validates public URLs/host authority, and preserves review across restart', () => {
    const { service: first, directory } = service();
    const task = first.prepare(owner, input);
    expect(task.status).toBe('ready'); expect(vi.mocked(runWebTask)).not.toHaveBeenCalled();
    expect(() => first.detail(other, task.id)).toThrow('not found');
    expect(() => first.prepare(owner, { ...input, urls: ['http://169.254.169.254/'] })).toThrow('HTTPS');
    expect(() => first.prepare(owner, { ...input, testOrigins: ['http://127.0.0.1'] })).toThrow();
    const fresh = new WebAgentService(directory);
    expect(fresh.detail(owner, task.id).input).toEqual({ ...input, urls: ['https://example.com/'] });
    expect(fresh.state(other).tasks).toEqual([]);
    expect(() => fresh.prepare(other, { ...input, parentId: task.id })).toThrow('not found');
    const child = fresh.prepare(owner, { ...input, parentId: task.id });
    expect(child.input.parentId).toBe(task.id);
    expect(() => fresh.forgetTask(owner, task.id)).toThrow('reviewed follow-up');
    expect(fresh.detail(owner, child.id).status).toBe('ready');
    fresh.forgetTask(owner, child.id);
    fresh.forgetTask(owner, task.id);
    expect(() => fresh.detail(owner, task.id)).toThrow('not found');
  });
  it('shares the browser slot, allows stop, waits for shutdown, and cannot rerun a finished request', async () => {
    const { service: runner, directory } = service();
    const task = runner.prepare(owner, input);
    runner.start(owner, task.id);
    expect(runner.isBusy()).toBe(true);
    expect(() => runner.start(owner, task.id)).toThrow('busy');
    expect(() => runner.forgetTask(owner, task.id)).toThrow('Stop');
    expect(() => runner.stop(other, task.id)).toThrow('not found');
    await runner.close();
    expect(runner.isBusy()).toBe(false); expect(runner.detail(owner, task.id).status).toBe('stopped');
    expect(() => runner.prepare(owner, input)).toThrow('restarting');
    const fresh = new WebAgentService(directory);
    expect(() => fresh.start(owner, task.id)).toThrow('already started');
    await fresh.close();
  });
  it('rejects work during another browser job and rejects model mode without configuration', () => {
    const { service: busy } = service(() => true);
    const task = busy.prepare(owner, input);
    expect(() => busy.start(owner, task.id)).toThrow('busy');
    vi.stubEnv('JUNO_PLANNER_API_KEY', ''); vi.stubEnv('JUNO_PLANNER_MODEL', '');
    const { service: free } = service();
    const agentTask = free.prepare(owner, { ...input, mode: 'agent' });
    expect(() => free.start(owner, agentTask.id)).toThrow('model connection');
    expect(free.isBusy()).toBe(false);
  });
  it('marks a crashed worker interrupted and refuses an implicit replay', async () => {
    const { service: runner, directory } = service();
    const task = runner.prepare(owner, input); task.status = 'running';
    fs.writeFileSync(path.join(directory, owner, 'tasks', `${task.id}.json`), JSON.stringify(task));
    expect(runner.detail(owner, task.id).status).toBe('interrupted');
    expect(() => runner.start(owner, task.id)).toThrow('already started');
    await runner.close();
  });
});
