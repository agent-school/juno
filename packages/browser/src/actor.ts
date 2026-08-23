import pino from 'pino';
import type { Locator, Page } from 'playwright';
import { SemanticPageReader } from './reader.js';
import {
  describeRef,
  resolveEphemeralRef,
  resolveSemanticRef,
  toGroundingError,
  validateFresh,
} from './refs.js';
import type { AnyRef } from './refs.js';

const logger = pino({
  name: 'juno.browser',
  level: process.env.JUNO_LOG_LEVEL ?? 'info',
});

export interface SemanticActorOptions {
  /** Per-action timeout in ms. Playwright's default applies when omitted. */
  timeoutMs?: number;
}

/**
 * SemanticActor — the fail-safe action surface (BRWS-03).
 *
 * Every interaction (click, fill, selectOption, check, scrollIntoView,
 * scrollViewport) goes through the two-layer reference model:
 * - SemanticRef: strict getByRole locator, exact match, scope-chain-only
 *   disambiguation
 * - EphemeralRef: identity re-validated against a fresh snapshot BEFORE the
 *   locator resolves (stale refs are untrusted — Pattern 3 rule 3)
 *
 * All actions let Playwright auto-wait (no manual sleeps); every await is
 * wrapped in toGroundingError so raw Playwright errors never escape the
 * public API. Logs carry semantic ref descriptions only — never eN ids
 * (T-1-09).
 */
export class SemanticActor {
  private readonly reader: SemanticPageReader;
  private readonly timeoutMs: number | undefined;

  constructor(
    private readonly page: Page,
    reader?: SemanticPageReader,
    options: SemanticActorOptions = {},
  ) {
    this.reader = reader ?? new SemanticPageReader();
    this.timeoutMs = options.timeoutMs;
  }

  async click(ref: AnyRef): Promise<void> {
    await this.act('click', ref, (locator) => locator.click(this.actionOptions()));
  }

  async fill(ref: AnyRef, text: string): Promise<void> {
    await this.act('fill', ref, (locator) =>
      locator.fill(text, this.actionOptions()),
    );
  }

  async selectOption(ref: AnyRef, value: string): Promise<void> {
    await this.act('selectOption', ref, (locator) =>
      locator.selectOption(value, this.actionOptions()),
    );
  }

  async check(ref: AnyRef): Promise<void> {
    await this.act('check', ref, (locator) => locator.check(this.actionOptions()));
  }

  async scrollIntoView(ref: AnyRef): Promise<void> {
    await this.act('scrollIntoView', ref, (locator) =>
      locator.scrollIntoViewIfNeeded(this.actionOptions()),
    );
  }

  /** Viewport-level wheel scroll (positive amount = towards document end). */
  async scrollViewport(direction: 'up' | 'down', amount: number): Promise<void> {
    const delta = direction === 'down' ? amount : -amount;
    try {
      await this.page.mouse.wheel(0, delta);
    } catch (error) {
      throw toGroundingError(error, `viewport scroll ${direction} ${amount}px`);
    }
    logger.info(
      { event: 'actor.action', method: 'scrollViewport', direction, amount },
      'viewport scrolled',
    );
  }

  private async act(
    method: string,
    ref: AnyRef,
    perform: (locator: Locator) => Promise<unknown>,
  ): Promise<void> {
    const description = describeRef(ref);
    try {
      const locator = await this.resolve(ref);
      await perform(locator);
    } catch (error) {
      throw toGroundingError(error, description);
    }
    logger.info(
      { event: 'actor.action', method, ref: description },
      'action performed by semantic reference',
    );
  }

  private async resolve(ref: AnyRef): Promise<Locator> {
    if ('ref' in ref) {
      // Ephemeral refs are untrusted: validate identity against a snapshot
      // taken within this call before resolving.
      const tree = await this.reader.read(this.page);
      validateFresh(tree, { ref: ref.ref, role: ref.role, name: ref.name });
      return resolveEphemeralRef(this.page, ref);
    }
    return resolveSemanticRef(this.page, ref);
  }

  private actionOptions(): { timeout?: number } {
    return this.timeoutMs === undefined ? {} : { timeout: this.timeoutMs };
  }
}
