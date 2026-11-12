import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

// HTTP integration tests only: no external network or browser UI is required by CI.
test('protects, restores and isolates durable memory; supports correction, forgetting and credential-free export', async ({ request, playwright }) => {
  const credentials = { handle: `workspace-${randomUUID().slice(0, 8)}`, passphrase: randomUUID() };
  expect((await request.post('/api/memory/preferences', { data: { language: 'TypeScript', minStars: 250 } })).ok()).toBe(true);
  await request.post('/api/memory/note', { data: { text: 'Remember deterministic browser automation.' } });
  let workspace = await (await request.get('/api/workspace')).json();
  const noteId = workspace.notes[0].id;
  expect(workspace.notes[0].origin).toBe('user');
  expect((await request.post('/api/account/register', { data: credentials })).status()).toBe(201);
  const other = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:5124', extraHTTPHeaders: { 'x-juno-request': '1' } });
  try {
    expect((await (await other.get('/api/workspace')).json()).notes).toEqual([]);
    expect((await other.post('/api/memory/note', { data: { id: noteId, text: 'Unauthorized correction' } })).status()).toBe(409);
    expect((await other.post('/api/account/login', { data: { ...credentials, passphrase: randomUUID() } })).status()).toBe(401);
    expect((await other.post('/api/account/login', { data: credentials })).ok()).toBe(true);
    workspace = await (await other.get('/api/workspace')).json();
    expect(workspace.account).toBe(credentials.handle); expect(workspace.preferences.language).toBe('TypeScript');
    expect(workspace.notes[0].text).toContain('deterministic');
    await other.post('/api/memory/note', { data: { id: noteId, text: 'Prefer semantic browser automation.' } });
    workspace = await (await request.get('/api/workspace')).json();
    expect(workspace.notes[0].revision).toBe(2); expect(workspace.notes[0].history).toHaveLength(1);
    const evidence = await (await other.get('/api/export')).text();
    expect(evidence).toContain('Prefer semantic'); expect(evidence).not.toContain(credentials.passphrase); expect(evidence).not.toContain('"hash"');
    await other.post('/api/memory/forget', { data: { kind: 'notes', id: noteId } });
    expect((await (await request.get('/api/workspace')).json()).notes).toEqual([]);
    expect((await other.post('/api/account/logout', { data: {} })).ok()).toBe(true);
    expect((await (await other.get('/api/workspace')).json()).account).toBeNull();
    expect((await other.post('/api/account/login', { data: credentials })).ok()).toBe(true);
    expect((await (await other.get('/api/workspace')).json()).preferences.minStars).toBe(250);
  } finally { await other.dispose(); }
});

test('rejects arbitrary tasks and URLs, cross-origin memory writes and ungrounded source saves', async ({ request }) => {
  expect((await request.post('/api/tasks', { data: { requestId: randomUUID(), task: { kind: 'navigate', url: 'http://127.0.0.1' } } })).status()).toBe(400);
  expect((await request.post('/api/tasks', { data: { requestId: randomUUID(), task: { kind: 'search', query: 'browser', url: 'https://example.com' } } })).status()).toBe(400);
  expect((await request.post('/api/tasks', { data: { requestId: randomUUID(), task: { kind: 'refresh' } } })).status()).toBe(409);
  expect((await request.post('/api/memory/project', { data: { taskId: randomUUID(), fullName: 'example/tool' } })).status()).toBe(409);
  expect((await request.post('/api/memory/preferences', { headers: { 'sec-fetch-site': 'cross-site' }, data: { language: 'Any', minStars: 0 } })).status()).toBe(403);
  expect((await request.get('/accounts/test.json')).status()).toBe(404);
  expect((await request.get('/src/accounts.ts')).status()).toBe(404);
});
