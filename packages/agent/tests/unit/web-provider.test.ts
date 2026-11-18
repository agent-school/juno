import { afterEach, expect, it, vi } from 'vitest';
import { createWebInterpreter } from '../../src/web/runtime.js';
const request = { goal: 'Compare these public sources', pages: [], rememberedRoutes: [], remainingPages: 10 };
afterEach(() => vi.unstubAllGlobals());
it('keeps a server credential out of model context and sends bounded generic decisions through the configured HTTPS provider', async () => {
  const response = { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ action: 'search', query: 'official browser documentation', reason: 'Find starting sources' }) } }] };
  const fetcher = vi.fn(async () => new Response(JSON.stringify(response), { headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', fetcher);
  const model = createWebInterpreter({ apiKey: 'private-provider-sentinel', model: 'configured-model', endpoint: 'https://model.example/v1/chat/completions' });
  expect(await model(request, new AbortController().signal)).toMatchObject({ action: 'search' });
  const [, raw] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
  expect(raw.headers).toMatchObject({ authorization: 'Bearer private-provider-sentinel' });
  expect(raw.redirect).toBe('error');
  expect(raw.body).not.toContain('private-provider-sentinel');
  const payload = JSON.parse(raw.body as string);
  expect(payload.model).toBe('configured-model'); expect(payload.max_tokens).toBe(3000);
  expect(payload.messages.some((message: { content: string }) => message.content.includes('UNTRUSTED DATA'))).toBe(true);
});
it('rejects credential-bearing endpoints, provider refusal, truncated output and oversized output', async () => {
  for (const endpoint of ['http://model.example', 'https://user:pass@model.example', 'https://model.example?key=private', 'https://model.example#private']) expect(() => createWebInterpreter({ apiKey: 'private', model: 'model', endpoint })).toThrow('HTTPS');
  const model = createWebInterpreter({ apiKey: 'private', model: 'model' });
  vi.stubGlobal('fetch', async () => new Response('{}', { status: 401 }));
  await expect(model(request, new AbortController().signal)).rejects.toThrow('HTTP 401');
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] })));
  await expect(model(request, new AbortController().signal)).rejects.toThrow();
  vi.stubGlobal('fetch', async () => new Response('x'.repeat(64_001)));
  await expect(model(request, new AbortController().signal)).rejects.toThrow('budget');
});
