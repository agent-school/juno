import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { UnsafeProfileDirError } from './errors.js';

/**
 * Resolve Juno's dedicated persistent browser profile directory.
 *
 * Precedence:
 *   1. JUNO_PROFILE_DIR environment variable (config/env-sourced ONLY —
 *      arbitrary user-supplied paths are never accepted at runtime)
 *   2. Default: ~/.juno/profile
 *
 * The directory is created recursively on first use with owner-only
 * permissions — it holds the user's real login state (cookies, localStorage,
 * IndexedDB) and is treated as sensitive data at rest: nothing in this
 * package ever reads or logs its contents.
 *
 * This is NEVER the user's daily-driver Chrome profile directory — Chrome
 * policy + Playwright docs forbid automating the default profile, so paths
 * that look like Chrome's own "User Data" tree are rejected (CR-03).
 */

/**
 * Reject paths that point into a known daily-driver Chrome/Chromium profile
 * tree. Automating that profile can corrupt it and conflicts with the user's
 * running browser. Explicit escape hatch: JUNO_ALLOW_UNMANAGED_PROFILE=1.
 */
export function assertDedicatedProfileDir(dir: string): void {
  if (process.env.JUNO_ALLOW_UNMANAGED_PROFILE === '1') {
    return;
  }
  const resolved = path.resolve(dir);
  const insideDailyDriverRoot = dailyDriverProfileRoots().some(
    (root) => resolved === root || resolved.startsWith(`${root}${path.sep}`),
  );
  if (insideDailyDriverRoot) {
    throw new UnsafeProfileDirError(
      `Refusing to automate a daily-driver Chrome profile directory (${dir}). ` +
        'Juno must use a dedicated profile (default ~/.juno/profile, or JUNO_PROFILE_DIR). ' +
        'Set JUNO_ALLOW_UNMANAGED_PROFILE=1 to override explicitly.',
    );
  }
}

export function resolveProfileDir(): string {
  const override = process.env.JUNO_PROFILE_DIR;
  const dir =
    override !== undefined && override.trim() !== ''
      ? path.resolve(override)
      : path.join(os.homedir(), '.juno', 'profile');
  assertDedicatedProfileDir(dir);
  // Owner-only: the profile holds authenticated browser state (CR-01).
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') {
    fs.chmodSync(dir, 0o700);
  }
  return dir;
}

function dailyDriverProfileRoots(): string[] {
  const home = os.homedir();

  switch (process.platform) {
    case 'darwin':
      return [
        path.join(home, 'Library', 'Application Support', 'Google', 'Chrome'),
        path.join(home, 'Library', 'Application Support', 'Chromium'),
      ];
    case 'win32':
      return [
        path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data'),
        path.join(home, 'AppData', 'Local', 'Chromium', 'User Data'),
      ];
    default:
      return [
        path.join(home, '.config', 'google-chrome'),
        path.join(home, '.config', 'google-chrome-beta'),
        path.join(home, '.config', 'chromium'),
      ];
  }
}
