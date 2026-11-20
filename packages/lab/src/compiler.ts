import { randomUUID } from 'node:crypto';
import { GroundingError, type PageTree, type SemanticRef, type SnapshotNode } from '@juno/browser';
import { InputSchema, type Model } from './contracts.js';

export class PreconditionError extends Error {}
function flatten(nodes: SnapshotNode[]): SnapshotNode[] {
  return nodes.flatMap(node => [node, ...flatten(node.children)]);
}
function unique(nodes: SnapshotNode[], role: string, names: string[]): SemanticRef {
  const matches = nodes.filter(node => node.role === role && names.includes(node.name ?? '') && !node.disabled);
  if (matches.length !== 1) throw new PreconditionError(`Expected one ${role} named ${names.join(' or ')}; observed ${matches.length}. No action taken.`);
  const match = matches[0]!;
  return { role, name: match.name! };
}

/** A deliberately narrow compiler for the owned fixture's declared contract.
 * This binds live observed roles/names; it is NOT a general website compiler or LLM discovery.
 */
export function compile(tree: PageTree): Model {
  const nodes = flatten(tree.children);
  return {
    version: randomUUID(), compiledAt: new Date().toISOString(),
    operation: 'capture_interaction', risk: 'write-benign', scope: 'owned-fixture-only',
    inputSchema: InputSchema.toJSONSchema(),
    bindings: {
      person: unique(nodes, 'combobox', ['Person']),
      note: unique(nodes, 'textbox', ['Interaction note']),
      occurred_at: unique(nodes, 'textbox', ['Interaction date']),
      next_action: unique(nodes, 'textbox', ['Next action']),
      submit: unique(nodes, 'button', ['Capture interaction', 'Log interaction']),
    },
  };
}
export function checkBindings(tree: PageTree, model: Model): void {
  const nodes = flatten(tree.children);
  for (const ref of Object.values(model.bindings)) unique(nodes, ref.role, [ref.name ?? '']);
}

export function categoryFor(error: unknown): 'precondition' | 'grounding' | 'perception' | 'execution' {
  if (error instanceof PreconditionError) return 'precondition';
  if (error instanceof GroundingError) return 'grounding';
  if (error instanceof Error && error.name === 'SnapshotParseError') return 'perception';
  return 'execution';
}
