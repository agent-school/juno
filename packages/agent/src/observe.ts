import type { Page } from 'playwright';
import { createGuardedActor } from '@juno/browser';
import { compileSite, SiteKnowledgeStore, type OperationContract } from '@juno/knowledge';
import { confinePage, validateBoundary, type SiteBoundary } from './boundary.js';

/** Only observes explicit routes. No form submission, link guessing or behavior inference. */
export async function observeSite(options: {
  page: Page; boundary: SiteBoundary; operations: readonly OperationContract[];
  store: SiteKnowledgeStore; owner: string; signal?: AbortSignal;
  knownSecrets?: readonly string[];
}) {
  const { page, store, owner, signal } = options;
  const boundary = validateBoundary(options.boundary);
  await confinePage(page, boundary, 'read-only');
  const abort = () => { void page.close({ runBeforeUnload: false }).catch(() => {}); };
  const timer = setTimeout(abort, 30_000);
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const { actor } = createGuardedActor(page, { mode: 'read-only', timeoutMs: 2500, audit: async () => {} });
    const pages = [];
    for (const route of boundary.routes) {
      signal?.throwIfAborted();
      await page.goto(`${boundary.origin}${route}`, { waitUntil: 'load', timeout: 8000 });
      if (page.url() !== `${boundary.origin}${route}`) throw new Error('Observation redirected outside the approved route');
      pages.push({ route, tree: await actor.read() });
    }
    signal?.throwIfAborted();
    return store.save(owner, compileSite({ origin: boundary.origin, pages, operations: options.operations, knownSecrets: options.knownSecrets }));
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
