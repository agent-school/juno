import { expect, test } from '@playwright/test';
import { HostChromeSession, waitForCdp } from '../../src/index.js';

test('client disconnect and failed navigation leave externally owned Chrome running', async () => {
  const endpoint = process.env.JUNO_CDP_ENDPOINT;
  if (!endpoint) throw new Error('JUNO_CDP_ENDPOINT must name the dedicated launcher-owned browser');
  const first = new HostChromeSession({ endpoint });
  try { await first.attach(); } finally { await first.close(); }
  expect(first.isRunning).toBe(false);
  expect((await waitForCdp({ endpoint })).browserVersion).toBeTruthy();
  const next = new HostChromeSession({ endpoint });
  try {
    const page = await next.attach();
    await expect(page.goto('http://127.0.0.1:1/', { timeout: 1000 })).rejects.toThrow();
  } finally { await next.close(); }
  expect((await waitForCdp({ endpoint })).browserVersion).toBeTruthy();
});
