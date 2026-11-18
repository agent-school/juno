import { test, expect, type APIRequestContext } from '@playwright/test';

const input = { name: 'Ada Lovelace', email: 'ada@example.test', note: 'Compare semantic browser agents', due: '2026-11-20', category: 'Partner', subscribed: false };
async function prepare(request: APIRequestContext) {
  const response = await request.post('/api/agent/prepare', { data: input });
  expect(response.status(), await response.text()).toBe(201);
  return response.json();
}
async function settled(request: APIRequestContext, id: string) {
  await expect.poll(async () => (await (await request.get(`/api/agent/tasks/${id}`)).json()).status, { timeout: 35_000 }).not.toBe('running');
  return (await request.get(`/api/agent/tasks/${id}`)).json();
}
test('hosts reviewed plans, real semantic execution, independent results and idempotent replay behind the workspace API', async ({ request, playwright }) => {
  const task = await prepare(request);
  expect(task.status).toBe('ready');
  expect(task.plan.steps).toHaveLength(2);
  expect((await (await request.get('/api/agent')).json()).records).toEqual([]);
  const knowledge = await (await request.get('/api/agent/knowledge')).json();
  expect(knowledge.versions[0].pages).toHaveLength(3);
  expect(knowledge.versions[0].operations).toHaveLength(2);
  const other = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:5124', extraHTTPHeaders: { 'x-juno-request': '1' } });
  try {
    expect((await other.get(`/api/agent/tasks/${task.id}`)).status()).toBe(404);
    expect((await other.post(`/api/agent/tasks/${task.id}/run`, { data: {} })).status()).toBe(404);
    expect((await other.get(`/api/agent/tasks/${task.id}/screenshot`)).status()).toBe(404);
    expect((await (await other.get('/api/agent')).json()).knowledge).toEqual([]);
    expect((await (await other.get('/api/agent')).json()).tasks).toEqual([]);
  } finally { await other.dispose(); }
  expect((await request.post(`/api/agent/tasks/${task.id}/run`, { data: { variant: 'reordered' } })).status()).toBe(202);
  const result = await settled(request, task.id);
  expect(result.status).toBe('verified');
  expect(result.receipt.steps.every((step: any) => step.verification.status === 'matched')).toBe(true);
  expect(JSON.stringify(result.receipt)).not.toContain(input.email);
  const state = await (await request.get('/api/agent')).json();
  expect(state.records).toHaveLength(2);
  expect(state.records.find((record: any) => record.kind === 'contact').fields).toMatchObject({ category: 'Partner', subscribed: false });
  expect(JSON.stringify(state)).not.toContain('Bearer ');
  expect(JSON.stringify(state)).not.toContain('application.json');
  const screenshot = await request.get(`/api/agent/tasks/${task.id}/screenshot`);
  expect(screenshot.headers()['content-type']).toBe('image/png');
  expect((await screenshot.body()).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  const actions = result.receipt.steps.flatMap((step: any) => step.audit);
  expect((await request.post(`/api/agent/tasks/${task.id}/run`, { data: {} })).status()).toBe(202);
  const replay = await settled(request, task.id);
  expect(replay.status).toBe('verified');
  expect(replay.receipt.steps.flatMap((step: any) => step.audit)).toEqual(actions);
  expect((await (await request.get('/api/agent')).json()).records).toHaveLength(2);
  const exported = await (await request.get(`/api/agent/tasks/${task.id}/receipt`)).json();
  expect(exported.plan.id).toBe(task.id); expect(exported.receipt.status).toBe('verified');
});

test('never accepts raw plans, destinations, credentials, cross-site commands or changed-input run payloads', async ({ request, playwright }) => {
  expect((await request.post('/api/agent/prepare', { data: { ...input, origin: 'https://example.com' } })).status()).toBe(400);
  expect((await request.post('/api/agent/prepare', { data: { ...input, due: '2026-02-30' } })).status()).toBe(400);
  expect((await request.post('/api/agent/prepare', { data: { ...input, apiKey: 'untrusted' } })).status()).toBe(400);
  expect((await request.post('/api/agent/plan', { data: { intent: 'Create a contact', selector: '#submit' } })).status()).toBe(400);
  expect((await request.post('/api/agent/prepare', { headers: { 'sec-fetch-site': 'cross-site' }, data: input })).status()).toBe(403);
  const other = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:5124', extraHTTPHeaders: {} });
  try { expect((await other.post('/api/agent/prepare', { data: input })).status()).toBe(403); } finally { await other.dispose(); }
  expect((await (await request.get('/api/agent')).json()).tasks).toEqual([]);
});

test('a false success remains uncertain and resuming does not blindly repeat its mutation', async ({ request }) => {
  const task = await prepare(request);
  await request.post(`/api/agent/tasks/${task.id}/run`, { data: { variant: 'no-effect' } });
  const result = await settled(request, task.id);
  expect(result.status).toBe('uncertain'); expect(result.receipt.failure).toBe('effect-unverified');
  expect(result.receipt.steps[1].status).toBe('pending');
  await request.post(`/api/agent/tasks/${task.id}/run`, { data: { variant: 'normal' } });
  const replay = await settled(request, task.id);
  expect(replay.status).toBe('uncertain');
  expect(replay.receipt.steps[0].audit).toEqual(result.receipt.steps[0].audit);
  expect((await (await request.get('/api/agent')).json()).records).toEqual([]);
  expect((await request.post(`/api/agent/tasks/${task.id}/run`, { data: { inputs: { name: 'Changed' } } })).status()).toBe(400);
});

test('stops an active task and reconciles the same saved request on explicit resume', async ({ request }) => {
  const task = await prepare(request);
  await request.post(`/api/agent/tasks/${task.id}/run`, { data: {} });
  expect((await request.post(`/api/agent/tasks/${task.id}/stop`, { data: {} })).status()).toBe(200);
  const stopped = await settled(request, task.id);
  expect(stopped.receipt.failure).toBe('cancelled');
  expect(stopped.status).not.toBe('verified');
  await request.post(`/api/agent/tasks/${task.id}/run`, { data: {} });
  expect((await settled(request, task.id)).status).toBe('verified');
  expect((await (await request.get('/api/agent')).json()).records).toHaveLength(2);
});

test('forgetting knowledge invalidates saved plans while preserving independent records and task history', async ({ request }) => {
  const task = await prepare(request);
  expect((await request.post('/api/agent/knowledge/forget', { data: {} })).ok()).toBe(true);
  const state = await (await request.get('/api/agent')).json();
  expect(state.knowledge).toEqual([]); expect(state.tasks).toHaveLength(1);
  expect((await request.post(`/api/agent/tasks/${task.id}/run`, { data: {} })).status()).toBe(409);
  expect((await request.post('/api/agent/observe', { data: {} })).ok()).toBe(true);
  expect((await (await request.get('/api/agent')).json()).knowledge).toHaveLength(1);
  expect((await request.post(`/api/agent/tasks/${task.id}/run`, { data: {} })).status()).toBe(409);
});

test('runs the existing nineteen-condition matrix as a durable workspace job', async ({ request, playwright }) => {
  test.setTimeout(90_000);
  const response = await request.post('/api/agent/checks', { data: {} });
  expect(response.status()).toBe(202);
  const job = await response.json();
  expect((await request.post('/api/agent/checks', { data: {} })).status()).toBe(409);
  expect((await request.post('/api/compile', { data: {} })).status()).toBe(409);
  await expect.poll(async () => (await (await request.get('/api/agent')).json()).checks[0].status, { timeout: 75_000 }).not.toBe('running');
  const report = await request.get(`/api/agent/checks/${job.id}/report`);
  expect(report.status()).toBe(200);
  expect((await report.json()).summary).toMatchObject({ passed: 19, total: 19 });
  const other = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:5124' });
  try { expect((await other.get(`/api/agent/checks/${job.id}/report`)).status()).toBe(404); } finally { await other.dispose(); }
  expect((await (await request.get('/api/agent')).json()).records).toEqual([]);
});

test('stops a reliability job at a check boundary and retains partial evidence', async ({ request }) => {
  const job = await (await request.post('/api/agent/checks', { data: {} })).json();
  expect((await request.post(`/api/agent/checks/${job.id}/stop`, { data: {} })).ok()).toBe(true);
  await expect.poll(async () => (await (await request.get('/api/agent')).json()).checks[0].status).toBe('stopped');
  const state = await (await request.get('/api/agent')).json();
  expect(state.busy).toBe(false); expect(state.records).toEqual([]);
  expect((await request.get(`/api/agent/checks/${job.id}/report`)).status()).toBe(404);
});
