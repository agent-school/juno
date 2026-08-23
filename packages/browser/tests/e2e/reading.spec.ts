import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  BrowserSession,
  SemanticPageReader,
  type SnapshotNode,
} from '../../src/index.js';

const FIXTURE_URL = 'http://127.0.0.1:8931/';
const EMPTY_URL = 'http://127.0.0.1:8931/empty';

/**
 * Perception e2e (BRWS-02): every read goes through SemanticPageReader.read —
 * the spec never consumes raw ariaSnapshot output directly. The reader's
 * return type is the zod output type, so unvalidated data is excluded by
 * construction.
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

test.describe('perception: SemanticPageReader on the live fixture server', () => {
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
    profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'juno-e2e-read-'));
    session = new BrowserSession({
      profileDir,
      headless: true,
      channel: 'chrome',
    });
    return session;
  }

  test('reads the live fixture page into a validated typed tree', async () => {
    const s = newSession();
    const page = await s.launch();
    await s.goto(FIXTURE_URL);

    const reader = new SemanticPageReader();
    const tree = await reader.read(page);
    const all = flatten(tree.children);

    const heading = all.find((node) => node.role === 'heading');
    expect(heading?.name).toBe('Juno Fixture');

    const textbox = all.find((node) => node.role === 'textbox');
    expect(textbox?.name).toBe('Task name');

    const button = all.find((node) => node.role === 'button');
    expect(button?.name).toBe('Add task');

    const combobox = all.find((node) => node.role === 'combobox');
    expect(combobox?.name).toBe('Priority');
    const selectedOption = combobox?.children.find(
      (node) => node.role === 'option' && node.selected === true,
    );
    expect(selectedOption?.name).toBe('Low');

    const interactiveRoles = new Set(['textbox', 'button', 'checkbox', 'combobox']);
    const interactive = all.filter((node) => interactiveRoles.has(node.role));
    expect(interactive.length).toBeGreaterThanOrEqual(4);
    for (const node of interactive) {
      expect(node.ref, `${node.role} ${node.name} carries an eN ref`).toMatch(
        /^e\d+$/,
      );
      expect(
        node.box?.width,
        `${node.role} ${node.name} has a positive box width`,
      ).toBeGreaterThan(0);
      expect(
        node.box?.height,
        `${node.role} ${node.name} has a positive box height`,
      ).toBeGreaterThan(0);
    }
  });

  test('reads the empty page to a valid tree with zero top-level nodes', async () => {
    const s = newSession();
    const page = await s.launch();
    await s.goto(EMPTY_URL);

    const tree = await new SemanticPageReader().read(page);
    expect(tree.children).toHaveLength(0);
  });
});
