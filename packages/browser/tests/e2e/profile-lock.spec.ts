import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BrowserSession, ProfileInUseError } from '../../src/index.js';

test.describe('persistent profile lifecycle: lock guard', () => {
  let first: BrowserSession | null = null;
  let profileDir: string | null = null;

  test.afterEach(async () => {
    await first?.close();
    first = null;
    if (profileDir) {
      fs.rmSync(profileDir, { recursive: true, force: true });
      profileDir = null;
    }
  });

  test('a second concurrent launch on the same profile rejects with ProfileInUseError', async () => {
    profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'juno-e2e-lock-'));

    // Hold one session open on the profile directory.
    first = new BrowserSession({ profileDir, headless: true, channel: 'chrome' });
    await first.launch();

    // A second concurrent launch on the SAME dir must fail safe with the
    // typed error — never a raw Playwright error, never a crash.
    const second = new BrowserSession({ profileDir, headless: true, channel: 'chrome' });
    await expect(second.launch()).rejects.toMatchObject({
      name: 'ProfileInUseError',
      code: 'PROFILE_IN_USE',
    });
    // Also assert instanceof so the public API contract is explicit.
    await expect(second.launch()).rejects.toBeInstanceOf(ProfileInUseError);
  });
});
