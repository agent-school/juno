import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { BrowserSession, InvalidUrlError } from '../../src/index.js';

const FIXTURE_URL = 'http://127.0.0.1:8931/';

/**
 * Walk the parsed ariaSnapshot tree (mixed sequences / mappings / scalars)
 * and report whether any node matches the predicate.
 *
 * In the ai-mode YAML, a node line like `button "Add task" [ref=e4]` parses
 * either to a plain scalar (leaf) or to a mapping key (when it has children).
 */
function treeContainsNode(tree: unknown, predicate: (node: string) => boolean): boolean {
  if (typeof tree === 'string') {
    return predicate(tree);
  }
  if (Array.isArray(tree)) {
    return tree.some((child) => treeContainsNode(child, predicate));
  }
  if (tree && typeof tree === 'object') {
    return Object.entries(tree).some(
      ([key, value]) => predicate(key) || treeContainsNode(value, predicate),
    );
  }
  return false;
}

test.describe('tracer walking skeleton: load → read → act', () => {
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
    profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'juno-e2e-nav-'));
    session = new BrowserSession({
      profileDir,
      // The session default stays headed (anti-bot posture); e2e runs in a
      // display-less environment and opts into Chrome's new headless mode.
      headless: true,
      channel: 'chrome',
    });
    return session;
  }

  test('loads a validated URL, reads one a11y snapshot, and acts by semantic ref', async () => {
    const s = newSession();
    const page = await s.launch();

    await s.goto(FIXTURE_URL);
    expect(page.url()).toBe(FIXTURE_URL);

    // Perception: one real accessibility snapshot (ai mode + boxes), parsed
    // into a tree with the yaml package.
    const snapshotYaml = await page.ariaSnapshot({ mode: 'ai', boxes: true });
    const tree: unknown = parseYaml(snapshotYaml);
    expect(
      treeContainsNode(
        tree,
        (node) => node.startsWith('button') && node.includes('"Add task"'),
      ),
      'parsed a11y tree must contain a button node named "Add task"',
    ).toBe(true);

    // Action: strict semantic locators only — no positional disambiguation.
    await page.getByRole('textbox', { name: 'Task name' }).fill('hello juno');
    await page.getByRole('button', { name: 'Add task' }).click();

    // Observable effect of the semantic click in the page.
    await expect(page.locator('#tasks')).toContainText('hello juno');
  });

  test('rejects non-http URLs with InvalidUrlError before any navigation', async () => {
    const s = newSession();
    await s.launch();

    await expect(s.goto('javascript:alert(1)')).rejects.toBeInstanceOf(InvalidUrlError);
    await expect(s.goto('file:///etc/passwd')).rejects.toMatchObject({
      name: 'InvalidUrlError',
    });
    await expect(s.goto('definitely not a url')).rejects.toMatchObject({
      code: 'INVALID_URL',
    });
  });

  test('public-site smoke navigation: example.com', async () => {
    const s = newSession();
    const page = await s.launch();

    await s.goto('https://example.com/');
    expect(new URL(page.url()).hostname).toBe('example.com');
    // IANA removed the Example Domain heading in 2026. The documentation
    // link remains semantic evidence that the public page loaded.
    await expect(
      page.getByRole('link', { name: /Learn more|More information/i }),
    ).toBeVisible();
  });
});
