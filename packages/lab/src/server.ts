import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Store } from './store.js';
import { Runner } from './runner.js';
import { InputSchema, RunSchema, VariantSchema } from './contracts.js';
import { fixture } from './fixture.js';
import { Accounts, CredentialsSchema } from './accounts.js';
import { ResearchService } from './research.js';
import { TaskRequestSchema, PreferencesSchema, editNote } from './workspace.js';

const port = Number(process.env.PORT ?? 5123);
const store = new Store(path.resolve(process.env.JUNO_LAB_DATA_DIR ?? '.juno-lab'));
const runner = new Runner(store, `http://127.0.0.1:${port}`);
const accounts = new Accounts(store.directory);
const research = new ResearchService(store);
const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const rates = new Map<string, { at: number; count: number }>();
const assets: Record<string, [string, string]> = {
  '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'],
  '/app.css': ['app.css', 'text/css'], '/fixture.js': ['fixture.js', 'text/javascript'],
  '/fixture.css': ['fixture.css', 'text/css'],
  '/workspace.js': ['workspace.js', 'text/javascript'], '/workspace.css': ['workspace.css', 'text/css'],
  '/fonts/public-sans-latin.woff2': ['fonts/public-sans-latin.woff2', 'font/woff2'],
  '/fonts/sora-latin.woff2': ['fonts/sora-latin.woff2', 'font/woff2'],
};
class HttpError extends Error { constructor(readonly status: number, message: string) { super(message); } }
function send(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
}
async function body(req: IncomingMessage): Promise<unknown> {
  let bytes = 0;
  const parts: Buffer[] = [];
  for await (const part of req) {
    const buffer = Buffer.from(part);
    bytes += buffer.length;
    if (bytes > 8192) throw new HttpError(413, 'Request too large');
    parts.push(buffer);
  }
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); }
  catch { throw new HttpError(400, 'Invalid JSON'); }
}
function setCookie(req: IncomingMessage, res: ServerResponse, owner: string): void {
  const secure = req.headers['x-forwarded-proto'] === 'https' || !!('encrypted' in req.socket && req.socket.encrypted);
  res.setHeader('set-cookie', `juno_lab=${owner}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${secure ? '; Secure' : ''}`);
}
function session(req: IncomingMessage, res: ServerResponse): string {
  const value = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith('juno_lab='))?.slice(9);
  if (value && /^[a-f0-9]{64}$/.test(value) && store.exists(value)) return value;
  const owner = randomBytes(32).toString('hex');
  store.create(owner);
  setCookie(req, res, owner);
  return owner;
}
const server = http.createServer(async (req, res) => {
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'same-origin');
  res.setHeader('x-robots-tag', 'noindex, nofollow');
  res.setHeader('x-frame-options', 'SAMEORIGIN');
  res.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'");
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/healthz' && req.method === 'GET') return send(res, 200, { status: 'ok', mode: 'research-and-owned-fixture' });
    if (req.method !== 'GET' && req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
    if (req.method === 'GET' && assets[url.pathname]) {
      const [file, type] = assets[url.pathname]!;
      if (url.pathname === '/') session(req, res);
      res.writeHead(200, { 'content-type': type.startsWith('text/') ? `${type}; charset=utf-8` : type });
      res.end(fs.readFileSync(path.join(publicDir, file)));
      return;
    }
    if (!url.pathname.startsWith('/api/') && url.pathname !== '/fixture') throw new HttpError(404, 'Not found');
    const owner = session(req, res);
    if (req.method === 'POST') {
      // Custom header is unforgeable by cross-origin forms; no CORS allowance is emitted.
      if (req.headers['x-juno-request'] !== '1' || req.headers['sec-fetch-site'] === 'cross-site') throw new HttpError(403, 'Same-origin request required');
      const now = Date.now();
      const rate = rates.get(owner);
      if (!rate || now - rate.at > 60_000) rates.set(owner, { at: now, count: 1 });
      else if (++rate.count > 40) throw new HttpError(429, 'Too many requests. Wait a minute.');
    }
    if (req.method === 'GET' && url.pathname === '/fixture') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(fixture(store.read(owner)));
    }
    if (req.method === 'GET' && ['/api/state', '/api/export'].includes(url.pathname)) {
      if (url.pathname === '/api/export') res.setHeader('content-disposition', 'attachment; filename="juno-lab-evidence.json"');
      return send(res, 200, { ...store.read(owner), browserBusy: runner.isBusy() });
    }
    if (req.method === 'GET' && url.pathname === '/api/workspace') {
      return send(res, 200, { ...store.read(owner).workspace, account: accounts.handle(owner), researchBusy: research.isBusy() });
    }
    if (req.method === 'GET' && url.pathname === '/api/site-knowledge') {
      return send(res, 200, { versions: runner.inspectKnowledge(owner) });
    }
    if (req.method !== 'POST') throw new HttpError(404, 'Not found');
    const payload = await body(req);
    if (url.pathname === '/api/site-knowledge/forget') {
      z.object({}).strict().parse(payload);
      runner.forgetKnowledge(owner);
      return send(res, 200, { forgotten: true });
    }
    if (url.pathname === '/api/account/register') {
      const data = CredentialsSchema.parse(payload);
      try { await accounts.register(owner, data); }
      catch (error) { throw new HttpError(409, error instanceof Error ? error.message : 'Workspace unavailable'); }
      return send(res, 201, { handle: data.handle });
    }
    if (url.pathname === '/api/account/login') {
      const data = CredentialsSchema.parse(payload);
      try { const restored = await accounts.login(data); setCookie(req, res, restored); }
      catch (error) { throw new HttpError(401, error instanceof Error ? error.message : 'Workspace unavailable'); }
      return send(res, 200, { restored: true });
    }
    if (url.pathname === '/api/account/logout') {
      z.object({}).strict().parse(payload);
      const fresh = randomBytes(32).toString('hex'); store.create(fresh); setCookie(req, res, fresh);
      return send(res, 200, { signedOut: true });
    }
    if (url.pathname === '/api/tasks') {
      const data = TaskRequestSchema.parse(payload);
      try { return send(res, 202, research.start(owner, data.requestId, data.task)); }
      catch (error) { throw new HttpError(409, error instanceof Error ? error.message : 'Research unavailable'); }
    }
    if (url.pathname === '/api/tasks/stop') {
      z.object({}).strict().parse(payload); research.cancel(owner);
      return send(res, 200, { stopRequested: true });
    }
    if (url.pathname === '/api/tasks/forget') {
      const data = z.object({ id: z.uuid() }).strict().parse(payload);
      store.update(owner, state => {
        const workspace = state.workspace;
        const index = workspace.tasks.findIndex(task => task.id === data.id);
        if (index < 0) throw new HttpError(404, 'Task not found.');
        if (workspace.tasks[index]?.status === 'running') throw new HttpError(409, 'Stop the task and wait for it to finish first.');
        if (workspace.retiredTaskIds.length >= 1000) throw new HttpError(409, 'Workspace retention limit reached. Export your memory and start a new workspace.');
        workspace.tasks.splice(index, 1); workspace.retiredTaskIds.push(data.id);
      });
      return send(res, 200, { forgotten: true });
    }
    if (url.pathname === '/api/memory/preferences') {
      const data = PreferencesSchema.parse(payload);
      store.update(owner, state => { state.workspace.preferences = { ...data, version: state.workspace.preferences.version + 1, updatedAt: new Date().toISOString() }; });
      return send(res, 200, { saved: true });
    }
    if (url.pathname === '/api/memory/note') {
      const data = z.object({ id: z.uuid().optional(), text: z.string().trim().min(1).max(2000) }).strict().parse(payload);
      try { store.update(owner, state => { editNote(state.workspace, data.id, data.text); }); }
      catch (error) { throw new HttpError(409, error instanceof Error ? error.message : 'Note unavailable'); }
      return send(res, 200, { saved: true });
    }
    if (url.pathname === '/api/memory/project') {
      const data = z.object({ taskId: z.uuid(), fullName: z.string().max(200) }).strict().parse(payload);
      store.update(owner, state => {
        const workspace = state.workspace;
        const task = workspace.tasks.find(task => task.id === data.taskId);
        if (!task || !['completed', 'partial'].includes(task.status)) throw new HttpError(409, 'Choose a finished task with checked sources.');
        const found = task.results.find(result => result.fullName === data.fullName);
        if (!found) throw new HttpError(404, 'Checked project not found in this workspace.');
        const previous = workspace.projects.find(item => item.project.fullName === found.fullName);
        if (!previous && workspace.projects.length >= 5) throw new HttpError(409, 'Five-project watchlist limit reached. Forget a project first.');
        if (previous && previous.project.observedAt > found.observedAt) throw new HttpError(409, 'A newer source is already remembered.');
        const saved = { id: previous?.id ?? randomUUID(), project: found, taskId: task.id, savedAt: new Date().toISOString(), origin: 'github-api' as const, confidence: 'source-checked' as const };
        if (previous) workspace.projects[workspace.projects.indexOf(previous)] = saved;
        else workspace.projects.push(saved);
      });
      return send(res, 200, { remembered: true });
    }
    if (url.pathname === '/api/memory/recipe') {
      const data = z.object({ taskId: z.uuid(), name: z.string().trim().min(1).max(80) }).strict().parse(payload);
      store.update(owner, state => {
        const task = state.workspace.tasks.find(task => task.id === data.taskId);
        if (!task || task.resolved.kind !== 'search' || !['completed', 'partial'].includes(task.status)) throw new HttpError(409, 'Choose a finished search first.');
        if (state.workspace.recipes.length >= 20) throw new HttpError(409, 'Search recipe limit reached. Forget a recipe first.');
        state.workspace.recipes.push({ id: randomUUID(), name: data.name, search: task.resolved, createdAt: new Date().toISOString() });
      });
      return send(res, 201, { remembered: true });
    }
    if (url.pathname === '/api/memory/forget') {
      const data = z.object({ kind: z.enum(['notes', 'projects', 'recipes']), id: z.uuid() }).strict().parse(payload);
      store.update(owner, state => {
        const items = state.workspace[data.kind];
        const index = items.findIndex(item => item.id === data.id);
        if (index < 0) throw new HttpError(404, 'Memory not found.');
        items.splice(index, 1);
        // Forget private note text from historical recalled context as well as current memory.
        if (data.kind === 'notes') for (const task of state.workspace.tasks) task.recalled.notes = task.recalled.notes.filter(note => note.id !== data.id);
        if (data.kind === 'projects') for (const task of state.workspace.tasks) task.recalled.baselines = task.recalled.baselines.filter(project => project.id !== data.id);
      });
      return send(res, 200, { forgotten: true });
    }
    if (url.pathname === '/api/stop') { await runner.cancel(owner); return send(res, 200, { stopped: true }); }
    if (url.pathname === '/api/compile') {
      if (runner.isBusy()) throw new HttpError(409, 'Browser busy. Try again in a moment.');
      try { await runner.compile(owner); } catch { throw new HttpError(422, 'Could not bind unique controls. Remove ambiguity or check that Chromium is available. Existing model was kept.'); }
      return send(res, 200, store.read(owner).model);
    }
    if (url.pathname === '/api/run') {
      const data = RunSchema.parse(payload);
      try { return send(res, 200, await runner.run(owner, data.requestId, data.inputs)); }
      catch (error) { throw new HttpError(409, error instanceof Error ? error.message : 'Run unavailable'); }
    }
    if (url.pathname === '/api/variant') {
      const data = z.object({ variant: VariantSchema }).strict().parse(payload);
      if (runner.isBusy()) throw new HttpError(409, 'Wait for the browser to finish before changing the page.');
      store.update(owner, state => { state.variant = data.variant; });
      return send(res, 200, { variant: data.variant });
    }
    if (url.pathname === '/api/interactions') {
      const data = z.object({ requestId: z.uuid(), inputs: InputSchema }).strict().parse(payload);
      let created = false;
      store.update(owner, state => {
        const old = state.interactions.find(item => item.requestId === data.requestId);
        if (old) {
          const { id: _id, requestId: _requestId, ...oldInputs } = old;
          if (JSON.stringify(oldInputs) !== JSON.stringify(data.inputs)) throw new HttpError(409, 'Request ID conflict');
          return;
        }
        if (state.interactions.length >= 100) throw new HttpError(409, 'Session interaction limit reached');
        if (state.variant === 'no-effect') return;
        state.interactions.push({ id: randomUUID(), requestId: data.requestId, ...data.inputs });
        created = true;
      });
      return send(res, 200, { accepted: true, created });
    }
    if (url.pathname === '/api/feedback') {
      const data = z.object({ runId: z.uuid().nullable(), text: z.string().trim().min(1).max(2000) }).strict().parse(payload);
      store.update(owner, state => {
        if (state.feedback.length >= 100) throw new HttpError(409, 'Session feedback limit reached');
        if (data.runId && !state.receipts.some(receipt => receipt.id === data.runId)) throw new HttpError(400, 'Unknown run');
        state.feedback.push({ ...data, id: randomUUID(), createdAt: new Date().toISOString() });
      });
      return send(res, 201, { saved: true });
    }
    throw new HttpError(404, 'Not found');
  } catch (error) {
    if (res.headersSent) { res.end(); return; }
    if (error instanceof z.ZodError) return send(res, 400, { error: 'Invalid request', issues: error.issues.map(issue => ({ path: issue.path, message: issue.message })) });
    if (error instanceof HttpError) return send(res, error.status, { error: error.message });
    console.error('Lab request failed:', error instanceof Error ? error.name : 'unknown');
    send(res, 500, { error: 'Lab could not complete the request. Check server availability or data capacity.' });
  }
});
server.requestTimeout = 45_000;
server.headersTimeout = 10_000;
server.listen(port, process.env.HOST ?? '0.0.0.0', () => console.log(`Juno lab listening on ${port}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 8000).unref();
});
