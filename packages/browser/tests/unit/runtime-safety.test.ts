import { describe, expect, it, vi } from 'vitest';
import { BrowserSession } from '../../src/index.js';
import { redactUrlForLogs } from '../../src/url.js';

describe('URL logging redaction', () => {
  it('removes credentials, query params, and fragments from log URLs', () => {
    expect(
      redactUrlForLogs('https://user:pass@example.com/path?q=token#frag'),
    ).toBe('https://example.com/path');
  });
});

describe('close() state handling', () => {
  it('keeps the session state intact if context.close() throws', async () => {
    const session = new BrowserSession();
    const closeError = new Error('close failed');
    const context = { close: vi.fn().mockRejectedValue(closeError) };
    const page = {};

    (session as unknown as { context: unknown }).context = context;
    (session as unknown as { _page: unknown })._page = page;

    await expect(session.close()).rejects.toBe(closeError);
    expect(session.isRunning).toBe(true);
    expect(session.page).toBe(page);
  });
});
