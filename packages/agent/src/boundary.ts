import type { Page, Route } from 'playwright';
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
  const intercept = async (route: Route) => {
    const request = route.request(), address = new URL(request.url());
    const clean = address.origin === boundary.origin && !address.username && !address.password && !address.search && !address.hash;
    const read = ['GET', 'HEAD'].includes(request.method());
    const allowed = clean && (request.isNavigationRequest()
      ? read && request.frame() === page.mainFrame() && boundary.routes.includes(address.pathname)
      : read ? [...boundary.routes, ...boundary.readPaths!].includes(address.pathname)
        : mode === 'execute' && request.method() === 'POST' && boundary.writePaths!.includes(address.pathname));
    await (allowed ? route.continue() : route.abort('blockedbyclient'));
  };
  // Context interception also covers redirects and the initial popup request.
  await context.route('**/*', intercept);
  await context.routeWebSocket('**/*', socket => socket.close());
  context.on('page', popups);
  context.on('serviceworker', worker);
}
