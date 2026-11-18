import { test, expect } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { SiteKnowledgeStore } from '@juno/knowledge';
import { runWebTask, WebTaskSchema, type WebTask, type WebInterpreter } from '../../src/web/index.js';
import { confinePublicBrowser } from '../../src/web/network.js';

async function fixture(html: (url: string) => string) {
  let writes = 0, secrets = 0;
  const server = http.createServer((req, res) => {
    if (req.method === 'POST') { writes++; res.end('written'); return; }
    if (req.url === '/private') { secrets++; res.end('private'); return; }
    if (req.url === '/redirect') { res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' }); res.end(); return; }
    if (req.url === '/redirect-public') { res.writeHead(302, { location: '/pricing' }); res.end(); return; }
    if (req.url === '/fragment-start') { res.writeHead(302, { location: '/fragment-middle#section' }); res.end(); return; }
    if (req.url === '/fragment-middle') { res.writeHead(302, { location: '/pricing#cost' }); res.end(); return; }
    res.setHeader('content-type', 'text/html'); res.end(html(req.url ?? '/'));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  return { origin, writes: () => writes, secrets: () => secrets, close: () => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }) };
}
function task(urls: string[], mode: 'agent' | 'evidence' = 'agent'): WebTask {
  const now = new Date().toISOString();
  return WebTaskSchema.parse({ schemaVersion: 1, id: randomUUID(), createdAt: now, updatedAt: now, input: { goal: 'Compare product plans and extract the price and admission deadline', urls, mode }, status: 'ready', pages: [], events: [] });
}

test('general loop composes navigation, comparison and extraction across unrelated sites, reuses memory and rejects invented evidence', async ({}, info) => {
  const a = await fixture(url => url === '/pricing' ? '<main><h1>North pricing</h1><p>The North starter plan costs 19 dollars per month.</p></main>' : '<main><h1>North project</h1><p>North is a public comparison product with useful documentation.</p><a href="/pricing">Pricing plans</a></main>');
  const b = await fixture(() => '<main><h1>University admissions</h1><p>The admission application deadline is December 15.</p></main>');
  const knowledge = new SiteKnowledgeStore(info.outputPath('knowledge')), owner = 'a'.repeat(64);
  const first = task([a.origin, b.origin]);
  const interpret: WebInterpreter = async ({ pages }) => pages.length === 2 ? { action: 'follow', pageId: 'p1', linkId: 'l1', reason: 'Find the actual product price' } : {
    action: 'finish', answer: 'North costs 19 dollars per month [p3]. The admission deadline is December 15 [p2].',
    citations: [{ pageId: 'p3', quote: 'The North starter plan costs 19 dollars per month.' }, { pageId: 'p2', quote: 'The admission application deadline is December 15.' }],
    rows: [{ label: 'Price', value: '19 dollars', pageId: 'p3', quote: 'The North starter plan costs 19 dollars per month.' }],
  };
  try {
    const run = (current: WebTask, model = interpret, signal = new AbortController().signal) => runWebTask({ task: current, owner, knowledge, interpret: model, signal, testOrigins: [a.origin, b.origin], save: value => fs.writeFileSync(info.outputPath(`${current.id}.json`), JSON.stringify(value)) });
    await run(first);
    expect(first.status, JSON.stringify(first.events)).toBe('answered'); expect(first.pages).toHaveLength(3);
    expect(first.rows[0]?.value).toBe('19 dollars'); expect(first.modelCalls).toBe(2);
    expect(knowledge.latest(owner, a.origin)?.pages).toHaveLength(2);
    expect(knowledge.latest(owner, a.origin)?.operations).toEqual([]);
    const redirected = task([`${a.origin}/redirect-public`], 'evidence'); await run(redirected);
    expect(redirected.status).toBe('evidence'); expect(redirected.pages[0]?.url).toBe(`${a.origin}/pricing`);
    const fragments = task([`${a.origin}/fragment-start`], 'evidence'); await run(fragments);
    expect(fragments.status, JSON.stringify(fragments.events)).toBe('evidence'); expect(fragments.pages[0]?.url).toBe(`${a.origin}/pricing`);
    const second = task([a.origin], 'evidence'); await run(second);
    expect(second.status).toBe('evidence'); expect(second.modelCalls).toBe(0); expect(second.pages[0]?.memory?.reused).toBe(true);
    expect(knowledge.latest(owner, a.origin)?.pages).toHaveLength(2);
    expect(new SiteKnowledgeStore(info.outputPath('knowledge')).latest(owner, b.origin)).not.toBeNull();
    const fake = task([a.origin]); await run(fake, async () => ({ action: 'finish', answer: 'Untrue', citations: [{ pageId: 'p1', quote: 'The imaginary price is one million dollars.' }] }));
    expect(fake.status).toBe('failed'); expect(fake.answer).toBeUndefined();
    const raw = task([a.origin]); await run(raw, async () => ({ action: 'click', selector: '#send' }));
    expect(raw.status).toBe('failed'); expect(raw.answer).toBeUndefined();
    const abort = new AbortController(), stopped = task([a.origin]);
    await run(stopped, async () => { abort.abort(); return new Promise(() => {}); }, abort.signal);
    expect(stopped.status).toBe('stopped'); expect(stopped.pages).toHaveLength(1);
    expect(a.writes() + b.writes()).toBe(0);
  } finally { await Promise.all([a.close(), b.close()]); }
});

test('browser scripts cannot post, redirect to metadata or access another private origin', async () => {
  const secret = await fixture(() => '<main>Private service, never readable.</main>');
  const publicFixture = await fixture(() => `<main><h1>Public source</h1><p>This page has enough public text for independent observation.</p></main><script>fetch('/write',{method:'POST',body:'bad'}).catch(()=>{});fetch('${secret.origin}/private').catch(()=>{});</script>`);
  const browser = await chromium.launch({ headless: true, ...(process.env.JUNO_AGENT_CHANNEL === 'chromium' ? {} : { channel: 'chrome' }) });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await confinePublicBrowser(context, { signal: new AbortController().signal, testOrigins: [publicFixture.origin] });
    const page = await context.newPage(); await page.goto(publicFixture.origin);
    await page.waitForLoadState('networkidle');
    expect(publicFixture.writes()).toBe(0); expect(secret.secrets()).toBe(0);
    await expect(page.goto(`${publicFixture.origin}/redirect`)).rejects.toThrow();
    expect(secret.secrets()).toBe(0);
  } finally { await browser.close(); await Promise.all([secret.close(), publicFixture.close()]); }
});
