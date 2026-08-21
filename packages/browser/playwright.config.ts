import { defineConfig } from '@playwright/test';

/**
 * E2E config for @juno/browser.
 *
 * `fullyParallel: false` + a single worker: every BrowserSession owns a
 * dedicated persistent profile directory, and profile locks (ProcessSingleton)
 * make concurrent sessions on the same dir impossible by design. Specs that
 * need isolation create their own temp profile dirs.
 *
 * The deterministic fixture server on 127.0.0.1:8931 is started automatically
 * and reused when an instance is already running.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    trace: 'off',
  },
  webServer: {
    command: 'pnpm exec tsx tests/fixtures/server.ts',
    url: 'http://127.0.0.1:8931/',
    reuseExistingServer: true,
    timeout: 20_000,
  },
});
