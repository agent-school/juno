import { z } from 'zod';
import type { AuditEntry, PageTree, SemanticRef } from '@juno/browser';
import type { SiteModel } from '@juno/knowledge';
import { emptyWorkspace, type Workspace } from './workspace.js';

export const InputSchema = z.object({
  person: z.enum(['Alice Smith', 'Bob Chen']),
  note: z.string().trim().min(1).max(500),
  occurred_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const date = new Date(value);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }, 'Use a valid calendar date'),
  next_action: z.string().trim().min(1).max(200),
}).strict();
export type Inputs = z.infer<typeof InputSchema>;
export const RunSchema = z.object({ requestId: z.uuid(), inputs: InputSchema }).strict();
export const VariantSchema = z.enum(['original', 'reordered', 'renamed', 'ambiguous', 'no-effect']);
export type Variant = z.infer<typeof VariantSchema>;
export type Bindings = Record<keyof Inputs | 'submit', SemanticRef>;
export interface Model {
  knowledge?: SiteModel;
  version: string;
  compiledAt: string;
  operation: 'capture_interaction';
  risk: 'write-benign';
  scope: 'owned-fixture-only';
  bindings: Bindings;
  inputSchema: unknown;
}
export interface Interaction extends Inputs { id: string; requestId: string; }
export interface Assertion { name: string; passed: boolean; }
export interface Receipt {
  audit?: AuditEntry[];
  id: string;
  operation: 'capture_interaction';
  inputs: Inputs;
  modelVersion: string | null;
  variant: Variant;
  startedAt: string;
  durationMs: number;
  status: 'running' | 'verified' | 'failed' | 'uncertain';
  category?: 'precondition' | 'grounding' | 'perception' | 'verification' | 'execution' | 'interrupted';
  message?: string;
  actions: { method: string; target: SemanticRef }[];
  assertions: Assertion[];
  observations: { before?: PageTree; after?: PageTree };
  recovery: string[];
  metrics: { modelCalls: 0; modelCostUsd: 0; browserActions: number };
}
export interface LabState {
  workspace: Workspace;
  variant: Variant;
  model: Model | null;
  interactions: Interaction[];
  receipts: Receipt[];
  feedback: { id: string; runId: string | null; text: string; createdAt: string }[];
}
export function emptyState(): LabState {
  return { workspace: emptyWorkspace(), variant: 'original', model: null, interactions: [], receipts: [], feedback: [] };
}

/** Persist semantic identity only; eN handles and coordinates expire with the page. */
export function durableTree(tree: PageTree): PageTree {
  function clean(nodes: PageTree['children']): PageTree['children'] {
    return nodes.map(({ ref: _ref, box: _box, ...node }) => ({ ...node, children: clean(node.children) }));
  }
  return { children: clean(tree.children) };
}

export function verifyInteraction(records: Interaction[], requestId: string, inputs: Inputs): Assertion[] {
  const found = records.filter(record => record.requestId === requestId);
  return [
    { name: 'Exactly one interaction was created for this request', passed: found.length === 1 },
    ...(['person', 'note', 'occurred_at', 'next_action'] as const).map(key => ({
      name: `${key} matches the requested value`, passed: found.length === 1 && found[0]?.[key] === inputs[key],
    })),
  ];
}
