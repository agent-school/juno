import { parse as parseYaml } from 'yaml';
import { SnapshotParseError } from './errors.js';

/**
 * The ONLY module in the package that imports the `yaml` package.
 *
 * parseAriaYaml turns a `page.ariaSnapshot({ mode: 'ai', boxes: true })`
 * YAML capture into an unvalidated plain-object tree shaped like the
 * future JSON node schema. Validation is NOT done here — the zod
 * PageTreeSchema at the reader is the data fence; this module only
 * interprets structure (never regex line-matching of the YAML text —
 * the real yaml parser handles nested lists and quoted names).
 */

interface RawBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RawNode {
  role?: string;
  name?: string;
  text?: string;
  children: RawNode[];
  checked?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  active?: boolean;
  invalid?: boolean;
  level?: number;
  pressed?: boolean;
  selected?: boolean;
  url?: string;
  placeholder?: string;
  ref?: string;
  cursor?: string;
  box?: RawBox;
}

const STATE_FLAGS = new Set([
  'checked',
  'disabled',
  'expanded',
  'active',
  'invalid',
  'pressed',
  'selected',
]);

export function parseAriaYaml(input: string): unknown {
  if (typeof input !== 'string') {
    const kind = input === null ? 'null' : typeof input;
    throw new SnapshotParseError(
      `aria snapshot capture must be a string, got ${kind}`,
    );
  }

  let raw: unknown;
  try {
    raw = parseYaml(input);
  } catch (error) {
    throw new SnapshotParseError('aria snapshot YAML is not parseable', {
      cause: error,
    });
  }

  return interpretDocument(raw);
}

function interpretDocument(raw: unknown): unknown {
  // Empty capture (empty page): the accessibility tree reports nothing.
  // A valid tree with zero top-level nodes — never a throw.
  if (raw === null || raw === undefined) {
    return { children: [] };
  }
  if (!Array.isArray(raw)) {
    throw new SnapshotParseError(
      'aria snapshot document must be a YAML list of nodes',
    );
  }

  const tree: { children: RawNode[] } = { children: [] };
  for (const item of raw) {
    if (typeof item === 'string') {
      tree.children.push(parseNodeLine(item));
      continue;
    }
    const entry = singleEntry(item);
    if (entry) {
      const [key, value] = entry;
      if (key.startsWith('/')) {
        throw new SnapshotParseError(
          `attribute entry "${key}" at document root has no parent node`,
        );
      }
      tree.children.push(interpretNodeEntry(key, value));
      continue;
    }
    throw new SnapshotParseError(
      `structurally invalid aria snapshot entry: ${describe(item)}`,
    );
  }
  return tree;
}

function interpretNodeEntry(key: string, value: unknown): RawNode {
  const node = parseNodeLine(key);
  if (value === null || value === undefined) {
    return node;
  }
  if (Array.isArray(value)) {
    interpretChildren(node, value);
    return node;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    // e.g. `text: What needs to be done?`
    node.text = String(value);
    return node;
  }
  throw new SnapshotParseError(
    `structurally invalid value under node "${key}": ${describe(value)}`,
  );
}

function interpretChildren(parent: RawNode, items: unknown[]): void {
  for (const item of items) {
    if (typeof item === 'string') {
      parent.children.push(parseNodeLine(item));
      continue;
    }
    const entry = singleEntry(item);
    if (entry) {
      const [key, value] = entry;
      if (
        key.startsWith('/') &&
        (typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean')
      ) {
        applyParentAttribute(parent, key, String(value));
        continue;
      }
      parent.children.push(interpretNodeEntry(key, value));
      continue;
    }
    throw new SnapshotParseError(
      `structurally invalid aria snapshot child entry: ${describe(item)}`,
    );
  }
}

/**
 * Parse one node line: `role "accessible name" [attr] [attr] ...`.
 * A line that does not start with a bare role word (e.g. it starts with a
 * quoted name) yields a node WITHOUT a role — the zod schema rejects it,
 * which the reader surfaces as SnapshotParseError. Never a guessed role.
 */
function parseNodeLine(line: string): RawNode {
  const node: RawNode = { children: [] };
  let rest = line.trim();
  if (rest.length === 0) {
    throw new SnapshotParseError('empty node line in aria snapshot');
  }

  const roleMatch = /^([A-Za-z][A-Za-z0-9-]*)/.exec(rest);
  if (roleMatch?.[1] !== undefined) {
    node.role = roleMatch[1];
    rest = rest.slice(roleMatch[1].length);
  }

  const nameMatch = /^\s*"((?:[^"\\]|\\.)*)"/.exec(rest);
  if (nameMatch?.[1] !== undefined) {
    node.name = unescapeDoubleQuoted(nameMatch[1]);
    rest = rest.slice(nameMatch[0].length);
  }

  for (;;) {
    const attrMatch = /^\s*\[([^\]]*)\]/.exec(rest);
    if (attrMatch?.[1] === undefined) {
      break;
    }
    applyNodeAttribute(node, attrMatch[1].trim());
    rest = rest.slice(attrMatch[0].length);
  }

  if (rest.trim().length > 0) {
    throw new SnapshotParseError(
      `unrecognized aria snapshot node line: ${JSON.stringify(line)}`,
    );
  }
  return node;
}

function applyNodeAttribute(node: RawNode, attr: string): void {
  if (attr.length === 0) {
    return;
  }
  if (STATE_FLAGS.has(attr)) {
    node[attr as 'checked' | 'disabled' | 'expanded' | 'active' | 'invalid' | 'pressed' | 'selected'] = true;
    return;
  }

  const eq = attr.indexOf('=');
  if (eq === -1) {
    // Unknown bare flag (e.g. horizontal, wrap) — not modeled; dropped.
    return;
  }
  const key = attr.slice(0, eq);
  const value = attr.slice(eq + 1);

  if (key === 'ref') {
    node.ref = value;
  } else if (key === 'level') {
    const level = Number(value);
    if (!Number.isFinite(level)) {
      throw new SnapshotParseError(`malformed level attribute: [${attr}]`);
    }
    node.level = level;
  } else if (key === 'box') {
    const parts = value.split(',').map((part) => Number(part.trim()));
    if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
      throw new SnapshotParseError(`malformed box attribute: [${attr}]`);
    }
    node.box = {
      x: parts[0] as number,
      y: parts[1] as number,
      width: parts[2] as number,
      height: parts[3] as number,
    };
  }
  // Unknown key=value attribute — not modeled; dropped.
}

function applyParentAttribute(parent: RawNode, key: string, value: string): void {
  if (key === '/placeholder') {
    parent.placeholder = value;
  } else if (key === '/url') {
    parent.url = value;
  } else if (key === '/cursor') {
    parent.cursor = value;
  }
  // Unknown /attribute — not modeled; dropped.
}

function unescapeDoubleQuoted(text: string): string {
  return text.replace(/\\(["\\])/g, '$1');
}

function singleEntry(item: unknown): [string, unknown] | null {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) {
    return null;
  }
  const entries = Object.entries(item);
  if (entries.length !== 1) {
    return null;
  }
  return entries[0] as [string, unknown];
}

function describe(item: unknown): string {
  try {
    return JSON.stringify(item) ?? String(item);
  } catch {
    return String(item);
  }
}
