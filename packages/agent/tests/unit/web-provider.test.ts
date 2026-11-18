import { afterEach, expect, it, vi } from 'vitest';
import { createWebInterpreter } from '../../src/web/runtime.js';
import { ModelOutputError } from '../../src/model.js';
import { WebDecisionSchema, validateAnswer } from '../../src/web/contracts.js';

it('resolves evidence IDs to the host’s exact observed punctuation and rejects invented IDs', async () => {
  const page = { id: 'p1', url: 'https://example.com/', title: 'Source', observedAt: new Date().toISOString(), hash: 'a'.repeat(64),
    text: 'The source uses “curly quotes” and an exact published value of 19 dollars.', links: [] };
  let quoteId = 'q0-1';
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ action: 'finish', answer: 'The price is 19 dollars [p1].',
    citations: [{ pageId: 'p1', quoteId }], rows: [{ label: 'Price', value: '19 dollars', pageId: 'p1', quoteId }] }) } }] })));
  const infer = createWebInterpreter({ apiKey: 'private', model: 'test' });
  expect(infer.reviewAnswers).toBe(true);
  const request = { goal: 'Extract the published price', pages: [page], rememberedRoutes: [], remainingPages: 9 };
  const decision = WebDecisionSchema.parse(await infer(request, new AbortController().signal));
  if (decision.action !== 'finish') throw new Error('Expected an answer');
  expect(validateAnswer(decision, [page]).citations[0]?.quote).toBe(page.text);
  expect(decision.citations[0]).not.toHaveProperty('quoteId');
  quoteId = 'invented';
  await expect(infer(request, new AbortController().signal)).rejects.toThrow('unknown source excerpt');
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ action: 'finish', answer: 'A result',
    citations: [{ pageId: 'p1', quote: page.text }], rows: [{ label: 'Price', value: '19 dollars', pageId: 'p1', quoteId: 'q0-1' }] }) } }] })));
  const rejected = await infer(request, new AbortController().signal).catch(error => error);
  expect(rejected).toMatchObject({ message: expect.stringContaining('unsupported answer format'), proposal: { citations: [{ pageId: 'p1', quote: page.text }] } });
  if (!(rejected instanceof ModelOutputError)) throw new Error('Expected a repairable model output failure');
  vi.stubGlobal('fetch', async (_url: unknown, options: RequestInit) => {
    const body = JSON.parse(options.body as string);
    const context = JSON.parse(body.messages.find((message: { role: string }) => message.role === 'user').content);
    expect(context.previousProposal.citations[0].quote).toBe(page.text);
    expect(context.feedback).toContain('rows[0].value');
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ action: 'finish', answer: 'Source-backed price [p1]',
      citations: [{ pageId: 'p1', quoteId: 'q0-1' }], rows: [{ label: 'Price', value: '19 dollars', pageId: 'p1', quoteId: 'q0-1' }] }) } }] }));
  });
  expect(await infer({ ...request, feedback: 'Correct rows[0].value.', previousProposal: rejected.proposal }, new AbortController().signal)).toMatchObject({ rows: [{ value: '19 dollars' }] });
});
const request = { goal: 'Compare these public sources', pages: [], rememberedRoutes: [], remainingPages: 10 };
it('requires every draft part to pass a separate review and keeps critique text out of receipt errors', async () => {
  const draft = { action: 'finish' as const, answer: 'Every version has the same support policy.', citations: [{ pageId: 'p1', quote: 'Version 27 starts a new support policy.' }], rows: [] };
  let checks: unknown = [{ id: 0, issue: 'scope', note: 'untrusted-review-sentinel' }];
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ checks }) } }] })));
  const infer = createWebInterpreter({ apiKey: 'private', model: 'test' });
  const rejected = await infer({ ...request, reviewDraft: draft }, new AbortController().signal).catch(error => error);
  if (!(rejected instanceof ModelOutputError)) throw new Error('Expected a source review rejection');
  expect(rejected.message).toContain('0 (scope)'); expect(rejected.message).not.toContain('untrusted-review-sentinel');
  expect(rejected.proposal).toMatchObject({ draft, review: { checks } });
  checks = [{ id: 0, issue: 'none', note: 'Supported with source conditions' }];
  expect(await infer({ ...request, reviewDraft: draft }, new AbortController().signal)).toEqual(draft);
  checks = [];
  await expect(infer({ ...request, reviewDraft: draft }, new AbortController().signal)).rejects.toThrow('unsupported source review');
});
afterEach(() => vi.unstubAllGlobals());
it('reviews many long and multibyte sources within budget while retaining cited policy and surrounding conditions', async () => {
  const quote = 'The support policy lasts thirty months for this version only.';
  const condition = 'Earlier versions follow a different support schedule.';
  let calls = 0;
  vi.stubGlobal('fetch', async (_url: unknown, options: RequestInit) => {
    const body = JSON.parse(options.body as string);
    const prompt = body.messages.find((message: { role: string }) => message.role === 'user').content;
    expect(Buffer.byteLength(prompt)).toBeLessThanOrEqual(100_000);
    const context = JSON.parse(prompt);
    expect(context.sources).toHaveLength(calls++ === 0 ? 4 : 10);
    const cited = context.sources.find((source: { id: string }) => source.id === 'p4');
    expect(JSON.stringify(cited)).toContain(quote); expect(JSON.stringify(cited)).toContain(condition);
    expect(cited.partial).toBe(true);
    const checks = context.parts.map((part: { id: number }) => ({ id: part.id, issue: 'none', note: '' }));
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ checks }) } }] }));
  });
  const infer = createWebInterpreter({ apiKey: 'private', model: 'test' });
  const draft = { action: 'finish' as const, answer: 'This version has thirty months of support [p4].', citations: [{ pageId: 'p4', quote }], rows: [] };
  for (const [count, filler] of [[4, 'a'], [10, '文']] as const) {
    const pages = Array.from({ length: count }, (_, i) => ({ id: `p${i + 1}`, url: `https://example.com/${i}`, title: 'Policy', observedAt: new Date().toISOString(), hash: 'a'.repeat(64),
      text: filler.repeat(29_000) + condition + ' ' + quote + filler.repeat(2800), links: [] }));
    expect(await infer({ ...request, pages, reviewDraft: draft }, new AbortController().signal)).toEqual(draft);
  }
  expect(calls).toBe(2);
});
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
