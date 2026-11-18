import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, it, vi } from 'vitest';

const resources = vi.hoisted(() => ({ compile: vi.fn(), fixtureClose: vi.fn(), journalClose: vi.fn() }));
vi.mock('@juno/agent/owned', async importOriginal => ({
  ...await importOriginal<typeof import('@juno/agent/owned')>(),
  startFixture: async () => ({ port: 42345, origin: 'http://127.0.0.1:42345', close: resources.fixtureClose }),
  hostFor: () => ({ compile: resources.compile, knowledge: { latest: () => null }, runs: { close: resources.journalClose } }),
}));
import { AgentService } from '../../src/agent.js';

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void, reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

it.each(['observe', 'prepare'] as const)('shutdown aborts %s and waits for browser, journal and fixture cleanup', async action => {
  vi.clearAllMocks();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'juno-preparation-close-'));
  const owner = 'a'.repeat(64), service = new AgentService(directory);
  const started = deferred<AbortSignal | undefined>(), cancelled = deferred();
  const browserClosing = deferred(), browserCleanup = deferred();
  const fixtureClosing = deferred(), fixtureCleanup = deferred();
  let browserClosed = false, serviceClosed = false;
  resources.compile.mockImplementation(async ({ signal }: { signal?: AbortSignal } = {}) => {
    started.resolve(signal);
    const abort = () => cancelled.reject(new Error('Compilation cancelled'));
    signal?.addEventListener('abort', abort, { once: true });
    try { await cancelled.promise; }
    finally {
      signal?.removeEventListener('abort', abort);
      browserClosing.resolve(); await browserCleanup.promise; browserClosed = true;
    }
  });
  resources.fixtureClose.mockImplementation(async () => { fixtureClosing.resolve(); await fixtureCleanup.promise; });
  const work = (action === 'observe' ? service.observe(owner) : service.prepare(owner, {
    name: 'Synthetic', email: 'synthetic@example.test', note: 'Lifecycle check', due: '2026-11-25',
  })).then(() => null, error => error as Error);
  try {
    const signal = await started.promise;
    const closing = service.close().then(() => { serviceClosed = true; });
    expect(signal?.aborted).toBe(true);
    await browserClosing.promise;
    expect(serviceClosed).toBe(false); expect(service.isBusy()).toBe(true);
    expect(resources.journalClose).not.toHaveBeenCalled(); expect(resources.fixtureClose).not.toHaveBeenCalled();
    await expect(service.observe(owner)).rejects.toThrow('shutting down');
    browserCleanup.resolve(); await fixtureClosing.promise;
    expect(browserClosed).toBe(true); expect(resources.journalClose).toHaveBeenCalledOnce();
    expect(serviceClosed).toBe(false);
    fixtureCleanup.resolve(); await closing;
    expect((await work)?.message).toBe('Compilation cancelled');
    expect(service.isBusy()).toBe(false); expect(service.state(owner).tasks).toEqual([]);
    expect(resources.fixtureClose).toHaveBeenCalledOnce();
  } finally {
    cancelled.reject(new Error('Test cleanup')); browserCleanup.resolve(); fixtureCleanup.resolve();
    await work; await service.close(); fs.rmSync(directory, { recursive: true, force: true });
  }
});

it('immediate shutdown prevents preparation from acquiring resources', async () => {
  vi.clearAllMocks();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'juno-immediate-close-'));
  const service = new AgentService(directory);
  const work = service.observe('a'.repeat(64)).then(() => null, error => error as Error);
  try {
    await service.close();
    expect(await work).toBeInstanceOf(Error);
    expect(resources.compile).not.toHaveBeenCalled(); expect(resources.journalClose).not.toHaveBeenCalled();
    expect(fs.readdirSync(directory)).toEqual([]);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
