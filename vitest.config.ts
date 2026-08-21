import { defineConfig } from 'vitest/config';

/**
 * Root vitest config for the Juno monorepo.
 *
 * Unit tests live per package under "packages/<pkg>/tests/unit". Browser-backed
 * e2e tests are NOT run by vitest — they run under @playwright/test via each
 * package's `playwright.config.ts` (see `pnpm --filter @juno/browser test:e2e`).
 */
export default defineConfig({
  test: {
    include: ['packages/*/tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
