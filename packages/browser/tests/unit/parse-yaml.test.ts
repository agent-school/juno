import { describe, expect, it } from 'vitest';
import type { Page } from 'playwright';
import { SnapshotParseError } from '../../src/errors.js';
import { parseAriaYaml } from '../../src/parse-yaml.js';
import { SemanticPageReader } from '../../src/reader.js';
import { PageTreeSchema } from '../../src/snapshot-schema.js';

/**
 * Verbatim live-capture fixture from
 * .planning/phases/01-browser-core/01-PATTERNS.md (ai mode + boxes, real
 * Chrome, playwright 1.62.1). This block is the primary parser fixture —
 * never edit it to make tests pass.
 */
const FIXTURE_YAML = [
  '- generic [active] [ref=e1] [box=8,21,1264,150]:',
  '  - heading "Todo Demo" [level=1] [ref=e2] [box=8,21,1264,37]',
  '  - text: What needs to be done?',
  '  - textbox "What needs to be done?" [ref=e3] [box=165,80,185,21]:',
  '    - /placeholder: Buy groceries',
  '  - button "Add todo" [ref=e4] [box=354,80,69,21]',
  '  - checkbox [ref=e7] [box=52,120,13,13]',
  '  - combobox [ref=e8]:',
  '    - option "Low" [selected]',
].join('\n');

describe('parseAriaYaml + PageTreeSchema', () => {
  it('round-trips the verbatim live-capture fixture into a fully typed tree', () => {
    const tree = PageTreeSchema.parse(parseAriaYaml(FIXTURE_YAML));

    expect(tree.children).toHaveLength(1);
    const root = tree.children[0];
    expect(root?.role).toBe('generic');
    expect(root?.active).toBe(true);
    expect(root?.ref).toBe('e1');
    expect(root?.box).toEqual({ x: 8, y: 21, width: 1264, height: 150 });

    const [heading, text, textbox, button, checkbox, combobox] =
      root?.children ?? [];
    expect(heading).toMatchObject({
      role: 'heading',
      name: 'Todo Demo',
      level: 1,
      ref: 'e2',
    });
    expect(heading?.box).toEqual({ x: 8, y: 21, width: 1264, height: 37 });
    expect(text).toMatchObject({
      role: 'text',
      text: 'What needs to be done?',
    });
    expect(textbox).toMatchObject({
      role: 'textbox',
      name: 'What needs to be done?',
      ref: 'e3',
      placeholder: 'Buy groceries',
    });
    expect(textbox?.box).toEqual({ x: 165, y: 80, width: 185, height: 21 });
    expect(button).toMatchObject({
      role: 'button',
      name: 'Add todo',
      ref: 'e4',
    });
    expect(button?.box).toEqual({ x: 354, y: 80, width: 69, height: 21 });
    expect(checkbox).toMatchObject({ role: 'checkbox', ref: 'e7' });
    expect(combobox).toMatchObject({ role: 'combobox', ref: 'e8' });
    expect(combobox?.children[0]).toMatchObject({
      role: 'option',
      name: 'Low',
      selected: true,
    });
  });

  it('maps every documented state suffix and /attribute', () => {
    const yaml = [
      '- generic [ref=e1]:',
      '  - checkbox "Terms" [checked] [disabled] [ref=e10]',
      '  - button "Disclosure" [expanded] [pressed] [invalid] [ref=e11]',
      '  - link "Docs" [ref=e12]:',
      '    - /url: https://example.com/docs',
    ].join('\n');

    const tree = PageTreeSchema.parse(parseAriaYaml(yaml));
    const [terms, disclosure, docs] = tree.children[0]?.children ?? [];

    expect(terms).toMatchObject({
      role: 'checkbox',
      name: 'Terms',
      checked: true,
      disabled: true,
      ref: 'e10',
    });
    expect(disclosure).toMatchObject({
      role: 'button',
      expanded: true,
      pressed: true,
      invalid: true,
    });
    expect(docs).toMatchObject({
      role: 'link',
      name: 'Docs',
      url: 'https://example.com/docs',
    });
  });

  it('parses a root-only page (zero child entries) to a valid tree whose root has empty children', () => {
    const tree = PageTreeSchema.parse(parseAriaYaml('- generic:'));
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0]).toMatchObject({ role: 'generic', children: [] });
  });

  it('parses an empty capture (empty page) to a valid tree with zero top-level nodes', () => {
    const tree = PageTreeSchema.parse(parseAriaYaml(''));
    expect(tree.children).toEqual([]);
  });

  it('throws SnapshotParseError for null or undefined input', () => {
    expect(() => parseAriaYaml(null as unknown as string)).toThrow(
      SnapshotParseError,
    );
    expect(() => parseAriaYaml(undefined as unknown as string)).toThrow(
      SnapshotParseError,
    );
  });

  it('throws SnapshotParseError for unparseable YAML', () => {
    expect(() => parseAriaYaml('key: [unclosed')).toThrow(SnapshotParseError);
  });

  it('rejects schema-invalid YAML (node missing role) at PageTreeSchema.parse, not in the parser', () => {
    // Valid YAML; the single-quoted item parses to a node line that has a
    // quoted name and a ref but no role — the zod schema must reject it.
    const unvalidated = parseAriaYaml(`- '"Add todo" [ref=e9]'`);
    expect(() => PageTreeSchema.parse(unvalidated)).toThrow(
      expect.objectContaining({ name: 'ZodError' }),
    );
  });
});

describe('SemanticPageReader.read', () => {
  function fakePage(capture: string): Page {
    return {
      ariaSnapshot: async () => capture,
      url: () => 'http://127.0.0.1:8931/',
    } as unknown as Page;
  }

  it('returns a validated typed tree from a well-formed capture', async () => {
    const tree = await new SemanticPageReader().read(fakePage(FIXTURE_YAML));
    expect(tree.children[0]?.role).toBe('generic');
    expect(tree.children[0]?.children.length).toBeGreaterThan(0);
  });

  it('returns a valid empty tree for an empty capture', async () => {
    const tree = await new SemanticPageReader().read(fakePage(''));
    expect(tree.children).toEqual([]);
  });

  it('wraps schema rejection as SnapshotParseError carrying the zod issues', async () => {
    const reader = new SemanticPageReader();
    const attempt = reader.read(fakePage(`- '"Add todo" [ref=e9]'`));
    await expect(attempt).rejects.toBeInstanceOf(SnapshotParseError);
    await expect(attempt).rejects.toMatchObject({ code: 'SNAPSHOT_PARSE' });
  });
});
