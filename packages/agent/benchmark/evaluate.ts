import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { SiteKnowledgeStore } from '@juno/knowledge';
import { confinePage, type RunReceipt } from '../src/index.js';
import { hostFor, makePlan, owner } from './host.js';
import { startFixture } from './fixture.js';

const actions = (receipt: RunReceipt) => receipt.steps.flatMap(step => step.audit).filter(entry => entry.status === 'completed' && entry.risk !== 'read').length;
export async function runBenchmark(directory: string, options: { headless?: boolean; trace?: boolean } = {}) {
  if (fs.existsSync(directory) && fs.readdirSync(directory).length) throw new Error('Benchmark output must be an empty directory; use the demo to resume an existing task');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  let app = await startFixture(path.join(directory, 'application'));
  const host = hostFor(directory, app.origin, options);
  const checks: { name: string; passed: boolean; durationMs: number; detail?: string }[] = [];
  const receipts: { name: string; file: string; status: string; browserActions: number }[] = [];
  const startedAt = new Date().toISOString(), start = performance.now();
  const check = async (name: string, work: () => Promise<void>) => {
    const start = performance.now();
    try { await work(); checks.push({ name, passed: true, durationMs: performance.now() - start }); }
    catch (error) { checks.push({ name, passed: false, durationMs: performance.now() - start, detail: error instanceof Error ? error.message : 'Assertion failed' }); }
    finally { app.setVariant('normal'); }
  };
  const record = (name: string, receipt: RunReceipt) => {
    const file = `${name}.receipt.json`;
    fs.writeFileSync(path.join(directory, file), JSON.stringify(receipt, null, 2), { mode: 0o600 });
    receipts.push({ name, file, status: receipt.status, browserActions: actions(receipt) });
    return receipt;
  };
  try {
    const model = await host.compile();
    const task = makePlan(model.version);
    await check('read-only multi-page compilation and owner-isolated reload', async () => {
      assert.equal(app.writes(), 0); assert.equal(model.pages.length, 3);
      assert.ok(model.pages.every(page => page.navigation.length === 3));
      const reloaded = new SiteKnowledgeStore(path.join(directory, 'knowledge'));
      assert.deepEqual(reloaded.latest(owner, app.origin), model);
      assert.equal(reloaded.latest('0'.repeat(64), app.origin), null);
      assert.doesNotMatch(JSON.stringify(model), /"(?:ref|box|selector|cookie|storage)":/);
    });
    await check('typed composition and independent state verification', async () => {
      const result = record('composition', await host.runtime().run(task));
      assert.equal(result.status, 'verified'); assert.equal(result.steps.length, 2);
      assert.ok(result.steps.every(step => step.before && step.after && step.verification?.status === 'matched'));
      assert.equal(app.records().length, 2); assert.equal(app.records()[0]!.fields.subscribed, false);
      assert.equal(app.records()[1]!.kind, 'followup');
      assert.ok(actions(result) > 0);
      assert.doesNotMatch(JSON.stringify(result), /Ada Lovelace|ada@example.test|Compare semantic browser agents/);
    });
    await check('application restart and cached request never repeat writes', async () => {
      const writes = app.writes(), port = app.port;
      await app.close(); app = await startFixture(path.join(directory, 'application'), port);
      assert.equal(app.records().length, 2);
      const reloaded = hostFor(directory, app.origin);
      try {
        const result = await reloaded.runtime({ openBrowser: async () => { throw new Error('Cached task opened a browser'); } }).run(task);
        assert.equal(result.status, 'verified'); assert.equal(app.writes(), 0); assert.ok(writes > 0);
      } finally { reloaded.runs.close(); }
    });
    await check('same request rejects changed inputs before browser launch', async () => {
      const changed = structuredClone(task); changed.steps[0]!.inputs.person_name = 'Changed identity';
      await assert.rejects(host.runtime().run(changed), /different task/); assert.equal(app.writes(), 0);
    });
    await check('layout reordering preserves knowledge and semantic replay', async () => {
      app.setVariant('reordered');
      assert.equal((await host.compile()).version, model.version);
      assert.equal(record('reordered', await host.runtime().run(makePlan(model.version))).status, 'verified');
    });
    for (const variant of ['renamed', 'ambiguous'] as const) {
      await check(`${variant} targets fail before any mutation`, async () => {
        app.setVariant(variant); const writes = app.writes();
        const result = record(variant, await host.runtime().run(makePlan(model.version)));
        assert.equal(result.status, 'blocked'); assert.equal(result.failure, 'grounding');
        assert.equal(actions(result), 0); assert.equal(app.writes(), writes);
      });
    }
    await check('fake success is uncertain and absent effect is never blindly retried', async () => {
      app.setVariant('no-effect'); const task = makePlan(model.version), writes = app.writes();
      const result = record('no-effect', await host.runtime().run(task));
      assert.equal(result.status, 'uncertain'); assert.equal(result.failure, 'effect-unverified');
      assert.equal(result.steps[1]!.status, 'pending'); assert.equal(app.writes(), writes + 1);
      app.setVariant('normal');
      const retry = record('no-effect-retry', await host.runtime().run(task));
      assert.equal(retry.status, 'uncertain'); assert.equal(app.writes(), writes + 1);
      assert.equal(actions(retry), actions(result));
    });
    await check('saved benign risk cannot grant host permissions', async () => {
      const writes = app.writes();
      const result = record('confirmation-boundary', await host.runtime({ benignPolicies: [] }).run(makePlan(model.version)));
      assert.equal(result.status, 'blocked'); assert.equal(result.failure, 'confirmation-required');
      assert.equal(actions(result), 0); assert.equal(app.writes(), writes);
    });
    await check('all typed inputs are validated before the first operation', async () => {
      for (const invalid of ['date', 'boolean', 'choice', 'extra', 'key']) {
        const task = makePlan(model.version);
        if (invalid === 'date') task.steps[1]!.inputs.due_date = '2026-02-30';
        if (invalid === 'boolean') task.steps[0]!.inputs.subscribed = 'false';
        if (invalid === 'choice') task.steps[0]!.inputs.category = 'Not reviewed';
        if (invalid === 'extra') task.steps[1]!.inputs.unknown = 'Injected';
        if (invalid === 'key') task.steps[0]!.inputs.request_id = 'Injected';
        let opened = false;
        await assert.rejects(host.runtime({ openBrowser: async () => { opened = true; throw new Error('Should not launch'); } }).run(task));
        assert.equal(opened, false);
      }
    });
    await check('malformed independent verification cannot authorize success', async () => {
      const operations = host.operations.map(operation => ({ ...operation, verify: async (context: Parameters<typeof operation.verify>[0]) => ({ source: operation.contract.verification.source, key: context.key, recordCount: 0, matchedFields: [], status: 'matched' as const }) }));
      const result = record('bad-verifier', await host.runtime({ operations }).run(makePlan(model.version)));
      assert.equal(result.status, 'blocked'); assert.equal(result.failure, 'verification-unavailable'); assert.equal(actions(result), 0);
    });
    await check('abort after commit reconciles state before continuing', async () => {
      const controller = new AbortController(), task = makePlan(model.version), writes = app.writes();
      const operations = host.operations.map((operation, index) => ({ ...operation, verify: async (context: Parameters<typeof operation.verify>[0]) => {
        const observed = await operation.verify(context);
        if (index === 0 && observed.status === 'matched') controller.abort();
        return observed;
      } }));
      const interrupted = record('aborted', await host.runtime({ operations }).run(task, { signal: controller.signal }));
      assert.equal(interrupted.failure, 'cancelled'); assert.equal(app.writes(), writes + 1);
      const recovered = record('abort-recovered', await host.runtime().run(task));
      assert.equal(recovered.status, 'verified'); assert.equal(app.writes(), writes + 2);
    });
    await check('real process crash releases lock and recovers without duplicate writes', async () => {
      const task = makePlan(model.version), taskFile = path.join(directory, 'crash-task.json'), writes = app.writes();
      fs.writeFileSync(taskFile, JSON.stringify(task), { mode: 0o600 });
      const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./crash-worker.ts', import.meta.url)), directory, app.origin, taskFile], { cwd: fileURLToPath(new URL('..', import.meta.url)), env: { ...process.env, JUNO_LOG_LEVEL: 'silent' }, stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = ''; child.stderr.on('data', chunk => { stderr = (stderr + String(chunk)).slice(-2000); });
      const timer = setTimeout(() => child.kill('SIGKILL'), 30_000);
      const exit = await new Promise<{ code: number | null; signal: string | null }>((resolve, reject) => { child.once('error', reject); child.once('exit', (code, signal) => resolve({ code, signal })); }).finally(() => clearTimeout(timer));
      assert.equal(exit.signal, 'SIGKILL', stderr); assert.equal(app.writes(), writes + 1);
      const interrupted = host.runs.get(task.id)!;
      assert.equal(interrupted.status, 'running'); assert.equal(interrupted.steps[0]!.mutationAttempted, true);
      const recovered = record('crash-recovered', await host.runtime().run(task));
      assert.equal(recovered.status, 'verified'); assert.equal(recovered.steps[0]!.recovered, true);
      assert.equal(app.writes(), writes + 2);
    });
    await check('hung verifier obeys the run deadline without browser actions', async () => {
      const operations = host.operations.map(operation => ({ ...operation, verify: () => new Promise<never>(() => {}) }));
      const start = performance.now();
      const result = record('deadline', await host.runtime({ operations, timeoutMs: 100 }).run(makePlan(model.version)));
      assert.equal(result.status, 'blocked'); assert.equal(result.failure, 'deadline'); assert.equal(actions(result), 0);
      assert.ok(performance.now() - start < 1500);
    });
    await check('lost verified state is escalated instead of recreated', async () => {
      const task = makePlan(model.version), writes = app.writes();
      app.setVariant('followup-renamed');
      const partial = record('partial', await host.runtime().run(task));
      assert.equal(partial.status, 'blocked'); assert.equal(partial.steps[0]!.status, 'verified');
      assert.equal(partial.steps[1]!.status, 'blocked'); assert.equal(app.writes(), writes + 1);
      app.removeRecord(partial.steps[0]!.effectKey); app.setVariant('normal');
      const retry = record('lost-state', await host.runtime().run(task));
      assert.equal(retry.status, 'uncertain'); assert.equal(retry.failure, 'effect-unverified');
      assert.equal(app.writes(), writes + 1);
    });
    await check('page instructions have no execution authority', async () => {
      app.setVariant('injection');
      assert.equal(record('injection', await host.runtime().run(makePlan(model.version))).status, 'verified');
    });
    await check('request confinement blocks external and read-only writes', async () => {
      let external = 0;
      const sink = createServer((_, response) => { external++; response.end('Unexpected'); });
      await new Promise<void>(resolve => sink.listen(0, '127.0.0.1', resolve));
      const address = sink.address(); assert.ok(address && typeof address !== 'string');
      const browser = await host.openBrowser();
      try {
        await confinePage(browser.page, host.boundary, 'read-only');
        await browser.page.goto(`${app.origin}/contacts/new.html`);
        const writes = app.writes();
        // Owned canaries test the network boundary; business actions never use raw JS.
        await browser.page.evaluate(async sink => { await Promise.all([
          fetch(sink, { mode: 'no-cors' }).catch(() => {}),
          fetch('/api/records', { method: 'POST', body: JSON.stringify({ kind: 'contact', key: 'f'.repeat(64), fields: { contact_email: 'canary@example.test' } }) }).catch(() => {}),
        ]); }, `http://127.0.0.1:${address.port}/canary`);
        assert.equal(external, 0); assert.equal(app.writes(), writes);
      } finally { await browser.close(); await new Promise<void>(resolve => sink.close(() => resolve())); }
    });
    const report = {
      schemaVersion: 1, startedAt, durationMs: performance.now() - start,
      environment: { node: process.version, platform: process.platform, channel: process.env.JUNO_AGENT_CHANNEL === 'chromium' ? 'chromium' : 'chrome' },
      scope: 'Owned contact workspace, explicit reviewed contracts, typed task plans; no LLM planner or real accounts',
      summary: { passed: checks.filter(check => check.passed).length, total: checks.length, modelCalls: 0 },
      checks, receipts,
    };
    fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
    return report;
  } finally { host.runs.close(); await app.close(); }
}
