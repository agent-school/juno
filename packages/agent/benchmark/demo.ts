import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { startFixture, VariantSchema } from './fixture.js';

process.env.JUNO_LOG_LEVEL ??= 'silent';
const [{ TaskPlanSchema, planTask, createChatInterpreter }, { hostFor, makePlan, owner }] = await Promise.all([import('../src/index.js'), import('./host.js')]);

const { values } = parseArgs({ options: {
  workspace: { type: 'string' }, 'new-task': { type: 'boolean' }, headed: { type: 'boolean' },
  name: { type: 'string' }, email: { type: 'string' }, note: { type: 'string' }, due: { type: 'string' },
  variant: { type: 'string', default: 'normal' },
  intent: { type: 'string' }, 'plan-only': { type: 'boolean' },
} });
const data = process.env.JUNO_AGENT_DATA_DIR ?? fileURLToPath(new URL('../../../.juno-agent', import.meta.url));
const directory = path.resolve(values.workspace ?? path.join(data, 'v1', 'demo'));
fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
const manifestFile = path.join(directory, 'task.json');
const Manifest = z.object({ port: z.number().int().min(1).max(65535), task: TaskPlanSchema,
  planning: z.object({ intent: z.string().max(8000), model: z.string(), modelCalls: z.literal(1) }).strict().optional(),
}).strict();
const existing = fs.existsSync(manifestFile) ? Manifest.parse(JSON.parse(fs.readFileSync(manifestFile, 'utf8'))) : null;
const app = await startFixture(path.join(directory, 'application'), existing?.port);
const host = hostFor(directory, app.origin, { headless: !values.headed });
try {
  let task = existing?.task;
  let planning = existing?.planning;
  if (!task || values['new-task']) {
    const model = host.knowledge.latest(owner, app.origin) ?? await host.compile();
    if (values.intent) {
      const apiKey = process.env.JUNO_PLANNER_API_KEY;
      if (!apiKey) throw new Error('Set JUNO_PLANNER_API_KEY for natural-language interpretation, or omit --intent to run the deterministic demo');
      const modelName = process.env.JUNO_PLANNER_MODEL ?? 'gpt-4.1-nano';
      task = await planTask({ intent: values.intent, model, operations: host.operations, interpret: createChatInterpreter({ apiKey, model: modelName, endpoint: process.env.JUNO_PLANNER_ENDPOINT }) });
      planning = { intent: values.intent, model: modelName, modelCalls: 1 };
    } else { task = makePlan(model.version, { name: values.name, email: values.email, note: values.note, due: values.due }); planning = undefined; }
    const temporary = `${manifestFile}.tmp`;
    const descriptor = fs.openSync(temporary, 'w', 0o600);
    try { fs.writeFileSync(descriptor, JSON.stringify({ port: app.port, task, planning }, null, 2)); fs.fsyncSync(descriptor); }
    finally { fs.closeSync(descriptor); }
    fs.renameSync(temporary, manifestFile);
  } else if (values.name || values.email || values.note || values.due || values.intent) {
    throw new Error('Existing task inputs are immutable. Use --new-task for a different intent.');
  }
  if (values['plan-only']) { console.log(JSON.stringify({ status: 'planned', requestId: task.id, workspace: directory, planningModel: planning?.model, steps: task.steps.map(step => ({ id: step.id, operation: step.operation })) }, null, 2)); }
  else {
  app.setVariant(VariantSchema.parse(values.variant));
  const prior = host.runs.get(task.id);
  const receipt = await host.runtime().run(task);
  fs.writeFileSync(path.join(directory, 'receipt.json'), JSON.stringify(receipt, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ requestId: task.id, status: receipt.status, reused: prior?.status === 'verified', writesThisInvocation: app.writes(), records: app.records().length, workspace: directory, planningModel: planning?.model, modelCallsThisInvocation: values.intent ? 1 : 0 }, null, 2));
  if (receipt.status !== 'verified') process.exitCode = 1;
  }
} finally { host.runs.close(); await app.close(); }
