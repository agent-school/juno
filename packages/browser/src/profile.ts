import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Resolve Juno's dedicated persistent browser profile directory.
 *
 * Precedence:
 *   1. JUNO_PROFILE_DIR environment variable (config/env-sourced ONLY —
 *      arbitrary user-supplied paths are never accepted at runtime)
 *   2. Default: ~/.juno/profile
 *
 * The directory is created recursively on first use. It holds the user's real
 * login state (cookies, localStorage, IndexedDB) and is treated as sensitive
 * data at rest: nothing in this package ever reads or logs its contents.
 *
 * This is NEVER the user's daily-driver Chrome profile directory — Chrome
 * policy + Playwright docs forbid automating the default profile.
 */
export function resolveProfileDir(): string {
  const override = process.env.JUNO_PROFILE_DIR;
  const dir =
    override !== undefined && override.trim() !== ''
      ? path.resolve(override)
      : path.join(os.homedir(), '.juno', 'profile');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
