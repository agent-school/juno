import pino from 'pino';
import type { Page } from 'playwright';
import { SnapshotParseError } from './errors.js';
import { parseAriaYaml } from './parse-yaml.js';
import { PageTreeSchema, type PageTree } from './snapshot-schema.js';
import { redactUrlForLogs } from './url.js';

const logger = pino({
  name: 'juno.browser',
  level: process.env.JUNO_LOG_LEVEL ?? 'info',
});

/**
 * SemanticPageReader — the perception pipeline.
 *
 * The ONLY way Juno sees a page: capture the accessibility tree
 * (`ariaSnapshot({ mode: 'ai', boxes: true })`), parse the YAML behind the
 * single parse boundary (parseAriaYaml), and validate it through the zod
 * PageTreeSchema data fence. Malformed or hostile snapshot output is
 * rejected as SnapshotParseError — never partially trusted.
 *
 * Logs carry the page URL and node counts only — never snapshot text
 * (threat T-1-06).
 */
export class SemanticPageReader {
  async read(page: Page): Promise<PageTree> {
    const capture = await page.ariaSnapshot({ mode: 'ai', boxes: true });
    const unvalidated: unknown = parseAriaYaml(capture);

    const result = PageTreeSchema.safeParse(unvalidated);
    if (!result.success) {
      throw new SnapshotParseError('aria snapshot failed schema validation', {
        issues: result.error.issues,
      });
    }

    logger.info(
      {
        event: 'reader.read',
        url: redactUrlForLogs(page.url()),
        nodes: countNodes(result.data),
      },
      'page read into validated semantic tree',
    );
    return result.data;
  }
}

function countNodes(tree: PageTree): number {
  let count = 0;
  const stack = [...tree.children];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      break;
    }
    count += 1;
    stack.push(...node.children);
  }
  return count;
}
