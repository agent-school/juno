import { expect, it, vi } from 'vitest';
import { createGuardedActor, SafetyBlocked, type AuditEntry } from '../../src/guard.js';

const ref = { role: 'button', name: 'Delete account' };
it.each(['?mode=delete', '#different-record', '?', '#'])('does not inherit benign authority on URL suffix %s', async suffix => {
  const click = vi.fn(), page = { url: () => `https://example.test/account${suffix}`, getByRole: () => ({ click }) };
  const { actor } = createGuardedActor(page as any, { benignPolicies: [{ id: 'exact-page', origin: 'https://example.test', pathname: '/account', method: 'click', ref }], audit: async () => {} });
  await expect(actor.click(ref)).rejects.toThrow('confirmation');
  expect(click).not.toHaveBeenCalled();
});
it('allows only an explicitly reviewed exact query and fragment', async () => {
  const click = vi.fn(async () => {});
  let url = 'https://example.test/account?record=reviewed#tab';
  const page = { url: () => url, getByRole: () => ({ click }) };
  const { actor } = createGuardedActor(page as any, { benignPolicies: [{ id: 'reviewed-record', origin: 'https://example.test', pathname: '/account', search: '?record=reviewed', hash: '#tab', method: 'click', ref }], audit: async () => {} });
  await actor.click(ref);
  url = 'https://example.test/account?record=another#tab';
  await expect(actor.click(ref)).rejects.toThrow('confirmation');
  expect(click).toHaveBeenCalledOnce();
});
function harness(mode: 'execute' | 'read-only' = 'execute') {
  const click = vi.fn().mockResolvedValue(undefined), fill = vi.fn().mockResolvedValue(undefined), setChecked = vi.fn().mockResolvedValue(undefined);
  const page = { url: () => 'https://example.test/account', getByRole: () => ({ click, fill, setChecked }), close: vi.fn().mockResolvedValue(undefined) };
  const audit: AuditEntry[] = [];
  const boundary = createGuardedActor(page as any, { mode, audit: async entry => { audit.push(entry); } });
  return { ...boundary, page, click, fill, setChecked, audit };
}
async function pendingId(work: () => Promise<unknown>) {
  try { await work(); throw new Error('should be blocked'); }
  catch (error) { expect(error).toBeInstanceOf(SafetyBlocked); return (error as SafetyBlocked).pendingId!; }
}
it('defaults to destructive, requires explicit one-shot request-bound confirmation', async () => {
  const h = harness();
  const pending = await pendingId(() => h.actor.click(ref));
  expect(h.click).not.toHaveBeenCalled();
  const token = h.control.confirm(pending);
  await h.actor.click(ref, token);
  expect(h.click).toHaveBeenCalledTimes(1);
  await expect(h.actor.click(ref, token)).rejects.toThrow('confirmation');
  expect(h.click).toHaveBeenCalledTimes(1);
  expect(h.audit.map(item => item.status)).toEqual(['blocked', 'started', 'completed', 'blocked']);
});
it('binds approval to exact inputs, target and site; never stores input values', async () => {
  const h = harness();
  const field = { role: 'textbox', name: 'Secret field' };
  const pending = await pendingId(() => h.actor.fill(field, 'private input'));
  const token = h.control.confirm(pending);
  await expect(h.actor.fill(field, 'different input', token)).rejects.toThrow('confirmation');
  expect(h.fill).not.toHaveBeenCalled();
  expect(JSON.stringify(h.audit)).not.toContain('private input');
  expect(JSON.stringify(h.audit)).not.toContain('Secret field');
});
it('binds checkbox confirmation to the desired boolean state and consumes mismatched approval', async () => {
  const h = harness(), checkbox = { role: 'checkbox', name: 'Subscribed' };
  const token = h.control.confirm(await pendingId(() => h.actor.check(checkbox, false)));
  await expect(h.actor.check(checkbox, true, token)).rejects.toThrow('confirmation');
  await expect(h.actor.check(checkbox, false, token)).rejects.toThrow('confirmation');
  expect(h.setChecked).not.toHaveBeenCalled();
  const matching = h.control.confirm(await pendingId(() => h.actor.check(checkbox, false)));
  await h.actor.check(checkbox, false, matching);
  expect(h.setChecked).toHaveBeenCalledWith(false, { timeout: 2500 });
  await expect(h.actor.check(checkbox, false, matching)).rejects.toThrow('confirmation');
  expect(h.setChecked).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(h.audit)).not.toContain('Subscribed');
  expect(h.audit.map(item => item.status)).toEqual(['blocked', 'blocked', 'blocked', 'blocked', 'started', 'completed', 'blocked']);
});
it('rejects non-boolean checkbox inputs even for a trusted benign target', async () => {
  const h = harness(), checkbox = { role: 'checkbox', name: 'Subscribed' };
  const { actor } = createGuardedActor(h.page as any, { benignPolicies: [
    { id: 'checkbox', origin: 'https://example.test', pathname: '/account', method: 'check', ref: checkbox },
  ], audit: async () => {} });
  for (const input of ['false', 0, null]) await expect(actor.check(checkbox, input as any)).rejects.toThrow('boolean');
  expect(h.setChecked).not.toHaveBeenCalled();
});
it('blocks both checkbox states during read-only exploration', async () => {
  const h = harness('read-only'), checkbox = { role: 'checkbox', name: 'Subscribed' };
  await expect(h.actor.check(checkbox, true)).rejects.toThrow('Read-only');
  await expect(h.actor.check(checkbox, false)).rejects.toThrow('Read-only');
  expect(h.setChecked).not.toHaveBeenCalled();
});
it('refuses all mutations in read-only mode even after attempted confirmation', async () => {
  const h = harness('read-only');
  await expect(h.actor.click(ref)).rejects.toThrow('Read-only');
  expect(h.click).not.toHaveBeenCalled();
});
it('does not accept page-supplied benign risk labels or broad/ephemeral refs', async () => {
  const h = harness();
  await expect(h.actor.click({ ...ref, risk: 'write-benign' } as any)).rejects.toThrow();
  await expect(h.actor.click({ ...ref, exact: false })).rejects.toThrow();
  await expect(h.actor.click({ ...ref, ref: 'e16' } as any)).rejects.toThrow();
  expect(h.click).not.toHaveBeenCalled();
});
it('fails closed when audit persistence fails', async () => {
  const h = harness();
  const guarded = createGuardedActor(h.page as any, { benignPolicies: [{ id: 'owned-test', origin: 'https://example.test', pathname: '/account', method: 'click', ref }], audit: async () => { throw new Error('disk full'); } });
  await expect(guarded.actor.click(ref)).rejects.toThrow('disk full');
  expect(h.click).not.toHaveBeenCalled();
});
it('stops future actions and closes the controlled page on abort', async () => {
  const h = harness();
  await h.control.abort();
  await expect(h.actor.click(ref)).rejects.toThrow('aborted');
  expect(h.page.close).toHaveBeenCalled(); expect(h.click).not.toHaveBeenCalled();
});

it('refuses a changed target/site and consumes the mismatched grant', async () => {
  const h = harness();
  const pending = await pendingId(() => h.actor.click(ref));
  const token = h.control.confirm(pending);
  h.page.url = () => 'https://example.test/other';
  await expect(h.actor.click(ref, token)).rejects.toThrow('confirmation');
  h.page.url = () => 'https://example.test/account';
  await expect(h.actor.click(ref, token)).rejects.toThrow('confirmation');
  expect(h.click).not.toHaveBeenCalled();
});

it('expires approvals and does not allow re-confirming the pending request', async () => {
  vi.useFakeTimers();
  try {
    const h = harness(), pending = await pendingId(() => h.actor.click(ref));
    const token = h.control.confirm(pending);
    expect(() => h.control.confirm(pending)).toThrow('consumed');
    vi.advanceTimersByTime(60_001);
    await expect(h.actor.click(ref, token)).rejects.toThrow('confirmation');
    expect(h.click).not.toHaveBeenCalled();
  } finally { vi.useRealTimers(); }
});

it('stops before an action when aborted while its durable audit intent is being written', async () => {
  const h = harness();
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const guarded = createGuardedActor(h.page as any, { benignPolicies: [{ id: 'owned', origin: 'https://example.test', pathname: '/account', method: 'click', ref }], audit: async entry => {
    h.audit.push(entry); if (entry.status === 'started') await barrier;
  } });
  const action = guarded.actor.click(ref);
  await expect(guarded.actor.click(ref)).rejects.toThrow('Concurrent');
  await guarded.control.abort(); release();
  await expect(action).rejects.toThrow('aborted');
  expect(h.click).not.toHaveBeenCalled();
  expect(h.audit.at(-1)?.status).toBe('aborted');
});

it('still blocks a trusted benign target during read-only exploration', async () => {
  const h = harness();
  const guarded = createGuardedActor(h.page as any, { mode: 'read-only', benignPolicies: [{ id: 'owned', origin: 'https://example.test', pathname: '/account', method: 'click', ref }], audit: async () => {} });
  await expect(guarded.actor.click(ref)).rejects.toThrow('Read-only');
  expect(h.click).not.toHaveBeenCalled();
});
