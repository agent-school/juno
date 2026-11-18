import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { RunStore, TaskPlanSchema, planTask, createChatInterpreter, type RunReceipt } from '@juno/agent';
import { hostFor, makePlan, startFixture, RecordsSchema, VariantSchema } from '@juno/agent/owned';
import { SiteKnowledgeStore } from '@juno/knowledge';
import { runBenchmark } from '@juno/agent/benchmark';

export class AgentError extends Error { constructor(readonly status: number, message: string) { super(message); } }
const uuid = z.uuid();
const ownerSchema = z.string().regex(/^[a-f0-9]{64}$/);
const metadataSchema = z.object({ port: z.number().int().min(0).max(65535), token: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const AgentTaskInputSchema = z.object({
  name: z.string().trim().min(1).max(100), email: z.email().max(200),
  note: z.string().trim().min(1).max(1000), due: z.iso.date(),
  category: z.enum(['Research', 'Partner']).default('Research'), subscribed: z.boolean().default(false),
}).strict();
const taskSchema = z.object({
  id: uuid, createdAt: z.iso.datetime(), title: z.string().max(160),
  source: z.enum(['form', 'language']), plan: TaskPlanSchema,
  status: z.enum(['ready', 'running', 'finished', 'failed']),
  attempts: z.number().int().min(0).max(20), error: z.string().max(300).optional(),
  outcome: z.object({ status: z.enum(['verified', 'blocked', 'uncertain']), verifiedSteps: z.number().int().nonnegative() }).optional(),
}).strict().refine(task => task.id === task.plan.id, 'Task identity mismatch');
type SavedTask = z.infer<typeof taskSchema>;
const checkSchema = z.object({ name: z.string(), passed: z.boolean(), durationMs: z.number(), detail: z.string().optional() });
const checksSchema = z.object({
  id: uuid, createdAt: z.iso.datetime(), status: z.enum(['running', 'completed', 'failed', 'stopped']),
  checks: z.array(checkSchema).max(30), error: z.string().max(300).optional(),
});
type Checks = z.infer<typeof checksSchema>;
type Active = { owner: string; id: string; kind: 'prepare' | 'task' | 'checks'; abort: AbortController; promise?: Promise<unknown>; stopping?: boolean };

/** Single hosted browser worker; persistent files and journals are partitioned by the authenticated owner.
 * Public callers can choose supported task inputs, never browser origins, contracts or permissions.
 */
export class AgentService {
  private active?: Active;
  constructor(private readonly directory: string, private readonly otherBrowserBusy = () => false) {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  }
  isBusy() { return !!this.active; }
  private workspace(owner: string) { return path.join(this.directory, ownerSchema.parse(owner)); }
  private write(file: string, data: unknown) {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      const fd = fs.openSync(temporary, 'wx', 0o600);
      try { fs.writeFileSync(fd, JSON.stringify(data)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      fs.renameSync(temporary, file);
    } finally { fs.rmSync(temporary, { force: true }); }
  }
  private read<T>(file: string, schema: z.ZodType<T>): T {
    if (!fs.existsSync(file)) throw new AgentError(404, 'Item not found in this workspace.');
    if (fs.statSync(file).size > 2_650_000) throw new AgentError(409, 'Saved evidence exceeds its storage limit.');
    return schema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
  }
  private entries(owner: string, kind: 'tasks' | 'checks') {
    const directory = path.join(this.workspace(owner), kind);
    return fs.existsSync(directory) ? fs.readdirSync(directory).filter(file => /^[a-f0-9-]{36}\.json$/.test(file)).map(file => path.join(directory, file)) : [];
  }
  private taskFile(owner: string, id: string) { return path.join(this.workspace(owner), 'tasks', `${uuid.parse(id)}.json`); }
  private task(owner: string, id: string) { return this.read(this.taskFile(owner, id), taskSchema); }
  private reserve(owner: string, kind: Active['kind'], id: string): Active {
    if (this.active || this.otherBrowserBusy()) throw new AgentError(409, 'Juno’s browser is busy. Wait for the current run to finish.');
    const directory = this.workspace(owner);
    if (!fs.existsSync(directory) && fs.readdirSync(this.directory).length >= 100) throw new AgentError(409, 'Hosted workspace capacity reached.');
    return this.active = { owner, kind, id, abort: new AbortController() };
  }
  private release(active: Active) { if (this.active === active) this.active = undefined; }
  private async open(owner: string) {
    const directory = this.workspace(owner), metadataFile = path.join(directory, 'application.json');
    const metadata = fs.existsSync(metadataFile) ? this.read(metadataFile, metadataSchema) : { port: 0, token: randomBytes(32).toString('hex') };
    let app: Awaited<ReturnType<typeof startFixture>>;
    try { app = await startFixture(path.join(directory, 'application'), metadata.port, { token: metadata.token }); }
    catch { throw new AgentError(409, 'The saved contact workspace could not start. No task actions were attempted.'); }
    try {
      this.write(metadataFile, { ...metadata, port: app.port });
      const host = hostFor(directory, app.origin, { owner, token: metadata.token });
      return { app, host, close: async () => { try { host.runs.close(); } finally { await app.close(); } } };
    } catch (error) { await app.close(); throw error; }
  }
  private origin(owner: string) {
    const file = path.join(this.workspace(owner), 'application.json');
    return fs.existsSync(file) ? `http://127.0.0.1:${this.read(file, metadataSchema).port}` : null;
  }
  knowledge(owner: string) {
    const origin = this.origin(owner);
    return origin ? new SiteKnowledgeStore(path.join(this.workspace(owner), 'knowledge')).versions(owner, origin) : [];
  }
  forgetKnowledge(owner: string) {
    if (this.active?.owner === owner) throw new AgentError(409, 'Wait for the current operation before forgetting site knowledge.');
    const origin = this.origin(owner);
    if (origin) new SiteKnowledgeStore(path.join(this.workspace(owner), 'knowledge')).forget(owner, origin);
  }
  private receipt(owner: string, id: string): RunReceipt | null {
    if (!fs.existsSync(path.join(this.workspace(owner), 'runs', 'runs.sqlite'))) return null;
    const runs = new RunStore(path.join(this.workspace(owner), 'runs'));
    try { return runs.get(id); } finally { runs.close(); }
  }
  detail(owner: string, id: string) {
    const task = this.task(owner, id), receipt = this.receipt(owner, id);
    const live = this.active?.owner === owner && this.active.id === id && this.active.kind === 'task';
    const status = live ? 'running' : task.status === 'running' ? 'interrupted' : receipt?.status ?? task.status;
    return { ...task, status, receipt, stopping: live && !!this.active?.stopping,
      hasScreenshot: fs.existsSync(path.join(this.workspace(owner), 'screenshots', `${id}.png`)) };
  }
  state(owner: string) {
    const directory = this.workspace(owner), file = path.join(directory, 'application', 'records.json');
    const records = fs.existsSync(file) ? this.read(file, RecordsSchema) : [];
    return {
      busy: this.isBusy() || this.otherBrowserBusy(), preparing: this.active?.owner === owner && this.active.kind === 'prepare',
      tasks: this.entries(owner, 'tasks').map(file => {
        const task = this.read(file, taskSchema);
        const live = this.active?.owner === owner && this.active.id === task.id;
        return { id: task.id, title: task.title, createdAt: task.createdAt,
          status: live ? 'running' : task.status === 'running' ? 'interrupted' : task.outcome?.status ?? task.status, attempts: task.attempts,
          verifiedSteps: task.outcome?.verifiedSteps ?? 0, totalSteps: task.plan.steps.length };
      }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      records, knowledge: this.knowledge(owner).map(model => ({ version: model.version, structuralRevision: model.structuralRevision,
        pages: model.pages.length, operations: model.operations.map(operation => operation.contract.id) })),
      checks: this.entries(owner, 'checks').map(file => {
        const value = this.read(file, checksSchema);
        return { ...value, status: value.status === 'running' && !(this.active?.owner === owner && this.active.id === value.id) ? 'interrupted' : value.status };
      }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      planner: { configured: !!(process.env.JUNO_PLANNER_API_KEY && process.env.JUNO_PLANNER_MODEL), model: process.env.JUNO_PLANNER_MODEL ?? null },
    };
  }
  async observe(owner: string) {
    const active = this.reserve(owner, 'prepare', randomUUID());
    try { const context = await this.open(owner); try { return await context.host.compile(); } finally { await context.close(); } }
    finally { this.release(active); }
  }
  async prepare(owner: string, input: unknown, language = false) {
    // Validate before acquiring resources or opening the browser.
    const data = language ? z.object({ intent: z.string().trim().min(1).max(2000) }).strict().parse(input) : AgentTaskInputSchema.parse(input);
    if (this.entries(owner, 'tasks').length >= 100) throw new AgentError(409, 'This workspace has reached its 100-task limit.');
    if (language && !(process.env.JUNO_PLANNER_API_KEY && process.env.JUNO_PLANNER_MODEL)) throw new AgentError(503, 'Language planning needs a configured model connection. Use the task form below.');
    const active = this.reserve(owner, 'prepare', randomUUID());
    try {
      const context = await this.open(owner);
      try {
        const model = context.host.knowledge.latest(owner, context.app.origin) ?? await context.host.compile();
        let plan;
        if ('intent' in data) {
          try {
            const result = await planTask({ intent: data.intent, model, operations: context.host.operations,
              interpret: createChatInterpreter({ apiKey: process.env.JUNO_PLANNER_API_KEY!, model: process.env.JUNO_PLANNER_MODEL!, endpoint: process.env.JUNO_PLANNER_ENDPOINT ?? 'https://api.openai.com/v1/chat/completions' }), signal: active.abort.signal });
            plan = result;
          } catch { throw new AgentError(503, 'The language planner could not produce a valid plan. Check the server’s model connection, or use the task form. No task actions were attempted.'); }
        } else {
          plan = makePlan(model.version, data);
          plan.steps[0]!.inputs.category = data.category; plan.steps[0]!.inputs.subscribed = data.subscribed;
        }
        const task = taskSchema.parse({ id: plan.id, plan, createdAt: new Date().toISOString(),
          title: 'intent' in data ? data.intent.slice(0, 160) : `Contact and follow-up for ${data.name}`, source: language ? 'language' : 'form', status: 'ready', attempts: 0 });
        this.write(this.taskFile(owner, task.id), task);
        return this.detail(owner, task.id);
      } finally { await context.close(); }
    } finally { this.release(active); }
  }
  start(owner: string, id: string, variant: unknown = 'normal') {
    const scenario = VariantSchema.parse(variant), task = this.task(owner, id);
    if (task.attempts >= 20) throw new AgentError(409, 'This task has reached its inspection limit.');
    if (!this.knowledge(owner).some(model => model.version === task.plan.modelVersion)) throw new AgentError(409, 'This task’s site knowledge was forgotten. Observe the site and review a new task.');
    const active = this.reserve(owner, 'task', id);
    const saved: SavedTask = { ...task, status: 'running', attempts: task.attempts + 1 }; delete saved.error;
    try { this.write(this.taskFile(owner, id), saved); } catch (error) { this.release(active); throw error; }
    active.promise = this.execute(owner, saved, scenario, active).catch(() => { /* Durable journal remains inspectable if task bookkeeping fails. */ }).finally(() => this.release(active));
    return this.detail(owner, id);
  }
  private async execute(owner: string, task: SavedTask, variant: z.infer<typeof VariantSchema>, active: Active) {
    try {
      const context = await this.open(owner);
      try {
        context.app.setVariant(variant);
        const result = await context.host.runtime({ openBrowser: async () => {
          const browser = await context.host.openBrowser();
          let capturing = false;
          const capture = async () => {
            if (capturing || browser.page.isClosed()) return;
            capturing = true;
            try {
              const buffer = await browser.page.screenshot({ type: 'png', timeout: 1500, animations: 'disabled' });
              if (buffer.length <= 1_000_000) {
                const file = path.join(this.workspace(owner), 'screenshots', `${task.id}.png`);
                fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
                const temporary = `${file}.tmp`; fs.writeFileSync(temporary, buffer, { mode: 0o600 }); fs.renameSync(temporary, file);
              }
            } catch { /* Observation must never authorize, repeat or prevent an action. */ }
            finally { capturing = false; }
          };
          const timer = setInterval(() => { void capture(); }, 700); timer.unref();
          return { page: browser.page, close: async () => { clearInterval(timer); try { await capture(); } finally { await browser.close(); } } };
        } }).run(task.plan, { signal: active.abort.signal });
        this.write(this.taskFile(owner, task.id), { ...task, status: 'finished', outcome: {
          status: result.status, verifiedSteps: result.steps.filter(step => step.status === 'verified').length,
        } });
      } finally { await context.close(); }
    } catch {
      this.write(this.taskFile(owner, task.id), { ...task, status: 'failed', error: 'The run stopped unexpectedly. Inspect its receipt and results before resuming the saved request.' });
    }
  }
  stop(owner: string, id: string) {
    this.task(owner, id);
    if (this.active?.owner === owner && this.active.id === id && this.active.kind === 'task') { this.active.stopping = true; this.active.abort.abort(); }
  }
  screenshot(owner: string, id: string) {
    this.task(owner, id);
    const file = path.join(this.workspace(owner), 'screenshots', `${uuid.parse(id)}.png`);
    if (!fs.existsSync(file)) throw new AgentError(404, 'No browser frame has been captured yet.');
    return fs.readFileSync(file);
  }
  startChecks(owner: string) {
    if (this.entries(owner, 'checks').length >= 5) throw new AgentError(409, 'This workspace has reached its five-check-run limit.');
    const id = randomUUID(), active = this.reserve(owner, 'checks', id);
    const value: Checks = { id, createdAt: new Date().toISOString(), status: 'running', checks: [] };
    const file = path.join(this.workspace(owner), 'checks', `${id}.json`);
    try { this.write(file, value); } catch (error) { this.release(active); throw error; }
    active.promise = (async () => {
      try {
        await runBenchmark(path.join(this.workspace(owner), 'checks', id), { signal: active.abort.signal,
          onCheck: checks => { value.checks = checks; this.write(file, value); } });
        value.status = 'completed';
      } catch { value.status = active.abort.signal.aborted ? 'stopped' : 'failed'; value.error = 'The check run ended before completing its full matrix.'; }
      finally { this.write(file, value); this.release(active); }
    })().catch(() => { this.release(active); });
    return value;
  }
  checksReport(owner: string, id: string) {
    this.read(path.join(this.workspace(owner), 'checks', `${uuid.parse(id)}.json`), checksSchema);
    const file = path.join(this.workspace(owner), 'checks', id, 'report.json');
    if (!fs.existsSync(file)) throw new AgentError(404, 'The check report is not ready yet.');
    return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  }
  stopChecks(owner: string, id: string) {
    this.read(path.join(this.workspace(owner), 'checks', `${uuid.parse(id)}.json`), checksSchema);
    if (this.active?.owner === owner && this.active.id === id && this.active.kind === 'checks') this.active.abort.abort();
  }
  async close() {
    this.active?.abort.abort();
    await this.active?.promise;
  }
}
