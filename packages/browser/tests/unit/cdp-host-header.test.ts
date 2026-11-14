import http from 'node:http';
import { expect, it } from 'vitest';
import { waitForCdp } from '../../src/cdp-readiness.js';

it('uses a localhost Host header on the real HTTP transport and rewrites the returned socket to the configured route', async () => {
  const server = http.createServer((req, res) => {
    expect(req.headers.host).toBe('localhost');
    expect(req.url).toBe('/json/version/');
    res.end(JSON.stringify({ Browser: 'Chrome/test', 'Protocol-Version': '1.3', webSocketDebuggerUrl: 'ws://localhost/devtools/browser/owned' }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No port');
    expect((await waitForCdp({ endpoint: `http://127.0.0.1:${address.port}` })).websocket).toBe(`ws://127.0.0.1:${address.port}/devtools/browser/owned`);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
