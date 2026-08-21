import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BrowserSession } from '../../src/index.js';

const FIXTURE_URL = 'http://127.0.0.1:8931/';
const MARKER_KEY = 'juno.persistence.marker';

test.describe('persistent profile lifecycle: restart persistence', () => {
  let profileDir: string | null = null;

  test.afterEach(async () => {
    if (profileDir) {
      fs.rmSync(profileDir, { recursive: true, force: true });
      profileDir = null;
    }
  });

  test('localStorage written to the profile survives full close and relaunch', async () => {
    profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'juno-e2e-persist-'));

    // Session 1: write a known value into the profile on the fixture origin.
    const first = new BrowserSession({ profileDir, headless: true, channel: 'chrome' });
    const page1 = await first.launch();
    await first.goto(FIXTURE_URL);
    await page1.evaluate(
      ([key, value]) => localStorage.setItem(key!, value!),
      [MARKER_KEY, 'persisted-across-restart'] as const,
    );
    // Full context close — browser process goes away, profile lock released.
    await first.close();

    // Session 2: brand-new BrowserSession on the SAME profile directory.
    const second = new BrowserSession({ profileDir, headless: true, channel: 'chrome' });
    const page2 = await second.launch();
    await second.goto(FIXTURE_URL);
    const value = await page2.evaluate((key) => localStorage.getItem(key), MARKER_KEY);
    expect(value).toBe('persisted-across-restart');
    await second.close();
  });
});
