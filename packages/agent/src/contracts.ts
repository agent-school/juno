import { createHash } from 'node:crypto';
import { z } from 'zod';

const id = z.string().regex(/^[a-zA-Z0-9_.-]{1,100}$/);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** An interpretation boundary: a planner proposes typed operations, never raw browser actions. */
export const TaskPlanSchema = z.object({
  schemaVersion: z.literal(1), id: z.uuid(), modelVersion: z.uuid(),
  steps: z.array(z.object({
    id, operation: id,
    inputs: z.record(z.string().regex(/^[a-z][a-z0-9_]{0,63}$/), z.union([z.string().max(50_000), z.boolean()])),
  }).strict()).min(1).max(20),
}).strict().refine(plan => new Set(plan.steps.map(step => step.id)).size === plan.steps.length, 'Task step IDs must be unique');
export type TaskPlan = z.infer<typeof TaskPlanSchema>;

export const EffectObservationSchema = z.object({
  status: z.enum(['matched', 'absent', 'conflict', 'unknown']),
  source: id, key: digest, recordCount: z.number().int().min(0).max(1000),
  matchedFields: z.array(id).max(100),
}).strict();
export type EffectObservation = z.infer<typeof EffectObservationSchema>;

const audit = z.object({
  id: z.uuid(), runId: z.string(), at: z.iso.datetime(),
  method: z.enum(['read', 'click', 'fill', 'selectOption', 'check', 'scrollIntoView', 'scrollViewport']),
  risk: z.enum(['read', 'write-benign', 'write-destructive']),
  status: z.enum(['blocked', 'started', 'completed', 'failed', 'aborted']), policyId: z.string().optional(),
}).strict();
const observation = z.object({ route: z.string().max(500), fingerprint: digest, targets: z.number().int().nonnegative() }).strict();
export const RunReceiptSchema = z.object({
  schemaVersion: z.literal(1), id: z.uuid(), manifestHash: digest, modelVersion: z.uuid(), structuralRevision: digest,
  status: z.enum(['running', 'verified', 'blocked', 'uncertain']),
  startedAt: z.iso.datetime(), updatedAt: z.iso.datetime(), durationMs: z.number().nonnegative(),
  failure: z.enum(['stale-model', 'grounding', 'confirmation-required', 'effect-unverified', 'effect-conflict', 'verification-unavailable', 'cancelled', 'deadline', 'browser']).optional(),
  steps: z.array(z.object({
    id, operation: id, contractVersion: digest, inputHash: digest, effectKey: digest,
    expected: z.object({ source: id, fields: z.array(id).min(1).max(100) }).strict(),
    status: z.enum(['pending', 'running', 'verified', 'blocked', 'uncertain']),
    mutationAttempted: z.boolean(), recovered: z.boolean(),
    before: observation.optional(), after: observation.optional(),
    verification: EffectObservationSchema.optional(), audit: z.array(audit).max(1000),
  }).strict()).min(1).max(20),
}).strict().superRefine((receipt, context) => {
  if (receipt.status === 'verified' && receipt.steps.some(step => step.status !== 'verified')) context.addIssue({ code: 'custom', message: 'A verified run requires every operation to be verified' });
  for (const [index, step] of receipt.steps.entries()) {
    const proof = step.verification;
    if (step.status === 'verified' && (!proof || proof.status !== 'matched' || proof.recordCount !== 1 || proof.key !== step.effectKey || proof.source !== step.expected.source || step.expected.fields.some(field => !proof.matchedFields.includes(field)))) {
      context.addIssue({ code: 'custom', path: ['steps', index], message: 'A verified operation requires matching independent evidence for every expected field' });
    }
  }
});
export type RunReceipt = z.infer<typeof RunReceiptSchema>;
