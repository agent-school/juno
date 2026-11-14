import { z } from 'zod';

const id = z.string().regex(/^[a-zA-Z0-9_.-]{1,100}$/);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
// Root-relative URL round trips preserve the supplied site origin and observed spelling.
// Reject aliases the browser would normalize (dot segments, backslashes, whitespace).
const pathname = z.string().min(1).max(500).refine(value => {
  if (value.length > 500 || !value.startsWith('/') || value.startsWith('//') || /%(?![a-fA-F0-9]{2})/.test(value)) return false;
  try {
    const address = new URL(value, 'https://pathname.invalid');
    return address.origin === 'https://pathname.invalid' && address.pathname === value && !address.search && !address.hash;
  } catch { return false; }
}, 'Expected a canonical root-relative pathname without query or fragment');
const scope = z.object({ role: z.string().min(1).max(100), name: z.string().min(1).max(300), exact: z.literal(true) }).strict();
export const SemanticIdentitySchema = scope.extend({ scopeChain: z.array(scope).max(10).optional() }).strict();
const field = z.object({
  kind: z.enum(['text', 'calendar-date', 'enum', 'boolean']), required: z.literal(true),
  maxLength: z.number().int().min(1).max(50_000),
  choices: z.array(z.string().max(300)).min(1).max(100).optional(),
}).strict().refine(value => value.kind !== 'enum' || !!value.choices, 'enum inputs require choices')
  .refine(value => !value.choices || (new Set(value.choices).size === value.choices.length && value.choices.every(choice => choice.length <= value.maxLength)), 'enum choices must be unique and fit the input bound');

export const OperationContractSchema = z.object({
  id, risk: z.enum(['read', 'write-benign', 'write-destructive']),
  pageRoute: pathname,
  inputs: z.record(z.string().regex(/^[a-z][a-z0-9_]{0,63}$/), field),
  preconditions: z.array(z.object({ kind: z.literal('unique-enabled'), target: SemanticIdentitySchema }).strict()).min(1).max(100),
  steps: z.array(z.object({
    method: z.enum(['click', 'fill', 'selectOption', 'check']),
    target: SemanticIdentitySchema, parameter: z.string().max(64).optional(),
  }).strict()).min(1).max(100),
  effects: z.array(z.object({
    kind: z.literal('record-matches-inputs'), source: id, key: id,
    fields: z.array(id).min(1).max(100), unique: z.literal(true),
  }).strict()).min(1).max(20),
  verification: z.object({ kind: z.literal('independent-state'), source: id, required: z.literal(true) }).strict(),
}).strict().superRefine((contract, context) => {
  for (const [index, step] of contract.steps.entries()) {
    if ((step.method === 'click' ? step.parameter !== undefined : !step.parameter) ||
        (step.parameter && !Object.hasOwn(contract.inputs, step.parameter))) {
      context.addIssue({ code: 'custom', path: ['steps', index], message: 'Step parameter must reference a declared input' });
    }
    if (step.parameter && Object.hasOwn(contract.inputs, step.parameter) &&
        ((step.method === 'check') !== (contract.inputs[step.parameter]!.kind === 'boolean'))) {
      context.addIssue({ code: 'custom', path: ['steps', index], message: 'Step parameter type must match its action method' });
    }
  }
  if (contract.effects.some(effect => effect.source !== contract.verification.source || effect.fields.some(name => !Object.hasOwn(contract.inputs, name)))) {
    context.addIssue({ code: 'custom', path: ['effects'], message: 'Effects must reference declared inputs and the independent verification source' });
  }
});
export type OperationContract = z.infer<typeof OperationContractSchema>;
export const OperationSpecSchema = z.object({
  contractVersion: digest, contract: OperationContractSchema,
  source: z.literal('host-reviewed-contract'), validation: z.literal('requires-runtime-verification'),
}).strict();
export type OperationSpec = z.infer<typeof OperationSpecSchema>;

export const SiteModelSchema = z.object({
  schemaVersion: z.literal(1), version: z.uuid(), structuralRevision: digest,
  origin: z.url().refine(value => {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) && parsed.origin === value;
  }, 'Expected canonical HTTP(S) origin'),
  observedAt: z.iso.datetime(), source: z.literal('accessibility-observation'),
  pages: z.array(z.object({
    route: pathname, fingerprint: digest,
    elements: z.array(z.object({ identity: SemanticIdentitySchema, enabled: z.boolean() }).strict()).max(500),
    navigation: z.array(z.object({ identity: SemanticIdentitySchema, targetRoute: pathname }).strict()).max(100),
    unresolved: z.number().int().min(0).max(10_000),
  }).strict()).min(1).max(20),
  operations: z.array(OperationSpecSchema).max(50),
}).strict().superRefine((model, context) => {
  const routes = new Set(model.pages.map(page => page.route));
  if (routes.size !== model.pages.length || model.operations.some(operation => !routes.has(operation.contract.pageRoute)) ||
      model.pages.some(page => page.navigation.some(link => !routes.has(link.targetRoute)))) {
    context.addIssue({ code: 'custom', message: 'Routes and operation pages must refer to unique, explicitly observed pages' });
  }
});
export type SiteModel = z.infer<typeof SiteModelSchema>;
