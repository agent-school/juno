import { defineConfig } from '@playwright/test';

const port = Number(process.env.JUNO_FIXTURE_PORT ?? 8931);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('JUNO_FIXTURE_PORT must be 1024–65535');

export default defineConfig({
  testDir: 'tests/e2e', testMatch: /cdp-(host-browser|cleanup)\.spec\.ts/,
  workers: 1, fullyParallel: false, retries: 0, timeout: 30_000,
  reporter: 'list', use: { trace: 'off' },
  outputDir: process.env.JUNO_CDP_RESULTS_DIR ?? 'test-results/cdp',
  webServer: {
    command: 'pnpm exec tsx tests/fixtures/server.ts',
    url: `http://127.0.0.1:${port}/`, reuseExistingServer: false, timeout: 10_000,
    env: { JUNO_FIXTURE_HOST: process.env.JUNO_FIXTURE_HOST ?? '127.0.0.1', JUNO_FIXTURE_PORT: String(port) },
    gracefulShutdown: { signal: 'SIGTERM', timeout: 2000 },
  },
});
