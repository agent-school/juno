import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { hashKnowledge, structuralRevision } from './compiler.js';
import { SiteModelSchema, type SiteModel } from './model.js';

/** Bounded, versioned, single-writer semantic knowledge. Never reads browser profiles or accounts. */
export class SiteKnowledgeStore {
  constructor(private readonly directory: string) { fs.mkdirSync(directory, { recursive: true, mode: 0o700 }); }
  private file(owner: string, origin: string) {
    if (!/^[a-f0-9]{64}$/.test(owner)) throw new Error('Invalid knowledge owner');
    const address = new URL(origin);
    if (!['http:', 'https:'].includes(address.protocol) || address.origin !== origin) throw new Error('Invalid canonical site origin');
    return path.join(this.directory, owner, `${hashKnowledge(origin)}.json`);
  }
  versions(owner: string, origin: string): SiteModel[] {
    const file = this.file(owner, origin);
    if (!fs.existsSync(file)) return [];
    if (fs.statSync(file).size > 2_650_000) throw new Error('Knowledge file exceeds budget');
    const models = z.array(SiteModelSchema).min(1).max(10).parse(JSON.parse(fs.readFileSync(file, 'utf8')));
    for (const model of models) {
      if (model.origin !== origin || structuralRevision(model) !== model.structuralRevision ||
          model.pages.some(page => hashKnowledge({ elements: page.elements, navigation: page.navigation }) !== page.fingerprint) ||
          model.operations.some(operation => hashKnowledge(operation.contract) !== operation.contractVersion)) {
        throw new Error('Knowledge integrity mismatch; forget and explicitly recompile');
      }
    }
    return models;
  }
  latest(owner: string, origin: string) { return this.versions(owner, origin).at(-1) ?? null; }
  save(owner: string, value: SiteModel): SiteModel {
    const model = SiteModelSchema.parse(value), file = this.file(owner, model.origin);
    if (Buffer.byteLength(JSON.stringify(model)) > 262_144) throw new Error('Site model exceeds budget');
    if (model.structuralRevision !== structuralRevision(model) ||
        model.pages.some(page => hashKnowledge({ elements: page.elements, navigation: page.navigation }) !== page.fingerprint) ||
        model.operations.some(operation => hashKnowledge(operation.contract) !== operation.contractVersion)) throw new Error('Invalid knowledge fingerprint');
    const history = this.versions(owner, model.origin), latest = history.at(-1);
    if (latest?.structuralRevision === model.structuralRevision) return latest;
    const directory = path.dirname(file);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    if (!fs.existsSync(file) && fs.readdirSync(directory).filter(name => name.endsWith('.json')).length >= 20) throw new Error('Per-workspace site budget exhausted');
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      const descriptor = fs.openSync(temporary, 'wx', 0o600);
      try { fs.writeFileSync(descriptor, JSON.stringify([...history, model].slice(-10))); fs.fsyncSync(descriptor); }
      finally { fs.closeSync(descriptor); }
      fs.renameSync(temporary, file);
    } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
    return structuredClone(model);
  }
  forget(owner: string, origin: string) { fs.rmSync(this.file(owner, origin), { force: true }); }
}
