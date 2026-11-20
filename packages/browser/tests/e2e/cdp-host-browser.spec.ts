import { expect, test } from '@playwright/test';
import { HostChromeSession, SemanticActor, SemanticPageReader } from '../../src/index.js';

test('explicit host browser: attach → perceive → benign action → verify', async () => {
  const endpoint = process.env.JUNO_CDP_ENDPOINT, url = process.env.JUNO_FIXTURE_URL;
  if (!endpoint || !url) throw new Error('Set JUNO_CDP_ENDPOINT and JUNO_FIXTURE_URL for a dedicated launcher-owned Chrome; use playwright.cdp.config.ts');
  const session = new HostChromeSession({ endpoint });
  try {
    const page = await session.attach();
    await page.goto(url);
    const tree = await new SemanticPageReader().read(page);
    expect(tree.children.length).toBeGreaterThan(0);
    const actor = new SemanticActor(page);
    await actor.fill({ role: 'textbox', name: 'Task name' }, 'owned CDP task');
    await actor.click({ role: 'button', name: 'Add task' });
    await expect(page.getByRole('list')).toContainText('owned CDP task');
  } finally { await session.close(); }
});
