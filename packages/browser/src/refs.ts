import type { Locator, Page } from 'playwright';
import {
  AmbiguousReference,
  GroundingError,
  GroundingTimeout,
  StaleReference,
} from './errors.js';
import type { PageTree, SnapshotNode } from './snapshot-schema.js';

/**
 * Two-layer reference model (RESEARCH Patterns 2–3):
 *
 * - SemanticRef — durable role+name reference, the only form ever persisted
 *   or logged. Resolved via strict getByRole locators (exact match by
 *   default); disambiguation is ONLY a refined semantic scope chain —
 *   positional locator methods (first/nth/last) are banned project-wide.
 *
 * - EphemeralRef — snapshot-scoped eN counter id plus the semantic identity
 *   observed at capture. Never persisted. Untrusted by default: any action
 *   through an ephemeral ref re-validates its identity against a fresh
 *   snapshot before resolving (Pattern 3 rule 3).
 */

/** One container scope in a SemanticRef chain, outermost first. */
export interface ScopeEntry {
  role: string;
  name?: string;
  exact?: boolean;
}

/** Durable semantic reference — the only form ever persisted or logged. */
export interface SemanticRef {
  role: string;
  name?: string;
  /** Defaults to true — exact accessible-name match (whitespace-normalized by Playwright). */
  exact?: boolean;
  /** Container scopes, outermost first. The ONLY disambiguation mechanism. */
  scopeChain?: ScopeEntry[];
}

/** Ephemeral snapshot-scoped reference: eN counter id + captured identity. */
export interface EphemeralRef {
  /** Snapshot-scoped counter id ('e' + digits). Never persisted or logged. */
  ref: string;
  /** Semantic identity expected to still hold for the referenced element. */
  role: string;
  name?: string;
}

export type AnyRef = SemanticRef | EphemeralRef;

/** Expected identity for a fresh-snapshot validation. */
export interface RefIdentity {
  ref: string;
  role?: string;
  name?: string;
}

const EPHEMERAL_REF_PATTERN = /^e\d+$/;

/**
 * Semantic description of a reference for errors and logs — role + name
 * (and scope chain) only. Ephemeral eN ids NEVER appear here (T-1-09).
 */
export function describeRef(ref: AnyRef): string {
  const scopeChain: ScopeEntry[] = 'ref' in ref ? [] : (ref.scopeChain ?? []);
  const parts = [
    ...scopeChain.map(describeScope),
    describeScope({ role: ref.role, name: ref.name }),
  ];
  return parts.join(' > ');
}

function describeScope(scope: { role?: string; name?: string }): string {
  const role = scope.role ?? 'element';
  return scope.name === undefined ? role : `${role} "${scope.name}"`;
}

/**
 * Resolve a SemanticRef to a strict Playwright locator: the outermost scope
 * (or the target itself when no scopeChain) first, chaining inward so the
 * target resolves INSIDE its container scopes — never positional
 * disambiguation. getByRole with exact:true by default.
 */
export function resolveSemanticRef(page: Page, ref: SemanticRef): Locator {
  const chain: Array<{ role: string; name?: string; exact?: boolean }> = [
    ...(ref.scopeChain ?? []),
    { role: ref.role, name: ref.name, exact: ref.exact },
  ];
  const [outermost, ...rest] = chain;
  if (!outermost) {
    throw new Error('unreachable: reference chain is never empty');
  }
  let locator = page.getByRole(outermost.role as ByRole, {
    ...(outermost.name === undefined ? {} : { name: outermost.name }),
    exact: outermost.exact ?? true,
  });
  for (const scope of rest) {
    locator = locator.getByRole(scope.role as ByRole, {
      ...(scope.name === undefined ? {} : { name: scope.name }),
      exact: scope.exact ?? true,
    });
  }
  return locator;
}

type ByRole = Parameters<Page['getByRole']>[0];

/**
 * Resolve an EphemeralRef via the plain working selector syntax
 * (`aria-ref=eN` — the internal:-prefixed variant does not parse).
 * The id must match the counter-based pattern; anything else is
 * StaleReference.
 */
export function resolveEphemeralRef(page: Page, ref: EphemeralRef): Locator {
  if (!EPHEMERAL_REF_PATTERN.test(ref.ref)) {
    throw new StaleReference(
      `reference is not a valid snapshot ref id and is treated as stale`,
      describeRef(ref),
    );
  }
  return page.locator(`aria-ref=${ref.ref}`);
}

/**
 * Validate an expected identity against a FRESH snapshot tree:
 * - ref absent from the tree → GroundingTimeout (element gone)
 * - ref present but role/name differ → StaleReference (identity changed)
 * Matching identity passes; the caller may then act on the ref.
 */
export function validateFresh(tree: PageTree, expected: RefIdentity): void {
  const node = findNodeByRef(tree, expected.ref);
  const description = describeIdentity(expected);

  if (node === null) {
    throw new GroundingTimeout(
      `expected target ${description} is absent from the fresh snapshot`,
      description,
    );
  }
  if (expected.role !== undefined && node.role !== expected.role) {
    throw new StaleReference(
      `expected target ${description} now resolves to ${describeScope(node)}`,
      description,
    );
  }
  if (expected.name !== undefined && node.name !== expected.name) {
    throw new StaleReference(
      `expected target ${description} now resolves to ${describeScope(node)}`,
      description,
    );
  }
}

function describeIdentity(expected: RefIdentity): string {
  return describeScope({ role: expected.role, name: expected.name });
}

function findNodeByRef(tree: PageTree, ref: string): SnapshotNode | null {
  const stack = [...tree.children];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      break;
    }
    if (node.ref === ref) {
      return node;
    }
    stack.push(...node.children);
  }
  return null;
}

/**
 * Map a caught error at the action boundary into the typed taxonomy:
 * - Playwright TimeoutError shape → GroundingTimeout
 * - strict-mode violation → AmbiguousReference
 * - already-typed GroundingError → unchanged
 * - anything else → unchanged (not a grounding failure; programming errors
 *   and unrelated Playwright failures propagate as-is)
 */
export function toGroundingError(
  error: unknown,
  refDescription: string,
): unknown {
  if (error instanceof GroundingError) {
    return error;
  }
  if (error instanceof Error) {
    if (
      error.name === 'TimeoutError' ||
      /Timeout \d+ms exceeded/.test(error.message)
    ) {
      return new GroundingTimeout(
        `no match for ${refDescription} within the action timeout: ${error.message}`,
        refDescription,
      );
    }
    if (error.message.includes('strict mode violation')) {
      return new AmbiguousReference(
        `${refDescription} matched more than one element: ${error.message}`,
        refDescription,
      );
    }
  }
  return error;
}
