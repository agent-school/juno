import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BrowserSession, SemanticActor } from '../../src/index.js';

const FIXTURE_URL = 'http://127.0.0.1:8931/';
const TALL_URL = 'http://127.0.0.1:8931/tall';

/**
 * Acting e2e (BRWS-03): every interaction type by SEMANTIC reference, each
 * with an observed page effect. All actions go through SemanticActor.
 */
test.describe('acting: SemanticActor by semantic ref', () => {
  let session: BrowserSession | null = null;
  let profileDir: string | null = null;

  test.afterEach(async () => {
    await session?.close();
    session = null;
    if (profileDir) {
      fs.rmSync(profileDir, { recursive: true, force: true });
      profileDir = null;
    }
  });

  function newSession(): BrowserSession {
    profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'juno-e2e-act-'));
    session = new BrowserSession({
      profileDir,
      headless: true,
      channel: 'chrome',
    });
    return session;
  }

  test('fills the textbox and clicks Add task — list effect observed', async () => {
    const s = newSession();
    const page = await s.launch();
    await s.goto(FIXTURE_URL);
    const actor = new SemanticActor(page);

    await actor.fill({ role: 'textbox', name: 'Task name' }, 'hello actor');
    await actor.click({ role: 'button', name: 'Add task' });

    await expect(page.getByRole('list')).toContainText('hello actor');
  });

  test('selects an option by semantic ref and observes the state', async () => {
    const s = newSession();
    const page = await s.launch();
    await s.goto(FIXTURE_URL);
    const actor = new SemanticActor(page);

    await actor.selectOption({ role: 'combobox', name: 'Priority' }, 'high');

    await expect(page.getByRole('combobox', { name: 'Priority' })).toHaveValue(
      'high',
    );
  });

  test('checks the checkbox by semantic ref', async () => {
    const s = newSession();
    const page = await s.launch();
    await s.goto(FIXTURE_URL);
    const actor = new SemanticActor(page);

    await actor.check({ role: 'checkbox', name: 'Done' });

    await expect(page.getByRole('checkbox', { name: 'Done' })).toBeChecked();
  });

  test('applies true and false checkbox inputs without toggling on replay', async () => {
    const s = newSession();
    const page = await s.launch();
    await s.goto(FIXTURE_URL);
    const actor = new SemanticActor(page);
    const ref = { role: 'checkbox', name: 'Done' };
    const checkbox = page.getByRole('checkbox', { name: 'Done' });

    await actor.check(ref, true);
    await expect(checkbox).toBeChecked();
    await actor.check(ref, false);
    await expect(checkbox).not.toBeChecked();
    await actor.check(ref, false);
    await expect(checkbox).not.toBeChecked();
    await actor.check(ref, true);
    await expect(checkbox).toBeChecked();
  });

  test('scrolls a below-fold button into view by semantic ref', async () => {
    const s = newSession();
    const page = await s.launch();
    await s.goto(TALL_URL);
    const actor = new SemanticActor(page);

    await actor.scrollIntoView({ role: 'button', name: 'Deep target' });

    await expect(page.locator('#scroll-pos')).not.toHaveText('0');
    await expect(page.getByRole('button', { name: 'Deep target' })).toBeVisible();
  });

  test('scrolls the viewport with wheel input', async () => {
    const s = newSession();
    const page = await s.launch();
    await s.goto(TALL_URL);
    const actor = new SemanticActor(page);

    await actor.scrollViewport('down', 600);

    await expect(page.locator('#scroll-pos')).not.toHaveText('0');
  });
});
