import { z } from 'zod';
import type { Store } from './store.js';
import { recallNotes, type Project, type ResearchTask, type TaskInput } from './workspace.js';

const slugPattern = /^[a-z0-9][a-z0-9-]{0,38}\/(?!\.{1,2}$)[a-z0-9_.-]{1,100}$/i;
const RepoSchema = z.object({
  full_name: z.string().regex(slugPattern).max(200), description: z.string().max(3000).nullable(),
  language: z.string().max(100).nullable(), stargazers_count: z.number().int().nonnegative(),
  forks_count: z.number().int().nonnegative(), open_issues_count: z.number().int().nonnegative(),
  pushed_at: z.iso.datetime(), archived: z.boolean(), fork: z.boolean(),
  license: z.object({ spdx_id: z.string().max(100) }).nullable(),
});
type Repo = z.infer<typeof RepoSchema>;
function project(repo: Repo, sourceUrl: string): Project {
  return {
    fullName: repo.full_name, url: `https://github.com/${repo.full_name}`, apiUrl: `https://api.github.com/repos/${repo.full_name}`, sourceUrl,
    description: repo.description ?? '', language: repo.language, stars: repo.stargazers_count, forks: repo.forks_count,
    openIssues: repo.open_issues_count, pushedAt: repo.pushed_at, archived: repo.archived, fork: repo.fork,
    license: repo.license?.spdx_id ?? null, observedAt: new Date().toISOString(),
  };
}
export class GitHubSource {
  private requests: number[] = [];
  constructor(private fetcher: typeof fetch = fetch) {}
  private async json(path: string, signal: AbortSignal): Promise<unknown> {
    const url = new URL(path, 'https://api.github.com');
    if (url.origin !== 'https://api.github.com') throw new Error('Unsupported source.');
    const now = Date.now(); this.requests = this.requests.filter(at => now - at < 60_000);
    if (this.requests.length >= 9) throw new Error('Juno source request budget reached. Wait one minute before refreshing more sources.');
    this.requests.push(now);
    const response = await this.fetcher(url, {
      method: 'GET', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'Juno-read-only-research', 'x-github-api-version': '2022-11-28' },
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(response.status === 403 || response.status === 429 ? 'GitHub rate limit or access restriction. Try again later; no result was invented.' : `GitHub returned HTTP ${response.status}.`);
    }
    if (!response.body) throw new Error('GitHub returned no data.');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let bytes = 0;
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        bytes += part.value.length;
        if (bytes > 512_000) throw new Error('Source response exceeded the research limit.');
        chunks.push(part.value);
      }
    } finally { await reader.cancel(); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  async search(query: string, language: string, minStars: number, signal: AbortSignal): Promise<{ repos: Repo[]; incomplete: boolean; sourceUrl: string }> {
    // All requests are fixed-origin GETs. Query text is data, not an executable instruction or URL.
    const q = `${query} stars:>=${minStars} archived:false fork:false${language === 'Any' ? '' : ` language:${language}`}`;
    const sourceUrl = `https://api.github.com/search/repositories?${new URLSearchParams({ q, sort: 'stars', order: 'desc', per_page: '5' })}`;
    const data = z.object({ items: z.array(RepoSchema).max(5), incomplete_results: z.boolean() }).parse(await this.json(sourceUrl, signal));
    return { repos: data.items, incomplete: data.incomplete_results, sourceUrl };
  }
  async read(slug: string, signal: AbortSignal): Promise<Project> {
    if (!slugPattern.test(slug)) throw new Error('Invalid project identity.');
    // An exact repository search returns the same typed metadata, including archived projects.
    // Use the search API consistently; do not spend the small core quota rereading search records.
    const sourceUrl = `https://api.github.com/search/repositories?${new URLSearchParams({ q: `repo:${slug}`, per_page: '1' })}`;
    const response = z.object({ items: z.array(RepoSchema).max(1), incomplete_results: z.boolean() }).parse(await this.json(sourceUrl, signal));
    const data = response.items[0];
    if (response.incomplete_results || !data) throw new Error('Project could not be found completely in the current public source.');
    if (data.full_name.toLowerCase() !== slug.toLowerCase()) throw new Error('Source project identity changed; inspect it before remembering.');
    return project(data, sourceUrl);
  }
}

/** A pair of typed read-only operations, not a general autonomous or LLM planner. */
export class ResearchService {
  private active: { owner: string; id: string; controller: AbortController } | null = null;
  private started: number[] = [];
  constructor(private store: Store, private source = new GitHubSource()) {}
  isBusy(): boolean { return this.active !== null; }
  cancel(owner: string): void { if (this.active?.owner === owner) this.active.controller.abort(); }
  start(owner: string, id: string, request: TaskInput): ResearchTask {
    const workspace = this.store.read(owner).workspace;
    if (workspace.retiredTaskIds.includes(id)) throw new Error('Task evidence was forgotten. Start with a new request ID.');
    const old = workspace.tasks.find(task => task.id === id);
    if (old) {
      if (JSON.stringify(old.request) !== JSON.stringify(request)) throw new Error('Request ID belongs to a different task.');
      return old;
    }
    if (this.active) throw new Error('Research is busy. Try after the current task finishes.');
    if (workspace.tasks.length >= 100) throw new Error('Task history limit reached. Export and forget old task receipts before continuing.');
    if (request.kind === 'refresh' && !workspace.projects.length) throw new Error('Remember a project from a completed search first.');
    const now = Date.now();
    this.started = this.started.filter(at => now - at < 60_000);
    if (this.started.length >= 6) throw new Error('Research limit reached. Wait a minute before another live-source task.');
    this.started.push(now);
    const resolved = request.kind === 'search' ? { ...request, language: request.language ?? workspace.preferences.language, minStars: request.minStars ?? workspace.preferences.minStars } :
      { kind: 'refresh' as const, projects: workspace.projects.slice(0, 5).map(item => item.project.fullName) };
    const baselines = workspace.projects.filter(item => resolved.kind === 'refresh' && resolved.projects.includes(item.project.fullName));
    const task: ResearchTask = {
      id, request, resolved, status: 'running', startedAt: new Date().toISOString(), durationMs: 0,
      steps: [], results: [], errors: [], changes: [], sourceRequests: 0, modelCalls: 0,
      recalled: { preferencesVersion: workspace.preferences.version, notes: recallNotes(workspace.notes, request.kind === 'search' ? request.query : baselines.map(item => item.project.fullName).join(' ')), baselines },
    };
    this.store.update(owner, state => { state.workspace.tasks.push(task); });
    const controller = new AbortController();
    this.active = { owner, id, controller };
    void this.execute(owner, task, controller).catch(() => { /* Persisted running state becomes interrupted on restart if storage fails. */ });
    return task;
  }
  private async execute(owner: string, task: ResearchTask, controller: AbortController): Promise<void> {
    const start = performance.now();
    const deadline = setTimeout(() => controller.abort(), 55_000);
    const save = () => this.store.update(owner, state => {
      const index = state.workspace.tasks.findIndex(item => item.id === task.id);
      if (index < 0) throw new Error('Task evidence missing.');
      // A user may forget memory while a network request is in flight. Never resurrect its text.
      task.recalled.notes = task.recalled.notes.filter(note => state.workspace.notes.some(current => current.id === note.id));
      task.recalled.baselines = task.recalled.baselines.filter(item => state.workspace.projects.some(current => current.id === item.id));
      state.workspace.tasks[index] = task;
    });
    const step = (message: string) => { task.steps.push({ at: new Date().toISOString(), message }); save(); };
    try {
      step(`Loaded preferences v${task.recalled.preferencesVersion} and ${task.recalled.notes.length} matching notes. Notes are context only; structured filters drive execution.`);
      let names: string[];
      const observed = new Map<string, Project>();
      if (task.resolved.kind === 'search') {
        step('Searching live public GitHub repositories.'); task.sourceRequests++;
        const search = await this.source.search(task.resolved.query, task.resolved.language, task.resolved.minStars, controller.signal);
        if (search.incomplete) task.errors.push('GitHub reported incomplete search results. This shortlist is not exhaustive.');
        names = search.repos.map(repo => repo.full_name);
        for (const repo of search.repos) observed.set(repo.full_name, project(repo, search.sourceUrl));
        if (!names.length) step('The live search returned no matching projects. Try a broader query or lower the star threshold.');
      } else names = task.resolved.projects;
      for (const name of names) {
        if (controller.signal.aborted) throw new Error('Research stopped before all sources could be verified.');
        try {
          step(`Checking the source record identity and requested filters for ${name}.`);
          let result = observed.get(name);
          if (!result) { task.sourceRequests++; result = await this.source.read(name, controller.signal); }
          if (task.resolved.kind === 'search' && (result.archived || result.fork || result.stars < task.resolved.minStars || (task.resolved.language !== 'Any' && result.language !== task.resolved.language))) {
            task.errors.push(`${name} no longer matches the requested filters; excluded.`); continue;
          }
          task.results.push(result);
          const baseline = task.recalled.baselines.find(item => item.project.fullName.toLowerCase() === name.toLowerCase());
          if (baseline) for (const field of ['description', 'language', 'stars', 'forks', 'openIssues', 'pushedAt', 'archived', 'license'] as const) {
            if (baseline.project[field] !== result[field]) task.changes.push({ project: name, field, before: baseline.project[field], after: result[field] });
          }
          save();
        } catch (error) { task.errors.push(`${name}: ${this.safeError(error)}`); }
      }
      task.status = task.errors.length ? (task.results.length ? 'partial' : 'failed') : 'completed';
      step(task.resolved.kind === 'refresh' ? 'Compared live metadata to your remembered baseline. Memory is unchanged until you explicitly update it.' : 'Source checks complete. Choose which projects and search recipe to remember.');
    } catch (error) {
      task.errors.push(this.safeError(error));
      task.status = task.results.length ? 'partial' : 'failed';
    } finally {
      clearTimeout(deadline);
      task.durationMs = Math.round(performance.now() - start);
      try { save(); } finally { this.active = null; }
    }
  }
  private safeError(error: unknown): string {
    if (error instanceof z.ZodError) return 'Source schema did not match the contract; no unverifiable data was accepted.';
    if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) return 'Source request stopped or timed out.';
    return error instanceof Error ? error.message.slice(0, 250) : 'Source could not be verified.';
  }
}
