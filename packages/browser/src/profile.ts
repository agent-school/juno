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
 * The directory is created recursively on first use with owner-only
 * permissions — it holds the user's real login state (cookies, localStorage,
 * IndexedDB) and is treated as sensitive data at rest: nothing in this
 * package ever reads or logs its contents.
 *
 * This is NEVER the user's daily-driver Chrome profile directory — Chrome
 * policy + Playwright docs forbid automating the default profile, so paths
 * that look like Chrome's own "User Data" tree are rejected (CR-03).
 */

/** Profile-root directory names used by Chrome/Chromium daily-driver installs. */
const DAILY_DRIVER_MARKERS = new Set(['user data', 'google/chrome', 'google\\chrome']);

/**
 * Reject paths that point into a daily-driver Chrome profile tree (anywhere a
 * segment is literally "User Data", Chrome's profile root name on every
 * platform). Automating that profile can corrupt it and conflicts with the
 * user's running Chrome. Explicit escape hatch: JUNO_ALLOW_UNMANAGED_PROFILE=1.
 */
export function assertDedicatedProfileDir(dir: string): void {
  if (process.env.JUNO_ALLOW_UNMANAGED_PROFILE === '1') {
    return;
  }
  const resolved = path.resolve(dir).toLowerCase();
  const segments = resolved.split(path.sep);
  const inChromeUserDataTree = segments.some((segment) =>
    DAILY_DRIVER_MARKERS.has(segment),
  );
  if (inChromeUserDataTree) {
    throw new Error(
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
  fs.chmodSync(dir, 0o700);
  return dir;
}
