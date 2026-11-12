import { defineConfig } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export default defineConfig({
  testDir: 'tests/e2e', timeout: 60_000, workers: 1, fullyParallel: false, retries: 0,
  use: { baseURL: 'http://127.0.0.1:5124', extraHTTPHeaders: { 'x-juno-request': '1' } },
  webServer: {
    command: 'pnpm exec tsx src/server.ts', url: 'http://127.0.0.1:5124/healthz',
    reuseExistingServer: false, timeout: 20_000,
    env: { PORT: '5124', JUNO_LAB_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'juno-integration-')) },
  },
});
