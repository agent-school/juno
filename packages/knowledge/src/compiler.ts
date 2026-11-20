import { createHash, randomUUID } from 'node:crypto';
import { PageTreeSchema, type PageTree, type SnapshotNode } from '@juno/browser';
import { OperationContractSchema, SiteModelSchema, type OperationContract, type SiteModel } from './model.js';

const interactive = new Set(['button', 'textbox', 'combobox', 'checkbox', 'radio', 'link', 'switch', 'menuitem', 'tab']);
const containers = new Set(['form', 'region', 'dialog', 'navigation', 'main']);
const sensitive = /password|passphrase|secret|token|api.?key|verification code/i;
const credential = /(?:Bearer\s+\S+|(?:sk-|ghp_|github_pat_)[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g;
type Identity = SiteModel['pages'][number]['elements'][number]['identity'];
export const hashKnowledge = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function ordered<T>(values: T[]) { return [...values].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))); }

export function structuralRevision(model: Pick<SiteModel, 'pages' | 'operations' | 'origin'>) {
  return hashKnowledge({ origin: model.origin, pages: ordered(model.pages.map(page => ({ route: page.route, fingerprint: page.fingerprint }))),
    operations: ordered(model.operations.map(operation => ({ id: operation.contract.id, version: operation.contractVersion }))) });
}

/** Observes structure. Behavior contracts must come from trusted host review, never page instructions. */
export function compileSite(options: {
  origin: string;
  pages: { route: string; tree: PageTree }[];
  operations?: readonly OperationContract[];
  /** Known credential values supplied by the host's private store, discarded after redaction. */
  knownSecrets?: readonly string[];
}): SiteModel {
  if (options.pages.length < 1 || options.pages.length > 20) throw new Error('Compile one to twenty explicitly observed pages');
  const redact = (label: string) => {
    let result = label.replace(credential, '[redacted]');
    for (const secret of options.knownSecrets ?? []) if (secret) result = result.split(secret).join('[redacted]');
    return result;
  };
  const pages = options.pages.map(observation => {
    const tree = PageTreeSchema.parse(observation.tree);
    const elements: SiteModel['pages'][number]['elements'] = [];
    const navigation: SiteModel['pages'][number]['navigation'] = [];
    let unresolved = 0, visited = 0;
    const walk = (nodes: SnapshotNode[], scope: Identity['scopeChain'] = [], depth = 0) => {
      if (depth > 40) throw new Error('Semantic tree depth exceeds compiler budget');
      for (const node of nodes) {
        if (++visited > 10_000) throw new Error('Semantic tree exceeds compiler budget');
        const name = node.name ? redact(node.name) : undefined;
        const eligible = name && name.length <= 300 && !sensitive.test(name) && !name.includes('[redacted]');
        if (interactive.has(node.role)) {
          if (!eligible) unresolved++;
          else {
            const identity: Identity = { role: node.role, name, exact: true, ...(scope.length ? { scopeChain: scope } : {}) };
            elements.push({ identity, enabled: !node.disabled });
            if (node.role === 'link' && node.url) {
              try {
                const target = new URL(node.url, `${options.origin}${observation.route}`);
                if (target.origin === options.origin && !target.username && !target.password && !target.search && !target.hash &&
                    options.pages.some(page => page.route === target.pathname)) navigation.push({ identity, targetRoute: target.pathname });
              } catch { /* Unobserved/invalid destinations remain inert link affordances. */ }
            }
          }
        }
        const next = eligible && containers.has(node.role) ? [...scope, { role: node.role, name, exact: true as const }] : scope;
        walk(node.children, next, depth + 1);
      }
    };
    walk(tree.children);
    const sorted = ordered(elements);
    const sortedNavigation = ordered(navigation);
    return { route: observation.route, elements: sorted, navigation: sortedNavigation, unresolved, fingerprint: hashKnowledge({ elements: sorted, navigation: sortedNavigation }) };
  });
  if (new Set(pages.map(page => page.route)).size !== pages.length) throw new Error('Duplicate observed route');
  const operations = (options.operations ?? []).map(value => {
    const contract = OperationContractSchema.parse(value);
    for (const requirement of contract.preconditions) {
      const matches = pages.filter(page => page.route === contract.pageRoute).flatMap(page => page.elements).filter(element => element.enabled &&
        element.identity.role === requirement.target.role && element.identity.name === requirement.target.name &&
        (!requirement.target.scopeChain || JSON.stringify(element.identity.scopeChain) === JSON.stringify(requirement.target.scopeChain)));
      if (matches.length !== 1) throw new Error('Operation precondition lacks one enabled semantic target');
    }
    for (const step of contract.steps) {
      if (!contract.preconditions.some(condition => JSON.stringify(condition.target) === JSON.stringify(step.target))) throw new Error('Every step requires an explicit grounding precondition');
    }
    return { contract, contractVersion: hashKnowledge(contract), source: 'host-reviewed-contract' as const, validation: 'requires-runtime-verification' as const };
  });
  if (new Set(operations.map(operation => operation.contract.id)).size !== operations.length) throw new Error('Duplicate operation identity');
  const candidate = { schemaVersion: 1 as const, version: randomUUID(), origin: options.origin, observedAt: new Date().toISOString(),
    source: 'accessibility-observation' as const, pages, operations };
  return SiteModelSchema.parse({ ...candidate, structuralRevision: structuralRevision(candidate) });
}

export function compareSiteModels(before: SiteModel, after: SiteModel) {
  if (before.origin !== after.origin) throw new Error('Cannot compare knowledge across site origins');
  const routes = new Set([...before.pages, ...after.pages].map(page => page.route));
  const changedRoutes = [...routes].filter(route => before.pages.find(page => page.route === route)?.fingerprint !== after.pages.find(page => page.route === route)?.fingerprint);
  const ids = new Set([...before.operations, ...after.operations].map(operation => operation.contract.id));
  const changedOperations = [...ids].filter(id => before.operations.find(operation => operation.contract.id === id)?.contractVersion !== after.operations.find(operation => operation.contract.id === id)?.contractVersion);
  return { changed: before.structuralRevision !== after.structuralRevision, changedRoutes, changedOperations };
}
