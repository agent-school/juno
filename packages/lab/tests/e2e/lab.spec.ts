import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const inputs = { person: 'Alice Smith', note: 'Controlled experiment', occurred_at: '2026-11-12', next_action: 'Send demo' };
test('compiles a real page, replays new inputs across browser restarts, detects drift and verifies effects', async ({ request }) => {
  await request.get('/api/state');
  const compiled = await request.post('/api/compile', { data: {} });
  expect(await compiled.json()).toHaveProperty('bindings');
  expect(compiled.ok()).toBe(true);
  const requestId = randomUUID();
  const run = await request.post('/api/run', { data: { requestId, inputs } });
  const receipt = await run.json();
  expect(receipt.status).toBe('verified');
  expect(receipt.assertions).toHaveLength(5);
  expect(receipt.metrics.browserActions).toBe(5);
  expect(JSON.stringify(receipt.observations)).not.toMatch(/"ref":"e\d+"/);
  expect((await (await request.post('/api/run', { data: { requestId, inputs } })).json()).id).toBe(requestId);
  expect((await (await request.get('/api/state')).json()).interactions).toHaveLength(1);
  expect((await request.post('/api/run', { data: { requestId, inputs: { ...inputs, note: 'different' } } })).status()).toBe(409);

  await request.post('/api/variant', { data: { variant: 'reordered' } });
  const reordered = await (await request.post('/api/run', { data: { requestId: randomUUID(), inputs: { ...inputs, person: 'Bob Chen' } } })).json();
  expect(reordered.status).toBe('verified');
  expect(reordered.modelVersion).toBe(receipt.modelVersion);
  await request.post('/api/variant', { data: { variant: 'renamed' } });
  const drift = await (await request.post('/api/run', { data: { requestId: randomUUID(), inputs } })).json();
  expect(drift.status).toBe('failed');
  expect(drift.category).toBe('precondition');
  expect(drift.actions).toHaveLength(0);
  expect((await (await request.get('/api/state')).json()).interactions).toHaveLength(2);
  expect((await request.post('/api/compile', { data: {} })).ok()).toBe(true);
  const repaired = await (await request.post('/api/run', { data: { requestId: randomUUID(), inputs } })).json();
  expect(repaired.status).toBe('verified');
  expect(repaired.modelVersion).not.toBe(receipt.modelVersion);

  await request.post('/api/variant', { data: { variant: 'ambiguous' } });
  expect((await request.post('/api/compile', { data: {} })).status()).toBe(422);
  await request.post('/api/variant', { data: { variant: 'no-effect' } });
  await request.post('/api/compile', { data: {} });
  const falseSuccess = await (await request.post('/api/run', { data: { requestId: randomUUID(), inputs } })).json();
  expect(falseSuccess.status).toBe('failed');
  expect(falseSuccess.category).toBe('verification');
  expect(falseSuccess.metrics.browserActions).toBe(5);
  expect((await request.post('/api/feedback', { data: { runId: falseSuccess.id, text: 'Verifier caught a silent no-op.' } })).status()).toBe(201);
  const evidence = await (await request.get('/api/export')).json();
  expect(evidence.receipts).toHaveLength(5);
  expect(evidence.feedback).toHaveLength(1);
});

test('isolates sessions, rejects cross-site writes and never accepts external URLs', async ({ playwright, request }) => {
  await request.get('/api/state');
  const other = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:5124', extraHTTPHeaders: {} });
  try {
    const isolated = await (await other.get('/api/state')).json();
    expect(isolated.receipts).toEqual([]);
    expect(isolated.model).toBeNull();
    expect((await other.post('/api/compile', { data: {} })).status()).toBe(403);
    expect((await request.post('/api/variant', { headers: { 'sec-fetch-site': 'cross-site' }, data: { variant: 'renamed' } })).status()).toBe(403);
    expect((await request.post('/api/run', { data: { requestId: randomUUID(), inputs, url: 'https://example.com' } })).status()).toBe(400);
    expect((await request.get('/src/server.ts')).status()).toBe(404);
  } finally { await other.dispose(); }
});
