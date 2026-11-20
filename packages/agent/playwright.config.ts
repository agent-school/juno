import { defineConfig } from '@playwright/test';
process.env.JUNO_LOG_LEVEL ??= 'silent';
export default defineConfig({ testDir: 'tests/e2e', timeout: 180_000, workers: 1, retries: 0, reporter: [['list']] });
