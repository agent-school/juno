import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, it, vi } from 'vitest';
const { close } = vi.hoisted(() => ({ close: vi.fn(async () => {}) }));
vi.mock('../../benchmark/host.js', () => ({ hostFor: () => { throw new Error('damaged workspace'); }, makePlan: vi.fn(), owner: 'owner' }));
vi.mock('../../benchmark/fixture.js', () => ({ startFixture: async () => ({ origin: 'http://127.0.0.1:1234', close }) }));
import { runBenchmark } from '../../benchmark/evaluate.js';

it('closes an acquired fixture even when host/store construction throws', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'juno-failed-host-'));
  try {
    await expect(runBenchmark(directory)).rejects.toThrow('damaged workspace');
    expect(close).toHaveBeenCalledOnce();
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
