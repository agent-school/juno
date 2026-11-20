import { setTimeout as delay } from 'node:timers/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { z } from 'zod';

export type CdpStage = 'configuration' | 'readiness' | 'metadata' | 'attach' | 'context';

export class CdpError extends Error {
  readonly code = 'CDP_ERROR';
  constructor(readonly stage: CdpStage, message: string) {
    super(`CDP ${stage}: ${message}`);
    this.name = 'CdpError';
  }
}

export interface CdpReadinessOptions {
  endpoint: string;
  timeoutMs?: number;
  intervalMs?: number;
  fetch?: typeof fetch;
}

function requestVersion(url: URL, signal: AbortSignal): Promise<Response> {
  return new Promise((resolve, reject) => {
    // Node's fetch ignores Host overrides. Use the native client for Chrome's DNS-rebinding boundary.
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
      headers: { Host: 'localhost' }, signal,
    }, response => {
      const chunks: Buffer[] = []; let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 65_536) { reject(new CdpError('metadata', 'browser response exceeds 64 KB')); response.destroy(); request.destroy(); }
        else chunks.push(chunk);
      });
      response.once('error', reject);
      response.once('end', () => {
        const status = response.statusCode ?? 500;
        resolve(new Response([204, 205, 304].includes(status) ? null : Buffer.concat(chunks), { status }));
      });
    });
    request.once('error', reject); request.end();
  });
}

const metadataSchema = z.object({
  Browser: z.string().trim().min(1).max(256),
  'Protocol-Version': z.string().trim().min(1).max(64),
  webSocketDebuggerUrl: z.string().max(2048),
});

export function cdpOrigin(raw: string): URL {
  let endpoint: URL;
  try { endpoint = new URL(raw); }
  catch { throw new CdpError('configuration', 'provide an explicit HTTP(S) CDP origin'); }
  if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password ||
      endpoint.search || endpoint.hash || endpoint.pathname !== '/') {
    throw new CdpError('configuration', 'endpoint must be an HTTP(S) origin without credentials, path, query or fragment');
  }
  return endpoint;
}

export function normalizeCdpMetadata(value: unknown, endpoint: URL) {
  const parsed = metadataSchema.safeParse(value);
  if (!parsed.success) throw new CdpError('metadata', 'invalid browser version response');
  let socket: URL;
  try { socket = new URL(parsed.data.webSocketDebuggerUrl); }
  catch { throw new CdpError('metadata', 'invalid browser websocket URL'); }
  const protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:';
  if (socket.protocol !== protocol || socket.username || socket.password || socket.hash ||
      !/^\/devtools\/browser\/[^/]+$/.test(socket.pathname)) {
    throw new CdpError('metadata', 'expected a browser websocket with matching transport security');
  }
  socket.hostname = endpoint.hostname;
  socket.port = endpoint.port || (endpoint.protocol === 'https:' ? '443' : '80');
  return { browserVersion: parsed.data.Browser, protocolVersion: parsed.data['Protocol-Version'], websocket: socket.toString() };
}

/** Explicit control-plane configuration only; page content never chooses a CDP endpoint. */
export async function waitForCdp(options: CdpReadinessOptions) {
  const endpoint = cdpOrigin(options.endpoint);
  const timeout = options.timeoutMs ?? 10_000, interval = options.intervalMs ?? 100;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 120_000 ||
      !Number.isInteger(interval) || interval < 1 || interval > timeout) {
    throw new CdpError('configuration', 'readiness timeout/interval must be bounded positive milliseconds');
  }
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const probe = async () => {
        const url = new URL('/json/version/', endpoint);
        const response = options.fetch ? await options.fetch(url, {
          // Chrome rejects DNS aliases in the Host header. The connection still uses only the trusted endpoint.
          headers: { Host: 'localhost' }, redirect: 'error', signal: controller.signal,
        }) : await requestVersion(url, controller.signal);
        if (!response.ok) throw new Error('CDP is not ready');
        const reader = response.body?.getReader();
        if (!reader) throw new CdpError('metadata', 'empty browser response');
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > 65_536) throw new CdpError('metadata', 'browser response exceeds 64 KB');
            chunks.push(chunk.value);
          }
        } finally { await reader.cancel(); }
        let json: unknown;
        try { json = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
        catch { throw new CdpError('metadata', 'malformed browser JSON'); }
        return normalizeCdpMetadata(json, endpoint);
      };
      return await Promise.race([probe(), new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new CdpError('readiness', 'deadline exceeded')); }, deadline - Date.now());
      })]);
    } catch (error) {
      if (error instanceof CdpError) throw error;
    } finally { clearTimeout(timer); controller.abort(); }
    await delay(Math.min(interval, Math.max(0, deadline - Date.now())));
  }
  throw new CdpError('readiness', `browser unavailable at ${endpoint.origin} within deadline`);
}
