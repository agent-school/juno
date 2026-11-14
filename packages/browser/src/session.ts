import os from 'node:os';
import path from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { z } from 'zod';
import pino from 'pino';
import { InvalidUrlError, ProfileInUseError } from './errors.js';
import { assertDedicatedProfileDir, resolveProfileDir } from './profile.js';
import { redactUrlForLogs } from './url.js';

const logger = pino({
  name: 'juno.browser',
  level: process.env.JUNO_LOG_LEVEL ?? 'info',
});

/**
 * URL validation at the session boundary (threat T-1-01).
 *
 * Scheme allowlist is exactly http/https; everything else — including
 * `javascript:`, `data:`, and `file:` (script execution / local file read)
 * — is rejected with InvalidUrlError BEFORE any page.goto call.
 */
const AllowedUrlSchema = z
  .string({ message: 'URL must be a string' })
  .trim()
  .min(1, 'URL must not be empty')
  .superRefine((value, ctx) => {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: `Not a valid absolute URL: ${JSON.stringify(value)}`,
      });
      return;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      ctx.addIssue({
        code: 'custom',
        message: `URL scheme "${parsed.protocol.replace(/:$/, '')}" is not allowed — only http and https are accepted`,
      });
    }
    if (parsed.hostname === '') {
      ctx.addIssue({ code: 'custom', message: 'URL must include a hostname' });
    }
  });

export function validateUrl(raw: string): URL {
  const result = AllowedUrlSchema.safeParse(raw);
  if (!result.success) {
    throw new InvalidUrlError(
      result.error.issues.map((issue) => issue.message).join('; '),
    );
  }
  return new URL(result.data);
}

export interface BrowserSessionOptions {
  /** Dedicated persistent profile directory (userDataDir). Never the user's daily-driver Chrome profile. */
  profileDir?: string;
  /** Defaults to false (headed) — anti-bot posture per project doctrine. */
  headless?: boolean;
  /** 'chrome' (system Google Chrome, default) or 'chromium' (Playwright's bundled build). */
  channel?: 'chrome' | 'chromium';
  /** Block for untrusted agent pages so context request interception covers all resources. */
  serviceWorkers?: 'allow' | 'block';
}

/**
 * BrowserSession — facade over chromium.launchPersistentContext.
 *
 * One session owns one dedicated persistent profile directory. The profile
 * carries the user's real login state (cookies/localStorage) and is treated
 * as sensitive data at rest: nothing in this module ever reads or logs its
 * contents.
 */
export class BrowserSession {
  private readonly profileDirOverride: string | undefined;
  private readonly headless: boolean;
  private readonly channel: 'chrome' | 'chromium';
  private readonly serviceWorkers: 'allow' | 'block';

  private context: BrowserContext | null = null;
  private _page: Page | null = null;

  constructor(options: BrowserSessionOptions = {}) {
    this.profileDirOverride = options.profileDir;
    this.headless = options.headless ?? false;
    this.channel = options.channel ?? 'chrome';
    this.serviceWorkers = options.serviceWorkers ?? 'allow';
  }

  /** The live page of this session. Null before launch() / after close(). */
  get page(): Page | null {
    return this._page;
  }

  /** True while the session holds a browser context. */
  get isRunning(): boolean {
    return this.context !== null;
  }

  /**
   * Launch the persistent browser context and acquire the session page.
   *
   * The profile directory is Juno's dedicated dir (resolveProfileDir, with
   * JUNO_PROFILE_DIR env override) unless an explicit dir was provided.
   *
   * Throws ProfileInUseError when the profile directory is already locked
   * by another Chromium process (ProcessSingleton) — raw Playwright errors
   * never escape for this condition.
   */
  async launch(): Promise<Page> {
    if (this.context) {
      throw new Error('BrowserSession is already launched; call close() first.');
    }
    const profileDir = this.profileDirOverride ?? resolveProfileDir();
    // CR-03: the "dedicated Juno profile only" rule is enforced, not just
    // documented — reject daily-driver Chrome profile paths before launch.
    assertDedicatedProfileDir(profileDir);
    try {
      this.context = await chromium.launchPersistentContext(profileDir, {
        ...(this.channel === 'chrome' ? { channel: 'chrome' } : {}),
        headless: this.headless,
        serviceWorkers: this.serviceWorkers,
      });
    } catch (error) {
      // Chrome's profile lock: a second Chromium process on the same
      // userDataDir cannot create the ProcessSingleton. Surface a typed,
      // user-facing error instead of a raw Playwright failure.
      if (
        error instanceof Error &&
        error.message.includes('Failed to create a ProcessSingleton')
      ) {
        throw new ProfileInUseError('Juno is already running with this profile.');
      }
      throw error;
    }
    this._page = this.context.pages()[0] ?? (await this.context.newPage());
    logger.info(
      {
        event: 'session.launch',
        channel: this.channel,
        headless: this.headless,
        profile: path.basename(profileDir),
      },
      'persistent browser session launched',
    );
    return this._page;
  }

  /**
   * Navigate the session page to a URL. The URL is zod-validated at this
   * boundary (http/https + hostname required) before any navigation happens.
   */
  async goto(rawUrl: string): Promise<Page> {
    const page = this.requirePage();
    const url = validateUrl(rawUrl);
    await page.goto(url.toString(), { waitUntil: 'load' });
    logger.info(
      { event: 'session.goto', url: redactUrlForLogs(url.toString()) },
      'navigated',
    );
    return page;
  }

  /** Close the browser context (releases the profile lock). Safe to call twice. */
  async close(): Promise<void> {
    if (!this.context) {
      return;
    }
    const context = this.context;
    // WR-01: only report closed after the context actually closed — if
    // close() throws, Chromium may still hold the profile lock and a retry
    // must remain possible.
    await context.close();
    this.context = null;
    this._page = null;
    logger.info({ event: 'session.close' }, 'browser session closed');
  }

  private requirePage(): Page {
    if (!this._page) {
      throw new Error('BrowserSession is not launched; call launch() first.');
    }
    return this._page;
  }
}
