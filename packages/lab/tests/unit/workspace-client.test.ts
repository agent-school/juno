import { expect, it } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

const client = fs.readFileSync(new URL('../../public/workspace.js', import.meta.url), 'utf8');

// Exercise the shipped client at its DOM/fetch boundary without a browser. The
// recorded UI run covers real controls, layout, accessibility and network flows.
async function initialize(tasks: object[] = []) {
  const workspace = {
    preferences: { language: 'TypeScript', minStars: 100, version: 2, updatedAt: '2026-11-13' },
    tasks, projects: [], notes: [], recipes: [], researchBusy: false,
  };
  const nodes = new Map<string, any>();
  const listeners = new Map<string, (event: any) => Promise<void>>();
  const find = (selector: string) => {
    if (!nodes.has(selector)) nodes.set(selector, {
      textContent: '', innerHTML: '', value: '',
      elements: { language: { value: '' }, minStars: { value: '' }, id: { value: '' } },
      classList: { toggle() {}, add() {} },
      setAttribute() {}, contains: () => false, addEventListener() {},
    });
    return nodes.get(selector);
  };
  find('#task-detail').innerHTML = 'Empty research';
  vm.runInNewContext(client, {
    document: {
      querySelector: find,
      addEventListener: (type: string, listener: (event: any) => Promise<void>) => listeners.set(type, listener),
    },
    localStorage: { getItem: () => null },
    setInterval() {},
    fetch: async (url: string) => {
      if (url === '/api/tasks/forget') workspace.tasks = [];
      else expect(url).toBe('/api/workspace');
      return { ok: true, json: async () => structuredClone(workspace) };
    },
  });
  await new Promise(resolve => setImmediate(resolve));
  return { find, listeners };
}

it('initializes empty research, memory and saved defaults without announcing a task', async () => {
  const { find } = await initialize();
  expect(find('#task-notice').textContent).toBe('');
  expect(find('#task-detail').innerHTML).toBe('Empty research');
  expect(find('#memory-items').innerHTML).toContain('Keep what is useful.');
  expect(find('#preferences-form').elements.language.value).toBe('TypeScript');
  expect(find('#preferences-form').elements.minStars.value).toBe(100);
  expect(find('#preferences-version').textContent).toContain('Version 2');
});

it('returns to initialized empty research after forgetting its last receipt', async () => {
  const { find, listeners } = await initialize([{
    id: 'task-1', status: 'completed', startedAt: '2026-11-13',
    resolved: { kind: 'search', query: 'browser automation', language: 'Any', minStars: 0 },
    results: [], errors: [], recalled: { notes: [] }, sourceRequests: 1, durationMs: 10, steps: [],
  }]);
  expect(find('#task-detail').innerHTML).toContain('browser automation');
  find('#memory-notice').textContent = 'Memory forgotten. Its public results remain in task history until you forget those receipts.';
  const button = { dataset: { action: 'forget-task' }, disabled: false };
  await listeners.get('click')!({ target: { closest: (selector: string) => selector === '[data-action]' ? button : null } });
  expect(find('#task-notice').textContent).toBe('Receipt forgotten. Explicitly saved memories remain.');
  expect(find('#memory-notice').textContent).toBe('');
  expect(find('#task-count').textContent).toBe(0);
  expect(find('#task-detail').innerHTML).toBe('Empty research');
  expect(find('#memory-items').innerHTML).toContain('Keep what is useful.');
  expect(button.disabled).toBe(false);
});
