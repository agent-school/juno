import { test, expect } from '@playwright/test';

test('general task review accepts unrelated goals, stays inert, isolates owners and persists receipts', async ({ request, playwright }) => {
  const first = await request.post('/api/web/prepare', { data: { goal: 'Compare the browser support of these tools', urls: ['https://playwright.dev', 'https://pptr.dev'], mode: 'evidence' } });
  expect(first.status()).toBe(201);
  const task = await first.json();
  expect(task.status).toBe('ready'); expect(task.pages).toEqual([]); expect(task.modelCalls).toBe(0);
  const second = await request.post('/api/web/prepare', { data: { goal: 'Extract admission requirements and important dates', urls: ['https://example.edu/admissions'], mode: 'evidence' } });
  expect(second.status()).toBe(201);
  expect((await (await request.get('/api/web')).json()).tasks).toHaveLength(2);
  expect((await (await request.get(`/api/web/tasks/${task.id}/receipt`)).json()).input.goal).toBe(task.input.goal);
  const other = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:5124' });
  try {
    expect((await other.get(`/api/web/tasks/${task.id}`)).status()).toBe(404);
    expect((await other.get(`/api/web/tasks/${task.id}/screenshot`)).status()).toBe(404);
    expect((await (await other.get('/api/web')).json()).tasks).toEqual([]);
    expect((await (await other.get('/api/web/knowledge')).json()).sites).toEqual([]);
  } finally { await other.dispose(); }
  const followup = await (await request.post('/api/web/prepare', { data: { goal: 'Compare this source against the new policy', urls: ['https://example.com'], mode: 'evidence', parentId: task.id } })).json();
  const conflict = await request.post(`/api/web/tasks/${task.id}/forget`, { data: {} });
  expect(conflict.status()).toBe(409); expect((await conflict.json()).error).toContain('Compare this source against the new policy');
  expect((await request.post(`/api/web/tasks/${followup.id}/forget`, { data: {} })).status()).toBe(200);
  expect((await request.post(`/api/web/tasks/${task.id}/forget`, { data: {} })).status()).toBe(200);
  expect((await request.get(`/api/web/tasks/${task.id}`)).status()).toBe(404);
});

test('rejects private URLs, authority injection, credentials and cross-site commands', async ({ request, playwright }) => {
  const input = { goal: 'Find and compare publicly available information', urls: ['https://example.com'], mode: 'evidence' };
  for (const url of ['http://127.0.0.1', 'https://169.254.169.254', 'https://[::ffff:127.0.0.1]', 'https://example.com:8000', 'https://user:secret@example.com']) expect((await request.post('/api/web/prepare', { data: { ...input, urls: [url] } })).status()).toBe(400);
  for (const field of ['apiKey', 'testOrigins', 'permissions', 'selector', 'operations']) expect((await request.post('/api/web/prepare', { data: { ...input, [field]: 'untrusted' } })).status()).toBe(400);
  expect((await request.post('/api/web/prepare', { headers: { 'sec-fetch-site': 'cross-site' }, data: input })).status()).toBe(403);
  const other = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:5124', extraHTTPHeaders: {} });
  try { expect((await other.post('/api/web/prepare', { data: input })).status()).toBe(403); } finally { await other.dispose(); }
  expect((await request.post('/api/web/prepare', { data: { ...input, urls: [] } })).status()).toBe(400);
  const agent = await (await request.post('/api/web/prepare', { data: { goal: 'Find the official Python environment documentation', mode: 'agent' } })).json();
  expect(agent.input.urls).toEqual([]);
  if (!(await (await request.get('/api/web')).json()).model.configured) expect((await request.post(`/api/web/tasks/${agent.id}/run`, { data: {} })).status()).toBe(409);
});

test('starts and stops a general browser worker, excludes the labs and never silently replays', async ({ request }) => {
  const task = await (await request.post('/api/web/prepare', { data: { goal: 'Read public source evidence for this example website', urls: ['https://example.com'], mode: 'evidence' } })).json();
  expect((await request.post(`/api/web/tasks/${task.id}/run`, { data: {} })).status()).toBe(202);
  expect((await request.post('/api/agent/observe', { data: {} })).status()).toBe(409);
  expect((await request.post('/api/compile', { data: {} })).status()).toBe(409);
  expect((await request.post(`/api/web/tasks/${task.id}/stop`, { data: {} })).status()).toBe(200);
  await expect.poll(async () => (await (await request.get('/api/web')).json()).busy, { timeout: 20_000 }).toBe(false);
  const receipt = await (await request.get(`/api/web/tasks/${task.id}/receipt`)).json();
  expect(['stopped', 'evidence']).toContain(receipt.status); expect(receipt.answer).toBeUndefined();
  expect((await request.post(`/api/web/tasks/${task.id}/run`, { data: { urls: ['https://different.example'] } })).status()).toBe(400);
  expect((await request.post(`/api/web/tasks/${task.id}/run`, { data: {} })).status()).toBe(409);
});
