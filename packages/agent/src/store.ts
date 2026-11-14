import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { RunReceiptSchema, type RunReceipt } from './contracts.js';

/** Private local single-workspace journal. SQLite commits each checkpoint before browser writes. */
export class RunStore {
  private readonly database: DatabaseSync;
  constructor(readonly directory: string) {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.database = new DatabaseSync(path.join(directory, 'runs.sqlite'));
    this.database.exec('PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, receipt TEXT NOT NULL)');
  }
  get(id: string): RunReceipt | null {
    const row = this.database.prepare('SELECT receipt FROM runs WHERE id = ?').get(id);
    return row ? RunReceiptSchema.parse(JSON.parse(String(row.receipt))) : null;
  }
  put(value: RunReceipt) {
    const receipt = RunReceiptSchema.parse(value);
    const old = this.get(receipt.id);
    if (old && old.manifestHash !== receipt.manifestHash) throw new Error('Request identity changed');
    if (!old && Number(this.database.prepare('SELECT count(*) AS total FROM runs').get()!.total) >= 100) throw new Error('Workspace run budget exhausted');
    const serialized = JSON.stringify(receipt);
    if (Buffer.byteLength(serialized) > 2_000_000) throw new Error('Run evidence exceeds budget');
    this.database.prepare('INSERT INTO runs (id, receipt) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET receipt = excluded.receipt').run(receipt.id, serialized);
  }
  /** Separate database: a process-held lock must not delay durable journal commits.
   * The OS releases SQLite's lock after a crash; no lease expiration or stale-PID guessing.
   */
  acquire(): () => void {
    const lease = new DatabaseSync(path.join(this.directory, 'execution-lock.sqlite'));
    try { lease.exec('BEGIN EXCLUSIVE'); }
    catch { lease.close(); throw new Error('Another process owns this workspace execution lock'); }
    return () => { lease.exec('ROLLBACK'); lease.close(); };
  }
  close() { this.database.close(); }
}
