import { describe, expect, it } from 'vitest';
import { publicAddress, publicUrl, resolvePublic } from '../../src/web/network.js';
import { WebDecisionSchema, WebTaskInputSchema, validateAnswer, type WebPage } from '../../src/web/contracts.js';

describe('public browser network boundary', () => {
  it('rejects private, reserved, metadata, mapped and special-purpose ranges', () => {
    for (const address of ['127.0.0.1', '0.0.0.0', '10.0.0.1', '172.16.0.1', '192.168.0.1', '169.254.169.254', '100.100.100.200', '224.0.0.1', '255.255.255.255', '192.0.2.1', '198.18.0.1', '::1', '::', '::ffff:127.0.0.1', '::ffff:10.0.0.1', 'fc00::1', 'fe80::1', '2001:db8::1', '64:ff9b::7f00:1', '2002:7f00:1::']) expect(publicAddress(address), address).toBe(false);
    for (const address of ['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111']) expect(publicAddress(address), address).toBe(true);
  });
  it('canonicalizes public URLs and refuses credentials, custom ports, encoded local IPs and action URLs', () => {
    expect(publicUrl('https://example.com/docs?q=browser#section').href).toBe('https://example.com/docs?q=browser');
    for (const url of ['http://example.com', 'https://user:pass@example.com', 'file:///etc/passwd', 'https://example.com:8000', 'https://localhost', 'https://foo.local', 'https://2130706433', 'https://0x7f000001', 'https://[::ffff:127.0.0.1]', 'https://example.com/?token=abc', 'https://example.com/?action=delete', 'https://example.com/%64elete/item', 'https://example.com./']) expect(() => publicUrl(url), url).toThrow();
  });
  it('checks EVERY DNS result and returns the exact public socket address instead of resolving again', async () => {
    const url = publicUrl('https://example.com');
    await expect(resolvePublic(url, async () => [{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }])).rejects.toThrow('non-public');
    await expect(resolvePublic(url, async () => [{ address: '::ffff:169.254.169.254', family: 6 }])).rejects.toThrow('non-public');
    await expect(resolvePublic(url, async () => [])).rejects.toThrow('non-public');
    expect(await resolvePublic(url, async () => [{ address: '8.8.8.8', family: 4 }])).toEqual({ address: '8.8.8.8', family: 4 });
  });
});

describe('general task and answer boundary', () => {
  const pages = [{ id: 'p1', text: 'The Current release is recommended for testing.\nThe LTS release is recommended for production.' }] as WebPage[];
  const answer = { action: 'finish' as const, answer: 'Use LTS for production [p1].', citations: [{ pageId: 'p1', quote: 'The LTS release is recommended for production.' }], rows: [{ label: 'Production', value: 'LTS', pageId: 'p1', quote: 'The LTS release is recommended for production.' }] };
  it('requires actual source quotes and values while accepting whitespace normalization', () => {
    expect(validateAnswer(answer, pages)).toEqual(answer);
    expect(validateAnswer({ ...answer, citations: [{ pageId: 'p1', quote: 'testing. The LTS release' }] }, pages)).toBeDefined();
    expect(() => validateAnswer({ ...answer, citations: [{ pageId: 'p2', quote: answer.citations[0]!.quote }] }, pages)).toThrow('not observed');
    expect(() => validateAnswer({ ...answer, citations: [{ pageId: 'p1', quote: 'This source never said these words.' }] }, pages)).toThrow('not observed');
    expect(() => validateAnswer({ ...answer, rows: [{ ...answer.rows[0]!, value: 'Current' }] }, pages)).toThrow('not present');
  });
  it('allows general goals but rejects arbitrary browser tools, code, authority and host test boundaries', () => {
    expect(WebTaskInputSchema.parse({ goal: 'Compare the pricing of these tools', urls: ['https://example.com'] }).mode).toBe('agent');
    expect(WebTaskInputSchema.parse({ goal: 'Find the official documentation for virtual environments' }).urls).toEqual([]);
    expect(() => WebTaskInputSchema.parse({ goal: 'Collect source evidence', mode: 'evidence' })).toThrow('starting URL');
    for (const key of ['apiKey', 'testOrigins', 'selector', 'operations', 'permissions']) expect(() => WebTaskInputSchema.parse({ goal: 'Find the admission requirements', urls: ['https://example.com'], [key]: ['http://127.0.0.1'] })).toThrow();
    for (const action of ['click', 'fill', 'evaluate', 'submit', 'execute']) expect(() => WebDecisionSchema.parse({ action, selector: '#send' })).toThrow();
    expect(() => WebDecisionSchema.parse({ action: 'open', url: 'https://example.com', reason: 'Read', permissions: ['write'] })).toThrow();
  });
});
