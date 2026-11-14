import type { Page, Route } from 'playwright';
import { isDeepStrictEqual } from 'node:util';
import { SiteModelSchema } from '@juno/knowledge';

export interface SiteBoundary {
  origin: string;
  routes: readonly string[];
  /** Host-reviewed resource paths, never discovered from page instructions. */
  readPaths?: readonly string[];
  writePaths?: readonly string[];
}

export function validateBoundary(value: SiteBoundary): SiteBoundary {
  const origin = SiteModelSchema.shape.origin.parse(value.origin);
  const route = SiteModelSchema.shape.pages.element.shape.route;
  const routes = value.routes.map(item => route.parse(item));
  if (!routes.length || routes.length > 20 || new Set(routes).size !== routes.length) throw new Error('Supply one to twenty unique approved routes');
  return { origin, routes, readPaths: (value.readPaths ?? []).map(item => route.parse(item)), writePaths: (value.writePaths ?? []).map(item => route.parse(item)) };
}

/** Defense in depth for a dedicated context. Not a JavaScript or network sandbox.
 * Interception remains installed until this dedicated context is discarded.
 */
export async function confinePage(page: Page, value: SiteBoundary, mode: 'read-only' | 'execute') {
  const boundary = validateBoundary(value);
  const context = page.context();
  if (context.serviceWorkers().length || context.pages().some(item => item !== page)) throw new Error('Use a dedicated page/context without service workers');
  const popups = (popup: Page) => { if (popup !== page) void popup.close().catch(() => {}); };
  const worker = () => { void page.close({ runBeforeUnload: false }).catch(() => {}); };
  type Permit = { route: string; path: string; body: unknown; expires: number };
  let permit: Permit | undefined;
  const intercept = async (route: Route) => {
    try {
    const request = route.request(), address = new URL(request.url());
    const clean = address.origin === boundary.origin && !address.username && !address.password && !address.search && !address.hash;
    const read = ['GET', 'HEAD'].includes(request.method());
    let allowed = clean && (request.isNavigationRequest()
      ? read && request.frame() === page.mainFrame() && boundary.routes.includes(address.pathname)
      : read && [...boundary.routes, ...boundary.readPaths!].includes(address.pathname));
    if (!read && clean && mode === 'execute' && permit && permit.expires > performance.now() &&
        request.method() === 'POST' && !request.isNavigationRequest() && request.frame() === page.mainFrame() &&
        page.url() === `${boundary.origin}${permit.route}` && address.pathname === permit.path &&
        request.headers()['content-type']?.split(';')[0]?.trim().toLowerCase() === 'application/json') {
      const body = request.postData();
      if (body && Buffer.byteLength(body) <= 64_000) {
        try { allowed = isDeepStrictEqual(JSON.parse(body), permit.body); } catch { /* Malformed bodies never consume authority. */ }
      }
      if (allowed) permit = undefined; // Consume before dispatch; concurrent scripts cannot reuse it.
    }
    if (!allowed) { await route.abort('blockedbyclient'); return; }
    // Playwright routing sees only the first URL of an HTTP redirect. Fetch without following it.
    const response = await route.fetch({ maxRedirects: 0, maxRetries: 0, timeout: 8000 });
    try {
      if (response.status() >= 300 && response.status() < 400) await route.abort('blockedbyclient');
      else await route.fulfill({ response });
    } finally { await response.dispose(); }
    } catch { await route.abort('blockedbyclient').catch(() => {}); }
  };
  // Context interception also covers the initial popup request. HTTP redirects are refused above.
  await context.route('**/*', intercept);
  await context.routeWebSocket('**/*', socket => socket.close());
  context.on('page', popups);
  context.on('serviceworker', worker);
  return Object.freeze({
    /** Host-only, one request, five-second lifetime. Never expose this capability to page/model code. */
    permitWrite(value: { route: string; path: string; body: unknown }) {
      if (mode !== 'execute' || !boundary.routes.includes(value.route) || !boundary.writePaths!.includes(value.path)) throw new Error('Unapproved write capability');
      if (permit && permit.expires > performance.now()) throw new Error('A write capability is already active');
      const serialized = JSON.stringify(value.body);
      if (!serialized || Buffer.byteLength(serialized) > 64_000) throw new Error('Write body exceeds budget');
      const granted: Permit = { route: value.route, path: value.path, body: JSON.parse(serialized), expires: performance.now() + 5000 };
      permit = granted;
      return () => { if (permit === granted) permit = undefined; };
    },
  });
}
