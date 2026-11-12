import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';

const derive = promisify(scrypt);
export const CredentialsSchema = z.object({ handle: z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{3,32}$/), passphrase: z.string().min(12).max(128) }).strict();
const AccountSchema = z.object({ handle: z.string().regex(/^[a-z0-9_-]{3,32}$/), owner: z.string().regex(/^[a-f0-9]{64}$/), salt: z.string().regex(/^[a-f0-9]{32}$/), hash: z.string().regex(/^[a-f0-9]{128}$/) });
type Account = z.infer<typeof AccountSchema>;

/** Credentials never join the workspace store/export; no profile or secret is shared with research sources. */
export class Accounts {
  private directory: string;
  private accounts = new Map<string, Account>();
  private attempts: number[] = [];
  constructor(directory: string) {
    this.directory = path.join(directory, 'accounts');
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    for (const file of fs.readdirSync(this.directory)) {
      if (!/^[a-z0-9_-]{3,32}\.json$/.test(file)) continue;
      const account = AccountSchema.parse(JSON.parse(fs.readFileSync(path.join(this.directory, file), 'utf8')));
      this.accounts.set(account.handle, account);
    }
  }
  handle(owner: string): string | null { return [...this.accounts.values()].find(item => item.owner === owner)?.handle ?? null; }
  private limit(): void {
    const now = Date.now(); this.attempts = this.attempts.filter(at => now - at < 60_000);
    if (this.attempts.length >= 20) throw new Error('Too many workspace login attempts. Wait one minute.');
    this.attempts.push(now);
  }
  async register(owner: string, input: z.infer<typeof CredentialsSchema>): Promise<void> {
    this.limit();
    if (this.accounts.size >= 100) throw new Error('Workspace account limit reached.');
    const salt = randomBytes(16).toString('hex');
    const hash = (await derive(input.passphrase, salt, 64) as Buffer).toString('hex');
    // Check after the async KDF too, so concurrent registrations cannot claim a handle/owner twice.
    if (this.accounts.has(input.handle) || this.handle(owner) || this.accounts.size >= 100) throw new Error('Workspace name unavailable or this browser already has a protected workspace.');
    const account = { handle: input.handle, owner, salt, hash };
    fs.writeFileSync(path.join(this.directory, `${input.handle}.json`), JSON.stringify(account), { mode: 0o600, flag: 'wx' });
    this.accounts.set(input.handle, account);
  }
  async login(input: z.infer<typeof CredentialsSchema>): Promise<string> {
    this.limit();
    const account = this.accounts.get(input.handle);
    const hash = await derive(input.passphrase, account?.salt ?? '0'.repeat(32), 64) as Buffer;
    if (!account || !timingSafeEqual(hash, Buffer.from(account.hash, 'hex'))) throw new Error('Workspace name or passphrase did not match.');
    return account.owner;
  }
}
