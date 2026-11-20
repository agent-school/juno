import { test, expect } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { SiteKnowledgeStore } from '@juno/knowledge';
import { createWebInterpreter, runWebTask, WebTaskSchema, type WebTask, type WebInterpreter } from '../../src/web/index.js';
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
    expect(fake.modelCalls).toBe(3); // Two corrections, always within the existing decision budget.
    const corrected = task([a.origin]);
    await run(corrected, async ({ feedback }) => feedback ? {
      action: 'finish', answer: 'North is a public comparison product [p1].',
      citations: [{ pageId: 'p1', quote: 'North is a public comparison product with useful documentation.' }],
    } : { action: 'finish', answer: 'Untrue', citations: [{ pageId: 'p1', quote: 'The imaginary price is one million dollars.' }] });
    expect(corrected.status).toBe('answered'); expect(corrected.modelCalls).toBe(2);
    expect(corrected.answer).not.toContain('Untrue');
    const raw = task([a.origin]); await run(raw, async () => ({ action: 'click', selector: '#send' }));
    expect(raw.status).toBe('failed'); expect(raw.answer).toBeUndefined();
    expect(raw.modelCalls).toBe(3);
    const malformed = task([a.origin]);
    await run(malformed, async ({ feedback }) => feedback ? {
      action: 'finish', answer: 'North is a public comparison product [p1].', citations: [{ pageId: 'p1', quote: 'North is a public comparison product with useful documentation.' }],
    } : { action: 'click', selector: '#send' });
    expect(malformed.status).toBe('answered'); expect(malformed.modelCalls).toBe(2);
    const interpreted = task([a.origin]);
    await run(interpreted, async ({ feedback, previousProposal }) => {
      if (feedback) {
        expect(feedback).toContain('rows[0].value');
        expect(previousProposal).toMatchObject({ rows: [{ value: 'No (not mentioned in source)' }] });
      } else expect(previousProposal).toBeUndefined();
      return { action: 'finish', answer: 'The source describes a public comparison product [p1].',
        citations: [{ pageId: 'p1', quote: 'North is a public comparison product with useful documentation.' }],
        rows: feedback ? [] : [{ label: 'Missing feature', value: 'No (not mentioned in source)', pageId: 'p1', quote: 'North is a public comparison product with useful documentation.' }] };
    });
    expect(interpreted.status).toBe('answered'); expect(interpreted.modelCalls).toBe(2); expect(interpreted.rows).toEqual([]);
    const references = task([a.origin]);
    await run(references, async ({ pages, feedback, previousProposal }) => {
      if (references.modelCalls === 1) return { action: 'follow', pageId: 'p1', linkId: 'invented', reason: 'Invalid link must not navigate' };
      if (references.modelCalls === 2) {
        expect(feedback).toContain('not observed'); expect(previousProposal).toMatchObject({ linkId: 'invented' });
        return { action: 'read', pageId: 'p1', offset: pages[0]!.text.length };
      }
      if (references.modelCalls === 3) {
        expect(feedback).toContain('at or beyond its end'); expect(previousProposal).toMatchObject({ offset: pages[0]!.text.length });
        return { action: 'follow', pageId: 'p1', linkId: 'l1', reason: 'Read the actual published price' };
      }
      expect(feedback).toBeUndefined();
      return { action: 'finish', answer: 'North costs 19 dollars per month [p2].', citations: [{ pageId: 'p2', quote: 'The North starter plan costs 19 dollars per month.' }] };
    });
    expect(references.status, JSON.stringify(references.events)).toBe('answered'); expect(references.modelCalls).toBe(4);
    expect(references.pages).toHaveLength(2); expect(references.events.filter(event => event.kind === 'opening')).toHaveLength(2);
    const reviewed = task([a.origin]);
    const reviewing: WebInterpreter = Object.assign(async ({ reviewDraft }: Parameters<WebInterpreter>[0]) => {
      expect(reviewed.answer).toBeUndefined(); expect(reviewed.citations).toEqual([]);
      if (reviewDraft) expect(reviewDraft.answer).toContain('private');
      return { action: 'finish', answer: reviewDraft ? 'North is a public comparison product [p1].' : 'North is a private product [p1].', citations: [{ pageId: 'p1', quote: 'North is a public comparison product with useful documentation.' }] };
    }, { reviewAnswers: true });
    await run(reviewed, reviewing);
    expect(reviewed.status).toBe('answered'); expect(reviewed.modelCalls).toBe(2); expect(reviewed.answer).not.toContain('private');
    const rejectedReview = task([a.origin]);
    await run(rejectedReview, Object.assign(async ({ reviewDraft }: Parameters<WebInterpreter>[0]) => ({ action: 'finish', answer: 'Draft must not leak', citations: [{ pageId: 'p1', quote: reviewDraft ? 'Invented text that was never observed.' : 'North is a public comparison product with useful documentation.' }] }), { reviewAnswers: true }));
    expect(rejectedReview.status).toBe('failed'); expect(rejectedReview.modelCalls).toBe(4);
    expect(rejectedReview.answer).toBeUndefined(); expect(rejectedReview.citations).toEqual([]);
    const nativeReview = task([a.origin]), originalFetch = globalThis.fetch;
    let nativeCalls = 0;
    globalThis.fetch = async (_url, init) => {
      const input = JSON.parse(JSON.parse(init!.body as string).messages.find((message: { role: string }) => message.role === 'user').content);
      nativeCalls++; expect(nativeReview.answer).toBeUndefined(); expect(nativeReview.citations).toEqual([]);
      if (nativeCalls === 5) { expect(input.reviewDraft).toBeUndefined(); expect(input.feedback).toContain('Source consistency'); }
      const result = input.parts ? { checks: Object.fromEntries(input.parts.map((part: { id: string }) => [part.id, nativeCalls === 4 ? 'scope' : 'none'])) }
        : { action: 'finish', answer: nativeCalls <= 3 ? 'North is private [p1].' : 'North is a public comparison product [p1].', citations: [{ pageId: 'p1', quoteId: nativeCalls <= 2 ? 'invented' : 'q0-1' }] };
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result) } }] }));
    };
    try { await run(nativeReview, createWebInterpreter({ apiKey: 'synthetic-test-key', model: 'test' })); }
    finally { globalThis.fetch = originalFetch; }
    expect(nativeReview.status, JSON.stringify(nativeReview.events)).toBe('answered'); expect(nativeReview.modelCalls).toBe(6);
    expect(nativeReview.answer).not.toContain('private');
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
    const network = await confinePublicBrowser(context, { signal: new AbortController().signal, testOrigins: [publicFixture.origin] });
    const page = await context.newPage(); await page.goto(publicFixture.origin);
    await page.waitForLoadState('networkidle');
    expect(publicFixture.writes()).toBe(0); expect(secret.secrets()).toBe(0);
    await expect(page.goto(`${publicFixture.origin}/redirect`)).rejects.toThrow();
    expect(secret.secrets()).toBe(0);
    const budgetPage = await context.newPage();
    await budgetPage.goto(publicFixture.origin);
    await budgetPage.evaluate(() => Promise.allSettled(Array.from({ length: 165 }, (_, i) => fetch(`/budget?i=${i}`))));
    expect(network.budgetError()).toContain('browser request budget');
  } finally { await browser.close(); await Promise.all([secret.close(), publicFixture.close()]); }
});
