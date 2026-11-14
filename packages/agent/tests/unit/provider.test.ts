import { afterEach, describe, expect, it, vi } from 'vitest';
import { createChatInterpreter, type Interpretation } from '../../src/planner.js';

const request: Interpretation = { intent: 'Create the contact', catalog: [], outputSchema: { type: 'object' } };
const invoke = () => createChatInterpreter({ apiKey: 'private-test-credential', model: 'test-model' })(request, new AbortController().signal);
afterEach(() => vi.unstubAllGlobals());
describe('OpenAI-compatible interpretation transport', () => {
  it('sends one bounded JSON request and returns only the structured proposal', async () => {
    const fetch = vi.fn(async (_url, options: RequestInit) => {
      expect((options.headers as Record<string, string>).Authorization).toBe('Bearer private-test-credential');
      expect(options.redirect).toBe('error');
      const body = JSON.parse(String(options.body));
      expect(body.max_tokens).toBe(2048);
      expect(body.response_format).toEqual({ type: 'json_object' });
      expect(JSON.stringify(body)).not.toContain('private-test-credential');
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"steps":[]}' } }] }));
    });
    vi.stubGlobal('fetch', fetch);
    await expect(invoke()).resolves.toEqual({ steps: [] });
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('reports provider authentication failure without echoing its response body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Untrusted error body: private-test-credential', { status: 401 })));
    await expect(invoke()).rejects.toThrow(/^Planner provider returned HTTP 401$/);
  });
  it.each(['length', 'content_filter', 'tool_calls'])('rejects incomplete or non-text completion: %s', async finish_reason => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ finish_reason, message: { content: '{"steps":[]}' } }] }))));
    await expect(invoke()).rejects.toThrow();
  });
  it('rejects oversized provider output', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x'.repeat(64_001))));
    await expect(invoke()).rejects.toThrow('exceeds budget');
  });
});
