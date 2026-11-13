import { describe, expect, it, vi } from 'vitest';
import { cdpOrigin, normalizeCdpMetadata, waitForCdp } from '../../src/cdp-readiness.js';

const metadata = { Browser: 'Chrome/142', 'Protocol-Version': '1.3', webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/browser/owned?session=one' };

describe('explicit CDP readiness boundary', () => {
  it('normalizes only the socket authority for Docker and preserves its browser path/query', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(metadata)));
    const ready = await waitForCdp({ endpoint: 'http://host.docker.internal:9333', fetch: fetcher });
    expect(ready.websocket).toBe('ws://host.docker.internal:9333/devtools/browser/owned?session=one');
    expect(ready.browserVersion).toBe('Chrome/142');
    expect(fetcher.mock.calls[0]?.[1]?.redirect).toBe('error');
  });
  it.each(['file:///etc/passwd', 'ws://localhost:9222', 'http://user:secret@localhost:9222', 'http://localhost:9222/path', 'http://localhost:9222?token=secret', 'not a URL'])('rejects unsafe configuration %s', raw => {
    expect(() => cdpOrigin(raw)).toThrow('CDP configuration');
  });
  it.each([
    {}, { ...metadata, Browser: '' }, { ...metadata, 'Protocol-Version': '' },
    { ...metadata, webSocketDebuggerUrl: 'ws://localhost:9222/devtools/page/one' },
    { ...metadata, webSocketDebuggerUrl: 'javascript:alert(1)' },
    { ...metadata, webSocketDebuggerUrl: 'ws://user:secret@localhost:9222/devtools/browser/one' },
  ])('rejects malformed privileged metadata', value => {
    expect(() => normalizeCdpMetadata(value, cdpOrigin('http://localhost:9222'))).toThrow('CDP metadata');
  });
  it('does not downgrade TLS', () => {
    expect(() => normalizeCdpMetadata(metadata, cdpOrigin('https://host.docker.internal:9222'))).toThrow('transport security');
  });
  it('bounds retries and rejects an unavailable endpoint', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('refused'));
    await expect(waitForCdp({ endpoint: 'http://localhost:9222', timeoutMs: 30, intervalMs: 10, fetch: fetcher })).rejects.toThrow('deadline');
    expect(fetcher.mock.calls.length).toBeLessThanOrEqual(4);
  });
  it('bounds even an injected fetch that never settles', async () => {
    await expect(waitForCdp({ endpoint: 'http://localhost:9222', timeoutMs: 20, intervalMs: 1,
      fetch: () => new Promise(() => {}),
    })).rejects.toThrow('deadline');
  });
  it('rejects malformed JSON and oversized responses without attaching', async () => {
    for (const body of ['broken', 'x'.repeat(65_537)]) {
      await expect(waitForCdp({ endpoint: 'http://localhost:9222', fetch: async () => new Response(body) })).rejects.toThrow('CDP metadata');
    }
  });
});
