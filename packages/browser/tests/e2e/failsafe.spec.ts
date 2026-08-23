import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  AmbiguousReference,
  BrowserSession,
  GroundingTimeout,
  SemanticActor,
  SemanticPageReader,
  type SnapshotNode,
} from '../../src/index.js';

const FIXTURE_URL = 'http://127.0.0.1:8931/';
const BASE = 'http://127.0.0.1:8931';

/**
 * Fail-safe e2e (BRWS-03 core): under real DOM mutation every breakage mode
 * — missing target, ambiguous name, stale ephemeral ref — rejects with a
 * typed error and activates NOTHING (the fixture's task list is the
 * activation log: every Add-task click appends one item).
 */
function flatten(nodes: SnapshotNode[]): SnapshotNode[] {
  const all: SnapshotNode[] = [];
  const stack = [...nodes];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      break;
    }
    all.push(node);
    stack.push(...node.children);
  }
  return all;
}

test.describe('failsafe: typed errors under DOM mutation', () => {
  let session: BrowserSession | null = null;
  let profileDir: string | null = null;

  test.beforeEach(async () => {
    await session?.close();
    session = null;
    if (profileDir) {
      fs.rmSync(profileDir, { recursive: true, force: true });
    }
    profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'juno-e2e-safe-'));
    session = new BrowserSession({
      profileDir,
      headless: true,
      channel: 'chrome',
    });
    // Mutation state is server-global and specs run sequentially: start clean.
    await fetch(`${BASE}/reset`, { method: 'POST' });
  });

  test.afterEach(async () => {
    // Restore initial state for the spec files that run after this one.
    await fetch(`${BASE}/reset`, { method: 'POST' });
    await session?.close();
    session = null;
    if (profileDir) {
      fs.rmSync(profileDir, { recursive: true, force: true });
      profileDir = null;
    }
  });

  test('removed target: click rejects with GroundingTimeout, nothing activated', async () => {
    const s = session!;
    const page = await s.launch();
    await s.goto(FIXTURE_URL);
    const actor = new SemanticActor(page, undefined, { timeoutMs: 1500 });

    await page.request.post(`${BASE}/remove-button`);
    await page.reload();

    await expect(
      actor.click({ role: 'button', name: 'Add task' }),
    ).rejects.toBeInstanceOf(GroundingTimeout);
    await expect(page.getByRole('listitem')).toHaveCount(0);
  });

  test('duplicate accessible name: click rejects with AmbiguousReference, nothing activated', async () => {
    const s = session!;
    const page = await s.launch();
    await s.goto(FIXTURE_URL);
    const actor = new SemanticActor(page, undefined, { timeoutMs: 1500 });

    await page.request.post(`${BASE}/add-duplicate-button`);
    await page.reload();

    await expect(
      actor.click({ role: 'button', name: 'Add task' }),
    ).rejects.toBeInstanceOf(AmbiguousReference);
    await expect(page.getByRole('listitem')).toHaveCount(0);
  });

  test('stale ephemeral ref: identity re-validated against a fresh snapshot, typed failure, nothing activated', async () => {
    const s = session!;
    const page = await s.launch();
    await s.goto(FIXTURE_URL);
    const reader = new SemanticPageReader();

    // Capture the ephemeral ref + identity from a real snapshot.
    const tree = await reader.read(page);
    const button = flatten(tree.children).find(
      (node) => node.role === 'button' && node.name === 'Add task',
    );
    expect(button?.ref).toMatch(/^e\d+$/);

    // Live-DOM removal (no reload — ref counters stay stable, exactly the
    // staleness condition RESEARCH verified: aria-ref on a removed element).
    await page.evaluate(() => document.getElementById('add-task')?.remove());

    const actor = new SemanticActor(page, reader, { timeoutMs: 1500 });
    await expect(
      actor.click({ ref: button.ref, role: 'button', name: 'Add task' }),
    ).rejects.toBeInstanceOf(GroundingTimeout);
    await expect(page.getByRole('listitem')).toHaveCount(0);
  });
});
