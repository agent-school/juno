import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
      const mode = (fs.statSync(resolved).mode & 0o777).toString(8);
      expect(['700', '600']).toContain(mode);
    } finally {
      delete process.env.JUNO_PROFILE_DIR;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects daily-driver Chrome profile paths (User Data tree)', () => {
    const daily = path.join(os.homedir(), '.config', 'google-chrome', 'User Data', 'Default');
    expect(() => assertDedicatedProfileDir(daily)).toThrow(/daily-driver/);
    expect(() => assertDedicatedProfileDir('/home/x/Library/Application Support/Google/Chrome/User Data')).toThrow(
      /daily-driver/,
    );
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
