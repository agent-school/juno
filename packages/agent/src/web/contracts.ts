import { z } from 'zod';

export const WebTaskInputSchema = z.object({
  goal: z.string().trim().min(8).max(2000),
  urls: z.array(z.url().max(2000)).max(5).default([]),
  mode: z.enum(['agent', 'evidence']).default('agent'),
  parentId: z.uuid().optional(),
}).strict().refine(input => input.mode !== 'evidence' || input.urls.length > 0, { path: ['urls'], message: 'Supply at least one starting URL for source evidence collection.' });
export type WebTaskInput = z.infer<typeof WebTaskInputSchema>;
export const CitationSchema = z.object({ pageId: z.string().regex(/^p\d+$/), quote: z.string().min(15).max(600) }).strict();
export const WebDecisionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('search'), query: z.string().trim().min(2).max(300), reason: z.string().min(1).max(300) }).strict(),
  z.object({ action: z.literal('open'), url: z.url().max(2000), reason: z.string().min(1).max(300) }).strict(),
  z.object({ action: z.literal('follow'), pageId: z.string(), linkId: z.string(), reason: z.string().min(1).max(300) }).strict(),
  z.object({ action: z.literal('read'), pageId: z.string(), offset: z.number().int().min(0).max(32000) }).strict(),
  z.object({ action: z.literal('finish'), answer: z.string().min(1).max(8000), citations: z.array(CitationSchema).min(1).max(20),
    rows: z.array(z.object({ label: z.string().min(1).max(100), value: z.string().min(1).max(500), pageId: z.string(), quote: z.string().min(15).max(600) }).strict()).max(40).default([]),
  }).strict(),
  z.object({ action: z.literal('blocked'), reason: z.string().min(1).max(600) }).strict(),
]);
export type WebDecision = z.infer<typeof WebDecisionSchema>;
export const WebPageSchema = z.object({
  id: z.string().regex(/^p\d+$/), url: z.url(), title: z.string().max(500), observedAt: z.iso.datetime(),
  text: z.string().max(32000), hash: z.string().length(64),
  links: z.array(z.object({ id: z.string(), name: z.string().max(300), url: z.url() })).max(80),
  memory: z.object({ origin: z.string(), version: z.uuid(), reused: z.boolean() }).optional(),
});
export type WebPage = z.infer<typeof WebPageSchema>;
export const WebTaskSchema = z.object({
  schemaVersion: z.literal(1), id: z.uuid(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(), input: WebTaskInputSchema,
  status: z.enum(['ready', 'running', 'answered', 'evidence', 'blocked', 'failed', 'stopped', 'interrupted']),
  pages: z.array(WebPageSchema).max(10),
  events: z.array(z.object({ at: z.iso.datetime(), kind: z.enum(['started', 'opening', 'observed', 'memory', 'model', 'blocked', 'finished', 'stopped', 'error']), message: z.string().max(1000) })).max(100),
  answer: z.string().max(8000).optional(), citations: z.array(CitationSchema).max(20).default([]),
  rows: z.array(z.object({ label: z.string(), value: z.string(), pageId: z.string(), quote: z.string() })).max(40).default([]),
  error: z.string().max(600).optional(), modelCalls: z.number().int().min(0).max(12).default(0),
});
export type WebTask = z.infer<typeof WebTaskSchema>;

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
export class AnswerValidationError extends Error {}
/** Ground evidence in an actual observation; the model cannot mint source quotes or extracted values. */
export function validateAnswer(decision: Extract<WebDecision, { action: 'finish' }>, pages: WebPage[]) {
  const grounded = (pageId: string, quote: string) => {
    const page = pages.find(page => page.id === pageId);
    return page && normalize(page.text).includes(normalize(quote));
  };
  if (decision.citations.some(citation => !grounded(citation.pageId, citation.quote))) throw new AnswerValidationError('The answer cited text that was not observed. No answer was accepted.');
  if (decision.rows.some(row => !grounded(row.pageId, row.quote) || !normalize(row.quote).includes(normalize(row.value)))) throw new AnswerValidationError('An extracted value was not present in its source quote. No answer was accepted.');
  return decision;
}
