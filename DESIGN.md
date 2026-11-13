# Juno interface

Juno's current web product is a research desk for Jack and early evaluators: find public projects, keep a sourced shortlist, and return to compare changes. The separate Browser lab is an experiment toward the semantic website compiler. Neither surface should suggest that a general chat agent or arbitrary-site compiler is already available.

## Character and hierarchy

Observant, exact, composed. Start with the work: a compact composer, source results, recent tasks and nearby memory. Give the content room. Use rules and spacing to group documents; reserve enclosed surfaces for inputs, settings and the sandbox. Metadata supports the decision rather than becoming a wall of badges. Empty states explain the next action without inventing results.

## Typography

- Public Sans, locally hosted, is the reading and control face (400–700).
- Sora, locally hosted, is limited to the Juno wordmark and page headings (500–600).
- UI scale: 12px metadata, 14px controls/body, 16px reading text, 20px section headings, 28px page headings. Use rem units and readable line heights. Code uses the platform monospace stack only inside actual code/JSON.
- No italic display headlines, uppercase paragraphs or tracking used to make small labels look decorative.

## Color, spacing and interaction

Neutral white work surfaces, cool gray navigation, dark ink and muted blue primary actions. Semantic tokens live in `app.css`: `--ink`, `--muted`, `--line`, `--canvas`, `--surface`, `--nav`, `--accent`, `--positive`, `--negative`, `--warning` and their soft surfaces. Status always has text as well as color. Blue means navigation, selection, focus or an action; it is not decoration.

Spacing follows 4/8/12/16/24/32/48px. Corners use 4/6/8px. No gradients, glass, decorative shadows or repeating ornamental grids. Focus rings are visible on every control; mobile controls are at least 44px tall. Navigation and history adapt into a compact top area on narrow screens. Respect reduced motion.

Task receipts and source details use native disclosures. Unchanged polling snapshots keep source disclosures and draft recipe names in the DOM. Only explicit save actions change memory. Forgetting and refresh retain the documented server semantics.

## Reference

This direction applies [Impeccable's slop catalog](https://impeccable.style/slop/) to Juno's actual work rather than adopting a preset aesthetic. See the GSD quick task for the critique, acceptance criteria and verification limits. Font licenses are included beside the local font assets.
