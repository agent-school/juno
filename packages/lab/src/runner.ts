import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BrowserSession, createGuardedActor, type BenignPolicy, type SemanticRef } from '@juno/browser';
import { SiteKnowledgeStore } from '@juno/knowledge';
import { compile, compileFixtureKnowledge, checkBindings, categoryFor } from './compiler.js';
import { durableTree, verifyInteraction, type Inputs, type Receipt } from './contracts.js';
import type { Store } from './store.js';

const fixtureSearch = (requestId: string | null) => requestId ? `?${new URLSearchParams({ requestId })}` : '';

export class Runner {
  private active = false;
  private owner: string | null = null;
  private session: BrowserSession | null = null;
  private cancelled = false;
  private readonly knowledge: SiteKnowledgeStore;
  constructor(private store: Store, private origin: string) {
    this.knowledge = new SiteKnowledgeStore(path.join(store.directory, 'site-knowledge'));
  }
  inspectKnowledge(owner: string) { return this.knowledge.versions(owner, this.origin); }
  forgetKnowledge(owner: string) {
    if (this.active) throw new Error('Wait for the browser run to finish before forgetting its model.');
    this.knowledge.forget(owner, this.origin);
    this.store.update(owner, state => { state.model = null; });
  }
  isBusy(): boolean { return this.active; }
  async cancel(owner: string): Promise<void> {
    if (!this.active || owner !== this.owner) return;
    this.cancelled = true;
    await this.session?.close();
  }
  private assertActive(): void {
    if (this.cancelled) throw new Error('Execution stopped; inspect the receipt before retrying.');
  }
  private async browser<T>(owner: string, requestId: string | null, work: (session: BrowserSession) => Promise<T>): Promise<T> {
    if (this.active) throw new Error('Browser busy. Try again after the current run.');
    this.active = true;
    this.owner = owner;
    this.cancelled = false;
    let profile: string | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      profile = await mkdtemp(path.join(os.tmpdir(), 'juno-lab-'));
      const session = new BrowserSession({ profileDir: profile, headless: true, channel: process.env.JUNO_LAB_CHANNEL === 'chromium' ? 'chromium' : 'chrome' });
      this.session = session;
      const page = await session.launch();
      this.assertActive();
      timer = setTimeout(() => { this.cancelled = true; void session.close().catch(() => {}); }, 30_000);
      page.setDefaultTimeout(3000);
      page.setDefaultNavigationTimeout(8000);
      // Browser is confined to this process's fixture; no arbitrary navigation or external requests.
      await page.context().route('**/*', route => new URL(route.request().url()).origin === this.origin ? route.continue() : route.abort());
      await page.context().addCookies([{ name: 'juno_lab', value: owner, url: this.origin, httpOnly: true, sameSite: 'Strict' }]);
      await session.goto(`${this.origin}/fixture${fixtureSearch(requestId)}`);
      return await work(session);
    } finally {
      if (timer) clearTimeout(timer);
      await this.session?.close().catch(() => {});
      this.session = null;
      this.owner = null;
      this.active = false;
      if (profile) await rm(profile, { recursive: true, force: true }).catch(() => {});
    }
  }
  async compile(owner: string): Promise<void> {
    await this.browser(owner, null, async session => {
      const { actor } = createGuardedActor(session.page!, { mode: 'read-only', audit: async () => {} });
      const tree = await actor.read();
      this.assertActive();
      const model = compile(tree);
      model.knowledge = this.knowledge.save(owner, compileFixtureKnowledge(this.origin, tree, model));
      this.store.update(owner, state => { state.model = model; });
    });
  }
  async run(owner: string, requestId: string, inputs: Inputs): Promise<Receipt> {
    const state = this.store.read(owner);
    const old = state.receipts.find(receipt => receipt.id === requestId);
    if (old) {
      if (JSON.stringify(old.inputs) !== JSON.stringify(inputs)) throw new Error('Request ID already belongs to different inputs.');
      return old;
    }
    if (this.active) throw new Error('Browser busy. Try again after the current run.');
    if (state.receipts.length >= 100 || state.interactions.length >= 100) throw new Error('Session limit reached. Download your evidence and start a new browser session.');
    const receipt: Receipt = {
      id: requestId, operation: 'capture_interaction', inputs, modelVersion: state.model?.version ?? null,
      variant: state.variant, startedAt: new Date().toISOString(), durationMs: 0, status: 'running',
      actions: [], audit: [], assertions: [], observations: {}, recovery: [],
      metrics: { modelCalls: 0, modelCostUsd: 0, browserActions: 0 },
    };
    this.store.update(owner, current => { current.receipts.push(receipt); });
    const start = performance.now();
    let submitted = false;
    try {
      if (!state.model) throw new Error('Observe and compile this fixture before replaying.');
      const model = state.model;
      if (model.knowledge) {
        const saved = this.knowledge.latest(owner, this.origin);
        if (!saved || saved.version !== model.knowledge.version || saved.structuralRevision !== model.knowledge.structuralRevision) {
          throw new Error('Saved site knowledge changed or is missing. Explicitly recompile before execution.');
        }
      }
      await this.browser(owner, requestId, async session => {
        const page = session.page!;
        // The host-owned fixture contract grants only these exact benign mutations.
        // A site's observed content or saved risk string never grants execution authority.
        const fixtureScope = { origin: this.origin, pathname: '/fixture', search: fixtureSearch(requestId) };
        const benignPolicies: BenignPolicy[] = [
          { id: 'fixture.person', ...fixtureScope, method: 'selectOption', ref: model.bindings.person },
          ...(['note', 'occurred_at', 'next_action'] as const).map(key => ({
            id: `fixture.${key}`, ...fixtureScope, method: 'fill' as const, ref: model.bindings[key],
          })),
          { id: 'fixture.submit', ...fixtureScope, method: 'click', ref: model.bindings.submit },
        ];
        const { actor } = createGuardedActor(page, { runId: requestId, benignPolicies, audit: async entry => {
          receipt.audit!.push(entry);
          this.store.update(owner, current => {
            const stored = current.receipts.find(item => item.id === requestId);
            if (stored) stored.audit = [...receipt.audit!];
          });
        } });
        receipt.observations.before = durableTree(await actor.read());
        checkBindings(receipt.observations.before, model);
        const act = async (method: string, target: SemanticRef, perform: () => Promise<void>) => {
          this.assertActive();
          await perform();
          receipt.actions.push({ method, target });
          receipt.metrics.browserActions++;
        };
        await act('selectOption', model.bindings.person, () => actor.selectOption(model.bindings.person, inputs.person));
        for (const key of ['note', 'occurred_at', 'next_action'] as const) {
          await act('fill', model.bindings[key], () => actor.fill(model.bindings[key], inputs[key]));
        }
        this.assertActive();
        const response = page.waitForResponse(response => response.url() === `${this.origin}/api/interactions` && response.request().method() === 'POST');
        // Attach a rejection handler even if click fails before the response arrives.
        void response.catch(() => {});
        submitted = true;
        await act('click', model.bindings.submit, () => actor.click(model.bindings.submit));
        const saved = await response;
        if (!saved.ok()) throw new Error('Fixture rejected the write.');
        receipt.observations.after = durableTree(await actor.read());
        receipt.assertions = verifyInteraction(this.store.read(owner).interactions, requestId, inputs);
        receipt.status = receipt.assertions.every(assertion => assertion.passed) ? 'verified' : 'failed';
        if (receipt.status !== 'verified') {
          receipt.category = 'verification';
          receipt.message = 'Clicks completed, but fixture state did not prove the requested effect.';
          receipt.recovery.push('Inspect saved fixture records. Restore the original page variation before starting a new intended interaction.');
        }
      });
    } catch (error) {
      receipt.status = submitted ? 'uncertain' : 'failed';
      receipt.category = categoryFor(error);
      receipt.recovery.push(submitted ? 'Inspect fixture state before creating another request. This request ID will never be re-executed.' :
        receipt.category === 'precondition' ? 'Remove ambiguous controls or explicitly recompile the changed page, then start a new request.' :
        'Check browser availability and the saved observations before starting a new request.');
      // Raw Playwright errors may contain page content/transport details. Keep the public receipt bounded.
      receipt.message = receipt.category === 'precondition' && error instanceof Error ? error.message :
        this.cancelled ? 'Execution stopped. Inspect fixture state before a new request.' :
        !state.model ? 'Observe and compile before replaying.' : 'Browser execution could not be verified. Inspect observations and recompile if the page changed.';
    } finally {
      receipt.durationMs = Math.round(performance.now() - start);
      this.store.update(owner, current => {
        const index = current.receipts.findIndex(item => item.id === requestId);
        current.receipts[index] = receipt;
      });
    }
    return receipt;
  }
}
