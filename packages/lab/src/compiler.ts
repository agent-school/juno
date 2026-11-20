import { randomUUID } from 'node:crypto';
import { GroundingError, type PageTree, type SemanticRef, type SnapshotNode } from '@juno/browser';
import { compileSite, SemanticIdentitySchema, type OperationContract } from '@juno/knowledge';
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

/** Host-reviewed operation semantics; the page supplies bindings, never the risk or effect contract. */
export function compileFixtureKnowledge(origin: string, tree: PageTree, model: Model) {
  const target = (ref: SemanticRef) => SemanticIdentitySchema.parse({ ...ref, exact: true });
  const contract: OperationContract = {
    id: 'capture_interaction', pageRoute: '/fixture', risk: 'write-benign',
    inputs: {
      person: { kind: 'enum', required: true, maxLength: 100, choices: ['Alice Smith', 'Bob Chen'] },
      note: { kind: 'text', required: true, maxLength: 500 },
      occurred_at: { kind: 'calendar-date', required: true, maxLength: 10 },
      next_action: { kind: 'text', required: true, maxLength: 200 },
    },
    preconditions: Object.values(model.bindings).map(ref => ({ kind: 'unique-enabled', target: target(ref) })),
    steps: [
      { method: 'selectOption', target: target(model.bindings.person), parameter: 'person' },
      ...(['note', 'occurred_at', 'next_action'] as const).map(key => ({ method: 'fill' as const, target: target(model.bindings[key]), parameter: key })),
      { method: 'click', target: target(model.bindings.submit) },
    ],
    effects: [{ kind: 'record-matches-inputs', source: 'fixture-store', key: 'requestId', fields: ['person', 'note', 'occurred_at', 'next_action'], unique: true }],
    verification: { kind: 'independent-state', source: 'fixture-store', required: true },
  };
  return compileSite({ origin, pages: [{ route: '/fixture', tree }], operations: [contract] });
}

export function categoryFor(error: unknown): 'precondition' | 'grounding' | 'perception' | 'execution' {
  if (error instanceof PreconditionError) return 'precondition';
  if (error instanceof GroundingError) return 'grounding';
  if (error instanceof Error && error.name === 'SnapshotParseError') return 'perception';
  return 'execution';
}
