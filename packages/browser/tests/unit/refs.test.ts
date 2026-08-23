import { describe, expect, it } from 'vitest';
import type { Locator, Page } from 'playwright';
import {
  AmbiguousReference,
  GroundingError,
  GroundingTimeout,
  StaleReference,
} from '../../src/errors.js';
import {
  describeRef,
  resolveEphemeralRef,
  resolveSemanticRef,
  toGroundingError,
  validateFresh,
} from '../../src/refs.js';
import type { PageTree } from '../../src/snapshot-schema.js';

/**
 * Browser-free unit tests for the reference resolution layer. Resolvers run
 * against a fake page/locator that records the composed locator chain; live
 * resolution is covered by the acting/failsafe e2e specs.
 */

interface Call {
  via: 'getByRole' | 'locator';
  role?: string;
  name?: string | undefined;
  exact?: boolean | undefined;
  selector?: string;
}

function fakePage(): { page: Page; calls: Call[] } {
  const calls: Call[] = [];
  const makeLocator = (): Locator => {
    const locator = {
      getByRole(role: string, opts: { name?: string; exact?: boolean } = {}) {
        calls.push({ via: 'getByRole', role, name: opts.name, exact: opts.exact });
        return makeLocator();
      },
    };
    return locator as unknown as Locator;
  };
  const page = {
    getByRole(role: string, opts: { name?: string; exact?: boolean } = {}) {
      calls.push({ via: 'getByRole', role, name: opts.name, exact: opts.exact });
      return makeLocator();
    },
    locator(selector: string) {
      calls.push({ via: 'locator', selector });
      return makeLocator();
    },
  };
  return { page: page as unknown as Page, calls };
}

describe('resolveSemanticRef — strict locator composition', () => {
  it('builds a getByRole locator with exact:true by default', () => {
    const { page, calls } = fakePage();
    resolveSemanticRef(page, { role: 'button', name: 'Add task' });
    expect(calls).toEqual([
      { via: 'getByRole', role: 'button', name: 'Add task', exact: true },
    ]);
  });

  it('honors an explicit exact:false', () => {
    const { page, calls } = fakePage();
    resolveSemanticRef(page, { role: 'button', name: 'Add task', exact: false });
    expect(calls[0]).toMatchObject({ exact: false });
  });

  it('folds the scope chain outermost-first — never positional disambiguation', () => {
    const { page, calls } = fakePage();
    resolveSemanticRef(page, {
      role: 'button',
      name: 'Add task',
      scopeChain: [
        { role: 'list', name: 'Tasks' },
        { role: 'listitem', name: 'Buy milk' },
      ],
    });
    expect(calls).toEqual([
      { via: 'getByRole', role: 'list', name: 'Tasks', exact: true },
      { via: 'getByRole', role: 'listitem', name: 'Buy milk', exact: true },
      { via: 'getByRole', role: 'button', name: 'Add task', exact: true },
    ]);
  });

  it('supports role-only refs without a name', () => {
    const { page, calls } = fakePage();
    resolveSemanticRef(page, { role: 'checkbox' });
    expect(calls[0]).toMatchObject({ role: 'checkbox' });
  });
});

describe('resolveEphemeralRef — plain aria-ref selector, id shape validation', () => {
  it('resolves via the plain working selector syntax (never the internal: prefix)', () => {
    const { page, calls } = fakePage();
    resolveEphemeralRef(page, { ref: 'e4', role: 'button', name: 'Add task' });
    expect(calls).toEqual([{ via: 'locator', selector: 'aria-ref=e4' }]);
  });

  it('rejects malformed ref ids with StaleReference', () => {
    const { page } = fakePage();
    for (const bad of ['element-4', 'e', 'e4x', 'E4', '', '4']) {
      expect(
        () => resolveEphemeralRef(page, { ref: bad, role: 'button' }),
        `ref id "${bad}" must be rejected`,
      ).toThrow(StaleReference);
    }
  });
});

describe('toGroundingError — typed error mapping at the boundary', () => {
  it('maps a Playwright TimeoutError shape to GroundingTimeout carrying the ref description', () => {
    const timeout = new Error('Timeout 1500ms exceeded.');
    timeout.name = 'TimeoutError';
    const mapped = toGroundingError(timeout, 'button "Add task"');
    expect(mapped).toBeInstanceOf(GroundingTimeout);
    expect(mapped).toBeInstanceOf(GroundingError);
    expect((mapped as GroundingTimeout).code).toBe('GROUNDING_TIMEOUT');
    expect((mapped as GroundingTimeout).refDescription).toBe('button "Add task"');
  });

  it('maps a strict-mode-violation error shape to AmbiguousReference', () => {
    const strict = new Error(
      "strict mode violation: getByRole('button', { name: 'Add task' }) resolved to 2 elements:",
    );
    const mapped = toGroundingError(strict, 'button "Add task"');
    expect(mapped).toBeInstanceOf(AmbiguousReference);
    expect((mapped as AmbiguousReference).code).toBe('AMBIGUOUS_REFERENCE');
    expect((mapped as AmbiguousReference).refDescription).toBe('button "Add task"');
  });

  it('passes already-typed grounding errors through unchanged', () => {
    const typed = new StaleReference('identity changed', 'button "Add task"');
    expect(toGroundingError(typed, 'button "Add task"')).toBe(typed);
  });

  it('leaves non-grounding errors untouched', () => {
    const other = new TypeError('boom');
    expect(toGroundingError(other, 'button "Add task"')).toBe(other);
  });
});

describe('validateFresh — fresh-snapshot identity checks (synthetic trees)', () => {
  const tree: PageTree = {
    children: [
      {
        role: 'generic',
        ref: 'e1',
        children: [
          { role: 'textbox', name: 'Task name', ref: 'e3', children: [] },
          { role: 'button', name: 'Add task', ref: 'e4', children: [] },
        ],
      },
    ],
  };

  it('accepts a matching role+name+ref identity', () => {
    expect(() =>
      validateFresh(tree, { ref: 'e4', role: 'button', name: 'Add task' }),
    ).not.toThrow();
  });

  it('throws StaleReference when the ref now resolves to a different role', () => {
    expect(() => validateFresh(tree, { ref: 'e4', role: 'textbox' })).toThrow(
      StaleReference,
    );
  });

  it('throws StaleReference when the accessible name changed', () => {
    expect(() =>
      validateFresh(tree, { ref: 'e4', role: 'button', name: 'Add todo' }),
    ).toThrow(StaleReference);
  });

  it('throws GroundingTimeout when the ref is absent from the fresh tree', () => {
    expect(() => validateFresh(tree, { ref: 'e99', role: 'button' })).toThrow(
      GroundingTimeout,
    );
  });

  it('checks nested nodes, not just the top level', () => {
    expect(() =>
      validateFresh(tree, { ref: 'e3', role: 'textbox', name: 'Task name' }),
    ).not.toThrow();
  });
});

describe('describeRef — semantic descriptions only (T-1-09)', () => {
  it('describes a semantic ref as role "name"', () => {
    expect(describeRef({ role: 'button', name: 'Add task' })).toBe(
      'button "Add task"',
    );
  });

  it('includes the scope chain in the description', () => {
    expect(
      describeRef({
        role: 'button',
        name: 'Add task',
        scopeChain: [{ role: 'list', name: 'Tasks' }],
      }),
    ).toBe('list "Tasks" > button "Add task"');
  });

  it('never includes the ephemeral eN id in a description', () => {
    const description = describeRef({
      ref: 'e4',
      role: 'button',
      name: 'Add task',
    });
    expect(description).toBe('button "Add task"');
    expect(description).not.toContain('e4');
  });
});
