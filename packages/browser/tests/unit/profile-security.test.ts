import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { UnsafeProfileDirError } from '../../src/errors.js';
import { assertDedicatedProfileDir, resolveProfileDir } from '../../src/profile.js';

describe('profile security (review CR-01 / CR-03)', () => {
  it('creates the profile directory with owner-only permissions', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'juno-profile-perm-'));
    fs.rmSync(dir, { recursive: true, force: true });
    const created = path.join(dir, 'profile');
    process.env.JUNO_PROFILE_DIR = created;
    try {
      const resolved = resolveProfileDir();
      expect(resolved).toBe(path.resolve(created));
      const mode = fs.statSync(resolved).mode & 0o777;
      expect(mode).toBe(0o700);
    } finally {
      delete process.env.JUNO_PROFILE_DIR;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects daily-driver Chrome profile paths for the current platform root', () => {
    let daily: string;

    switch (process.platform) {
      case 'darwin':
        daily = path.join(
          os.homedir(),
          'Library',
          'Application Support',
          'Google',
          'Chrome',
          'Default',
        );
        break;
      case 'win32':
        daily = path.join(
          os.homedir(),
          'AppData',
          'Local',
          'Google',
          'Chrome',
          'User Data',
          'Default',
        );
        break;
      default:
        daily = path.join(os.homedir(), '.config', 'google-chrome', 'Default');
        break;
    }

    expect(() => assertDedicatedProfileDir(daily)).toThrow(UnsafeProfileDirError);
  });

  it('allows dedicated dirs (temp dirs, ~/.juno) by default', () => {
    expect(() => assertDedicatedProfileDir('/tmp/juno-e2e-abc123')).not.toThrow();
    expect(() => assertDedicatedProfileDir(path.join(os.homedir(), '.juno', 'profile'))).not.toThrow();
  });

  it('permits anything with the explicit escape hatch', () => {
    process.env.JUNO_ALLOW_UNMANAGED_PROFILE = '1';
    try {
      const daily = path.join(os.homedir(), '.config', 'google-chrome', 'User Data');
      expect(() => assertDedicatedProfileDir(daily)).not.toThrow();
    } finally {
      delete process.env.JUNO_ALLOW_UNMANAGED_PROFILE;
    }
  });
});
