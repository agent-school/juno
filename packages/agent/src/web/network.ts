import http from 'node:http';
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';
import type { BrowserContext } from 'playwright';

export function publicAddress(address: string): boolean {
  try {
    const parsed = ipaddr.process(address);
    return parsed.range() === 'unicast' && (parsed.kind() !== 'ipv6' || /^2[0-9a-f]{3}:/i.test(parsed.toString()));
  } catch { return false; }
}
export function publicUrl(value: string): URL {
  if (value.length > 2000) throw new Error('Public website URLs must be at most 2000 characters.');
  const url = new URL(value);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:' || (url.port && url.port !== '443') || url.username || url.password || !host.includes('.') && !isIP(host) || host.endsWith('.') || host === 'localhost' || /\.(local|internal|localhost)$/i.test(host)) throw new Error('Use an HTTPS URL on a public website, without credentials or a custom port.');
  if (isIP(host) && !publicAddress(host)) throw new Error('Private, reserved and local network addresses are blocked.');
  const unsafe = /^(?:access[_-]?token|api[_-]?key|token|secret|password|auth|authorization|code|signature|sig|action|do|cmd)$/i;
  if ([...url.searchParams.keys()].some(key => unsafe.test(key)) || /\/(?:delete|remove|send|submit|unsubscribe|logout|signout|checkout|purchase|approve|confirm|cancel|pay)(?:\/|$)/i.test(decodeURIComponent(url.pathname))) throw new Error('This URL may carry credentials or trigger an action. Public browsing only.');
  url.hash = '';
  return url;
}

type Address = { address: string; family: number };
/** Validation and the socket share this resolution. A second browser/OS lookup cannot rebind to a private IP. */
export async function resolvePublic(url: URL, resolve: (host: string) => Promise<Address[]> = host => lookup(host, { all: true, verbatim: true })): Promise<Address> {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await resolve(host);
  if (!addresses.length || addresses.some(item => !publicAddress(item.address))) throw new Error('The destination resolves to a non-public network address.');
  return addresses.find(item => item.family === 4) ?? addresses[0]!;
}

export type WebNetworkOptions = { signal: AbortSignal; onBlocked?: (reason: string) => void;
  /** Only supplied by in-process synthetic tests. Never accepted from HTTP or environment input. */
  testOrigins?: readonly string[] };

export async function confinePublicBrowser(context: BrowserContext, options: WebNetworkOptions) {
  let requests = 0, totalBytes = 0;
  const redirects = new Map<string, string>();
  const redirectKey = (value: string) => { const url = new URL(value); url.hash = ''; return url.href; };
  await context.routeWebSocket('**/*', socket => socket.close());
  await context.route('**/*', async route => {
    let destination: URL | undefined;
    try {
      options.signal.throwIfAborted();
      if (++requests > 160) throw new Error('Browser request budget reached.');
      const request = route.request();
      if (!['GET', 'HEAD'].includes(request.method())) throw new Error('External writes are blocked; this task can only browse public information.');
      destination = new URL(request.url());
      const testing = options.testOrigins?.includes(destination.origin) ?? false;
      const url = testing ? destination : publicUrl(destination.href);
      // All DNS results must be public, including IPv4-mapped IPv6. Pin the selected address into the socket.
      const address = testing ? { address: '127.0.0.1', family: 4 } : await resolvePublic(url);
      if (options.signal.aborted) throw new Error('Task stopped.');
      const response = await new Promise<{ status: number; headers: Record<string, string>; body: Buffer }>((resolve, reject) => {
        const headers = request.headers();
        const transport = url.protocol === 'https:' ? https : http;
        const outgoing = transport.request(url, { method: request.method(), agent: false, signal: options.signal, family: address.family,
          lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
          headers: { accept: headers.accept ?? '*/*', 'accept-encoding': 'identity', 'user-agent': headers['user-agent'] ?? 'Juno/0.1', ...(headers.origin ? { origin: headers.origin } : {}) },
        }, incoming => {
          const encoding = incoming.headers['content-encoding'];
          if (encoding && encoding !== 'identity') { incoming.destroy(); reject(new Error('Compressed response cannot be bounded safely.')); return; }
          const chunks: Buffer[] = []; let size = 0;
          incoming.on('data', (chunk: Buffer) => {
            size += chunk.length; totalBytes += chunk.length;
            if (size > 2_000_000 || totalBytes > 16_000_000) { incoming.destroy(new Error('Browser response budget reached.')); return; }
            chunks.push(chunk);
          });
          incoming.on('error', reject);
          incoming.on('end', () => {
            // Never forward cookies, authentication, or browser-controlled redirect-following to the transport.
            // Redirects are NOT passed to Chromium: Playwright may route only the initial redirect URL.
            const safeHeaders: Record<string, string> = {};
            for (const name of ['content-type', 'location', 'content-security-policy', 'x-content-type-options', 'access-control-allow-origin']) {
              const value = incoming.headers[name]; if (typeof value === 'string') safeHeaders[name] = value;
            }
            resolve({ status: incoming.statusCode ?? 502, headers: safeHeaders, body: Buffer.concat(chunks) });
          });
        });
        outgoing.on('error', reject);
        outgoing.setTimeout(10_000, () => outgoing.destroy(new Error('Public website request timed out.')));
        outgoing.end();
      });
      options.signal.throwIfAborted();
      if (response.status >= 300 && response.status < 400 && response.headers.location) {
        const target = new URL(response.headers.location, url);
        if (!options.testOrigins?.includes(target.origin)) publicUrl(target.href);
        if (!request.isNavigationRequest() || request.frame().parentFrame()) throw new Error('Subresource redirects are blocked.');
        redirects.set(redirectKey(request.url()), target.href);
        await route.fulfill({ status: 409, contentType: 'text/html', body: '<main>Juno is validating a navigation redirect.</main>' });
        return;
      }
      await route.fulfill(response);
    } catch {
      // Do not persist raw network errors, headers or credential-bearing request URLs.
      options.onBlocked?.(destination ? 'A browser request was blocked by the public-read boundary or its resource budget.' : 'A browser request was blocked.');
      await route.abort('blockedbyclient').catch(() => {});
    }
  });
  return { takeRedirect(url: string) { const key = redirectKey(url); const target = redirects.get(key); redirects.delete(key); return target; } };
}
