/**
 * Juno Phase 1 demo — run with:  pnpm demo
 *
 * Opens a real Chrome window, loads the local fixture page, lets Juno
 * "read" it (accessibility tree) and "act" on it (click by semantic ref),
 * then prints what Juno saw. Watch the browser window while it runs.
 */
import { BrowserSession, SemanticPageReader, SemanticActor } from './packages/browser/src/index.js';

const FIXTURE = 'http://127.0.0.1:8931/';

async function main() {
  const session = new BrowserSession({
    headless: process.env.JUNO_DEMO_HEADLESS === 'true' ? true : false, // visible Chrome by default
  });
  const page = await session.launch();
  await session.goto(FIXTURE);

  // 1. PERCEIVE: read the page's semantic structure (roles, names, states)
  const tree = await new SemanticPageReader().read(page);
  console.log('\n=== What Juno sees (semantic tree, first 3 levels) ===\n');
  const lines: string[] = [];
  const walk = (nodes: typeof tree.children, depth: number) => {
    for (const n of nodes.slice(0, depth === 0 ? 8 : 3)) {
      const bits = [n.role];
      if (n.name) bits.push(`"${n.name}"`);
      if (n.selected) bits.push('[selected]');
      if (n.checked) bits.push('[checked]');
      if (n.ref) bits.push(`(ref ${n.ref})`);
      lines.push('  '.repeat(depth) + '- ' + bits.join(' '));
      if (n.children.length) walk(n.children, depth + 1);
    }
  };
  walk(tree.children, 0);
  console.log(lines.join('\n'));

  // 2. ACT: fill the textbox and click the button BY SEMANTIC REFERENCE
  const actor = new SemanticActor(page);
  await actor.fill({ role: 'textbox', name: 'Task name' }, 'hello from Juno');
  await actor.click({ role: 'button', name: 'Add task' });

  // 3. Verify the effect
  const after = await new SemanticPageReader().read(page);
  const all: typeof after.children = [];
  const collect = (nodes: typeof after.children) => {
    for (const n of nodes) {
      all.push(n);
      collect(n.children);
    }
  };
  collect(after.children);
  const item = all.find((n) => n.role === 'listitem');
  console.log(`\n=== After acting ===\nJuno typed + clicked; page now shows list item: "${item?.name ?? item?.text}"`);
  console.log('\nDone. Closing browser.');

  await session.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
