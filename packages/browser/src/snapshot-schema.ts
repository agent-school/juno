import { z } from 'zod';

/**
 * Typed snapshot model — mirrors the documented future JSON node schema
 * (role, name, text, children, checked, disabled, expanded, active, invalid,
 * level, pressed, selected, url, placeholder, ref, cursor, box) so migration
 * to the not-yet-released JSON snapshot API is a one-line swap at the reader.
 *
 * The semantic model contains ONLY what the accessibility tree reports —
 * no synthesized roles, names, or states, no enrichment beyond observed
 * structure. Snapshot content enters the model only through this schema.
 */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SnapshotNode {
  role: string;
  name?: string;
  text?: string;
  children: SnapshotNode[];
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
  /** Ephemeral in-session ref (eN) from the current snapshot. Never persisted. */
  ref?: string;
  cursor?: string;
  box?: Box;
}

export const BoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const SnapshotNodeSchema: z.ZodType<SnapshotNode> = z.lazy(() =>
  z.object({
    role: z.string(),
    name: z.string().optional(),
    text: z.string().optional(),
    children: z.array(SnapshotNodeSchema).default([]),
    checked: z.boolean().optional(),
    disabled: z.boolean().optional(),
    expanded: z.boolean().optional(),
    active: z.boolean().optional(),
    invalid: z.boolean().optional(),
    level: z.number().optional(),
    pressed: z.boolean().optional(),
    selected: z.boolean().optional(),
    url: z.string().optional(),
    placeholder: z.string().optional(),
    ref: z.string().optional(),
    cursor: z.string().optional(),
    box: BoxSchema.optional(),
  }),
);

/**
 * The page tree root: the top-level accessibility nodes reported for the
 * page. An empty page reports zero top-level nodes (children: []) — never
 * a throw, and never a synthesized root node.
 */
export const PageTreeSchema = z.object({
  children: z.array(SnapshotNodeSchema).default([]),
});

export type PageTree = z.infer<typeof PageTreeSchema>;
