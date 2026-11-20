import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { SiteKnowledgeStore } from '@juno/knowledge';
import { createWebInterpreter, runWebTask, WebTaskInputSchema, WebTaskSchema, type WebTask } from '@juno/agent/web';
import { publicUrl } from '@juno/agent/web';
import { AgentError } from './agent.js';
import { plannerConnection, plannerStatus } from './model.js';

const ownerSchema = z.string().regex(/^[a-f0-9]{64}$/);
const uuid = z.uuid();
type Active = { owner: string; id: string; abort: AbortController; promise: Promise<void> };

/** General public-web workspace. Credentials and execution authority never come from task JSON. */
export class WebAgentService {
  private active?: Active;
  private closing = false;
  constructor(private readonly directory: string, private readonly otherBrowserBusy = () => false) {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  }
  isBusy() { return !!this.active; }
  private workspace(owner: string) { return path.join(this.directory, ownerSchema.parse(owner)); }
  private file(owner: string, id: string, extension = 'json') { return path.join(this.workspace(owner), 'tasks', `${uuid.parse(id)}.${extension}`); }
  private write(owner: string, task: WebTask) {
    const file = this.file(owner, task.id);
    const value = JSON.stringify(WebTaskSchema.parse(task));
    if (Buffer.byteLength(value) > 2_650_000) throw new AgentError(409, 'Task evidence exceeds its storage limit.');
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      const fd = fs.openSync(temporary, 'wx', 0o600);
      try { fs.writeFileSync(fd, value); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      fs.renameSync(temporary, file);
    } finally { fs.rmSync(temporary, { force: true }); }
  }
  detail(owner: string, id: string) {
    const file = this.file(owner, id);
    if (!fs.existsSync(file)) throw new AgentError(404, 'Task not found in this workspace.');
    if (fs.statSync(file).size > 2_650_000) throw new AgentError(409, 'Task evidence exceeds its storage limit.');
    const task = WebTaskSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
    if (task.id !== id) throw new AgentError(409, 'Task identity mismatch.');
    if (task.status === 'running' && !(this.active?.owner === owner && this.active.id === id)) {
      task.status = 'interrupted'; task.error = 'The worker restarted. Saved evidence is available. Review a new task to browse again.';
      this.write(owner, task);
    }
    return { ...task, hasScreenshot: fs.existsSync(this.file(owner, id, 'png')) };
  }
  private tasks(owner: string) {
    const directory = path.join(this.workspace(owner), 'tasks');
    return fs.existsSync(directory) ? fs.readdirSync(directory).filter(file => /^[a-f0-9-]{36}\.json$/.test(file)).map(file => this.detail(owner, file.slice(0, -5))).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
  }
  modelStatus() { return plannerStatus(); }
  state(owner: string) {
    return { busy: this.isBusy() || this.otherBrowserBusy(), activeId: this.active?.owner === owner ? this.active.id : null,
      model: this.modelStatus(), tasks: this.tasks(owner).map(({ pages, events, answer, rows, citations, ...summary }) => ({ ...summary, pageCount: pages.length })),
      sites: this.knowledge(owner).map(model => ({ origin: model.origin, version: model.version, observedAt: model.observedAt, pages: model.pages.length })),
      capabilities: ['public-navigation', 'source-evidence', 'multi-site-comparison', 'structured-extraction', 'cited-answers', 'durable-site-structure'],
    };
  }
  prepare(owner: string, value: unknown) {
    if (this.closing) throw new AgentError(503, 'Juno is restarting.');
    const input = WebTaskInputSchema.parse(value);
    if (input.parentId) this.detail(owner, input.parentId);
    try { input.urls = [...new Set(input.urls.map(value => publicUrl(value).href))]; }
    catch (error) { throw new AgentError(400, error instanceof Error ? error.message : 'Invalid public URL.'); }
    if (!fs.existsSync(this.workspace(owner)) && fs.readdirSync(this.directory).length >= 100) throw new AgentError(409, 'Hosted workspace capacity reached.');
    if (this.tasks(owner).length >= 30) throw new AgentError(409, 'This workspace has thirty saved tasks. Download receipts and forget old tasks before starting another.');
    const now = new Date().toISOString();
    const task = WebTaskSchema.parse({ schemaVersion: 1, id: randomUUID(), createdAt: now, updatedAt: now, input, status: 'ready', pages: [], events: [] });
    this.write(owner, task); return task;
  }
  start(owner: string, id: string) {
    if (this.closing) throw new AgentError(503, 'Juno is restarting.');
    if (this.active || this.otherBrowserBusy()) throw new AgentError(409, 'Juno’s browser is busy. Wait for the current task or lab run.');
    const { hasScreenshot: _frame, ...task } = this.detail(owner, id);
    if (task.status !== 'ready') throw new AgentError(409, 'This reviewed task has already started. Inspect its evidence or review a new task.');
    if (task.input.mode === 'agent' && !this.modelStatus().configured) throw new AgentError(409, 'Goal-driven browsing needs a server model connection. Choose evidence collection to read your starting websites without a model.');
    const abort = new AbortController();
    const parent = task.input.parentId ? this.detail(owner, task.input.parentId) : undefined;
    const priorTask = parent ? { id: parent.id, goal: parent.input.goal, answer: parent.answer?.slice(0, 4000), sourceUrls: parent.pages.map(page => page.url).slice(0, 10) } : undefined;
    const connection = plannerConnection();
    const interpret = task.input.mode === 'agent' && connection ? createWebInterpreter(connection) : undefined;
    const active: Active = { owner, id, abort, promise: Promise.resolve() };
    this.active = active;
    active.promise = Promise.resolve().then(() => runWebTask({ task, owner, signal: abort.signal, interpret, priorTask,
      knowledge: new SiteKnowledgeStore(path.join(this.workspace(owner), 'knowledge')),
      save: value => this.write(owner, value),
      screenshot: image => {
        if (image.length > 2_000_000) return;
        const file = this.file(owner, id, 'png'), temp = `${file}.tmp`;
        try { fs.writeFileSync(temp, image, { mode: 0o600 }); fs.renameSync(temp, file); } finally { fs.rmSync(temp, { force: true }); }
      },
    })).catch(() => {
      task.status = 'failed'; task.error = 'The worker could not save or finish this task. Inspect saved evidence before starting again.';
      try { this.write(owner, task); } catch { /* Existing checkpoint remains inspectable after storage failure. */ }
    }).finally(() => { if (this.active === active) this.active = undefined; });
    return { id, status: 'running' };
  }
  stop(owner: string, id: string) {
    this.detail(owner, id);
    if (this.active?.owner === owner && this.active.id === id) this.active.abort.abort();
  }
  screenshot(owner: string, id: string) {
    this.detail(owner, id);
    const file = this.file(owner, id, 'png');
    if (!fs.existsSync(file)) throw new AgentError(404, 'No browser frame has been captured.');
    return fs.readFileSync(file);
  }
  knowledge(owner: string) {
    const directory = path.join(this.workspace(owner), 'knowledge', owner);
    if (!fs.existsSync(directory)) return [];
    const store = new SiteKnowledgeStore(path.join(this.workspace(owner), 'knowledge'));
    return fs.readdirSync(directory).filter(name => /^[a-f0-9]{64}\.json$/.test(name)).flatMap(name => {
      const file = path.join(directory, name);
      if (fs.statSync(file).size > 2_650_000) throw new AgentError(409, 'Site knowledge exceeds its storage limit.');
      const versions: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
      const origin = z.array(z.object({ origin: z.url() })).min(1).max(10).parse(versions).at(-1)!.origin;
      const latest = store.latest(owner, origin);
      return latest ? [latest] : [];
    });
  }
  forgetSite(owner: string, value: unknown) {
    if (this.active?.owner === owner) throw new AgentError(409, 'Stop the task before forgetting its site knowledge.');
    const { origin } = z.object({ origin: z.url() }).strict().parse(value);
    if (!fs.existsSync(path.join(this.workspace(owner), 'knowledge'))) return;
    new SiteKnowledgeStore(path.join(this.workspace(owner), 'knowledge')).forget(owner, new URL(origin).origin);
  }
  forgetTask(owner: string, id: string) {
    if (this.active?.owner === owner) throw new AgentError(409, 'Stop the task before forgetting workspace task history.');
    this.detail(owner, id);
    const dependent = this.tasks(owner).find(task => task.status === 'ready' && task.input.parentId === id);
    if (dependent) throw new AgentError(409, `Forget or finish the reviewed follow-up “${dependent.input.goal.slice(0, 100)}” before forgetting its context.`);
    for (const extension of ['json', 'png']) fs.rmSync(this.file(owner, id, extension), { force: true });
  }
  async close() { this.closing = true; this.active?.abort.abort(); await this.active?.promise; }
}
