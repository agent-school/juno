import { defineConfig } from 'vitest/config';

/**
 * Package-level vitest config for @juno/browser unit tests.
 *
 * The root vitest.config.ts covers monorepo-wide runs (`pnpm exec vitest run`
 * from the repo root); this config makes in-package runs work:
 * `pnpm --filter @juno/browser exec vitest run`.
 */
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
