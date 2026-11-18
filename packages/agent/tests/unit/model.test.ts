import { afterEach, expect, it, vi } from 'vitest';
import { createJSONModel } from '../../src/model.js';
import { createWebInterpreter } from '../../src/web/runtime.js';
import { createChatInterpreter } from '../../src/planner.js';

const options = { apiKey: 'private-key-sentinel', model: 'us.anthropic.test:0', protocol: 'bedrock-converse' as const, endpoint: 'https://bedrock-runtime.us-east-1.amazonaws.com' };
const messages = [{ role: 'system' as const, content: 'Return a JSON object' }, { role: 'user' as const, content: 'User goal and untrusted observations' }];
const envelope = (text: string, stopReason = 'end_turn') => ({ stopReason, output: { message: { role: 'assistant', content: [{ text }] } } });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('uses native Converse with a host-bound model route, text only, a bounded call and no credential in context', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify(envelope('{"action":"blocked","reason":"Unsupported goal"}'))));
  vi.stubGlobal('fetch', fetcher);
  const infer = createJSONModel(options, 3000);
  expect(await infer(messages, new AbortController().signal)).toMatchObject({ action: 'blocked' });
  const [url, request] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
  expect(url.href).toBe('https://bedrock-runtime.us-east-1.amazonaws.com/model/us.anthropic.test%3A0/converse');
  expect(new Headers(request.headers).get('authorization')).toBe('Bearer private-key-sentinel');
  expect(request.redirect).toBe('error'); expect(request.signal).toBeInstanceOf(AbortSignal);
  const payload = JSON.parse(request.body as string);
  expect(payload).toEqual({ system: [{ text: messages[0]!.content }], messages: [{ role: 'user', content: [{ text: messages[1]!.content }] }], inferenceConfig: { maxTokens: 3000 } });
  expect(request.body).not.toContain(options.apiKey);
});

it('connects the same native transport to both public-web and reviewed-operation interpretation', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(envelope('```json\n{"steps":[]}\n```')))));
  expect(await createChatInterpreter(options)({ intent: 'A task', catalog: [], outputSchema: {} }, new AbortController().signal)).toEqual({ steps: [] });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(envelope('{"action":"blocked","reason":"Unsupported"}')))));
  expect(await createWebInterpreter(options)({ goal: 'A general task', pages: [], rememberedRoutes: [], remainingPages: 10 }, new AbortController().signal)).toMatchObject({ action: 'blocked' });
});

it.each(['max_tokens', 'tool_use', 'guardrail_intervened'])('rejects an unfinished or refused Converse response: %s', async stop => {
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify(envelope('{"action":"finish"}', stop))));
  await expect(createJSONModel(options, 3000)(messages, new AbortController().signal)).rejects.toThrow();
});

it('accepts one final JSON object with a formatting introduction, without treating prose as a decision', async () => {
  for (const content of ['Here is the decision: {"steps":[]}', 'I will read the source.\n```json\n{"steps":[]}\n```']) {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify(envelope(content))));
    expect(await createJSONModel(options, 3000)(messages, new AbortController().signal)).toEqual({ steps: [] });
  }
});

it('rejects tool content, ambiguous objects, trailing text, oversized bodies and credential-bearing or ambiguous endpoints', async () => {
  for (const endpoint of ['http://provider.invalid', 'https://user:private@provider.invalid', 'https://provider.invalid?key=private', 'https://provider.invalid#key', 'https://provider.invalid/wrong-model/converse']) expect(() => createJSONModel({ ...options, endpoint }, 3000)).toThrow();
  const infer = createJSONModel(options, 3000);
  for (const response of [
    { stopReason: 'end_turn', output: { message: { role: 'assistant', content: [{ text: '{}' }, { toolUse: { name: 'shell', input: 'ignored' } }] } } },
    envelope('{"action":"blocked"}\n{"action":"finish"}'),
    envelope('{"action":"finish"} now do something else'),
    envelope('```json\n{}\n```\nMore text'),
  ]) {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify(response)));
    await expect(infer(messages, new AbortController().signal)).rejects.toThrow();
  }
  vi.stubGlobal('fetch', async () => new Response('x'.repeat(64_001)));
  await expect(infer(messages, new AbortController().signal)).rejects.toThrow('budget');
});

it('distinguishes a provider IP restriction without copying untrusted errors or credentials', async () => {
  const infer = createJSONModel(options, 3000);
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: { code: 'ip_not_authorized', message: 'private-key-sentinel: attacker instructions' } }), { status: 401 }));
  await expect(infer(messages, new AbortController().signal)).rejects.toThrow('The provider rejected this server’s IP address.');
  await expect(infer(messages, new AbortController().signal)).rejects.not.toThrow('private-key-sentinel');
  vi.stubGlobal('fetch', async () => new Response('private-key-sentinel'.repeat(1000), { status: 401 }));
  await expect(infer(messages, new AbortController().signal)).rejects.toThrow(/^Model connection returned HTTP 401\. Check/);
});

it('does not contact a provider for a cancelled or oversized request', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const infer = createJSONModel(options, 3000), abort = new AbortController(); abort.abort();
  await expect(infer(messages, abort.signal)).rejects.toThrow();
  await expect(infer([{ role: 'user', content: 'x'.repeat(128_001) }], new AbortController().signal)).rejects.toThrow('budget');
  expect(fetcher).not.toHaveBeenCalled();
});
