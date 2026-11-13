import { expect, it, vi } from 'vitest';
import { chromium } from 'playwright';
import { HostChromeSession } from '../../src/cdp-session.js';

const options = { endpoint: 'http://localhost:9222', fetch: async () => new Response(JSON.stringify({
  Browser: 'Chrome/test', 'Protocol-Version': '1.3', webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/owned',
})) };

it('attaches to the default page and disconnects its client without owning Chrome', async () => {
  const page = {}, close = vi.fn().mockResolvedValue(undefined);
  const connect = vi.spyOn(chromium, 'connectOverCDP').mockResolvedValue({
    contexts: () => [{ pages: () => [page] }], close, isConnected: () => true,
  } as any);
  try {
    const session = new HostChromeSession(options);
    expect(await session.attach()).toBe(page);
    expect(session.isRunning).toBe(true);
    expect(connect).toHaveBeenCalledWith(expect.stringContaining('/devtools/browser/owned'), { isLocal: false, timeout: 10_000 });
    await session.close(); await session.close();
    expect(close).toHaveBeenCalledTimes(1);
    expect(session.page).toBeNull(); expect(session.isRunning).toBe(false);
  } finally { connect.mockRestore(); }
});

it('rejects a missing default context and disconnects after failed acquisition', async () => {
  const close = vi.fn().mockResolvedValue(undefined);
  const connect = vi.spyOn(chromium, 'connectOverCDP').mockResolvedValue({ contexts: () => [], close } as any);
  try {
    const session = new HostChromeSession(options);
    await expect(session.attach()).rejects.toThrow('default context');
    expect(close).toHaveBeenCalledTimes(1);
    expect(session.page).toBeNull();
  } finally { connect.mockRestore(); }
});
