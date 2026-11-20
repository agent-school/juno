import { chromium, type Browser, type Page } from 'playwright';
import { CdpError, waitForCdp, type CdpReadinessOptions } from './cdp-readiness.js';

/** Attaches to a browser explicitly owned by the launcher; never launches or kills host processes. */
export class HostChromeSession {
  private browser: Browser | null = null;
  private currentPage: Page | null = null;
  private attaching = false;
  constructor(private readonly options: CdpReadinessOptions) {}
  get page() { return this.currentPage; }
  get isRunning() { return !!this.browser?.isConnected(); }

  async attach(): Promise<Page> {
    if (this.browser || this.attaching) throw new CdpError('attach', 'already attached or attaching');
    this.attaching = true;
    try {
      const metadata = await waitForCdp(this.options);
      try {
        this.browser = await chromium.connectOverCDP(metadata.websocket, {
          isLocal: false, headers: { Host: 'localhost' }, timeout: this.options.timeoutMs ?? 10_000,
        });
      } catch { throw new CdpError('attach', 'connection failed after validated readiness'); }
      const context = this.browser.contexts()[0];
      if (!context) throw new CdpError('context', 'host browser has no default context');
      try { this.currentPage = context.pages()[0] ?? await context.newPage(); }
      catch { throw new CdpError('context', 'could not acquire a host page'); }
      return this.currentPage;
    } catch (error) {
      await this.close();
      throw error;
    } finally { this.attaching = false; }
  }

  /** Playwright Browser.close on a CDP connection disconnects this client; Chrome stays host-owned. */
  async close(): Promise<void> {
    if (!this.browser) return;
    try { await this.browser.close(); }
    catch { throw new CdpError('attach', 'client disconnect failed; host Chrome remains externally owned'); }
    this.browser = null;
    this.currentPage = null;
  }
}
