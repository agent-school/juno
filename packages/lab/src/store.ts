import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { emptyState, type LabState } from './contracts.js';
import { emptyWorkspace } from './workspace.js';

/** Single-process lab store. Atomic replacement; bounded state; never user-supplied paths. */
export class Store {
  constructor(readonly directory: string) {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    // A process interrupted after a possible effect must never replay that request silently.
    for (const file of fs.readdirSync(directory)) {
      if (!/^[a-f0-9]{64}\.json$/.test(file)) continue;
      const owner = file.slice(0, -5);
      const state = this.read(owner);
      let changed = false;
      for (const receipt of state.receipts) {
        if (receipt.status !== 'running') continue;
        receipt.status = 'uncertain';
        receipt.category = 'interrupted';
        receipt.message = 'Server restarted during execution. Inspect fixture state before a new request.';
        changed = true;
      }
      for (const task of state.workspace.tasks) {
        if (task.status !== 'running') continue;
        task.status = 'interrupted';
        task.errors.push('Server restarted during research. Saved evidence may be incomplete; start a new request to refresh.');
        changed = true;
      }
      if (changed) this.write(owner, state);
    }
  }
  private file(owner: string): string {
    if (!/^[a-f0-9]{64}$/.test(owner)) throw new Error('Invalid session');
    return path.join(this.directory, `${owner}.json`);
  }
  exists(owner: string): boolean { return fs.existsSync(this.file(owner)); }
  read(owner: string): LabState {
    const file = this.file(owner);
    if (!fs.existsSync(file)) return emptyState();
    const state = JSON.parse(fs.readFileSync(file, 'utf8')) as LabState;
    // Additive migration preserves existing browser-lab evidence.
    state.workspace ??= emptyWorkspace();
    state.workspace.retiredTaskIds ??= [];
    return state;
  }
  write(owner: string, state: LabState): void {
    const file = this.file(owner);
    const temp = `${file}.${randomUUID()}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(state), { mode: 0o600 });
    fs.renameSync(temp, file);
  }
  update(owner: string, change: (state: LabState) => void): LabState {
    const state = this.read(owner);
    change(state);
    this.write(owner, state);
    return state;
  }
  create(owner: string): void {
    // Hard bound for a public synthetic demo. No eviction of existing evidence.
    if (fs.readdirSync(this.directory).filter(file => file.endsWith('.json')).length >= 500) {
      throw new Error('Lab capacity reached');
    }
    this.write(owner, emptyState());
  }
}
