import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('exits after a corrupt workspace fails initialization instead of stranding its HTTP server', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'juno-corrupt-workspace-'));
  fs.mkdirSync(path.join(directory, 'runs'));
  fs.writeFileSync(path.join(directory, 'runs', 'runs.sqlite'), 'not a sqlite database');
  try {
    const result = await new Promise<{ code: number | null; signal: string | null; output: string }>((resolve, reject) => {
      const child = spawn(process.execPath, ['--import', 'tsx', 'benchmark/demo.ts', '--workspace', directory], { cwd: fileURLToPath(new URL('../..', import.meta.url)), stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '';
      child.stdout.on('data', chunk => output += String(chunk)); child.stderr.on('data', chunk => output += String(chunk));
      const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
      child.once('error', reject);
      child.once('exit', (code, signal) => { clearTimeout(timer); resolve({ code, signal, output }); });
    });
    expect(result.output).toContain('not a database');
    expect(result.signal).toBeNull();
    expect(result.code).toBe(1);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}, 10_000);
