import type { OperationContract } from '@juno/knowledge';

/** Shared planner/runtime boundary: validate the full plan before any browser mutation. */
export function validateInputs(contract: OperationContract, requestKey: string, inputs: Record<string, string | boolean>) {
  if (Object.hasOwn(inputs, requestKey)) throw new Error('The runtime owns the request key');
  const expected = Object.keys(contract.inputs).filter(name => name !== requestKey).sort();
  if (JSON.stringify(Object.keys(inputs).sort()) !== JSON.stringify(expected)) throw new Error('Inputs must exactly match the operation contract');
  for (const name of expected) {
    const field = contract.inputs[name]!, value = inputs[name];
    if (field.kind === 'boolean' ? typeof value !== 'boolean' : typeof value !== 'string' || !value.length || value.length > field.maxLength) throw new Error('Input type or length violates its contract');
    if (field.kind === 'enum' && !field.choices!.includes(String(value))) throw new Error('Input is outside the declared choices');
    if (field.kind === 'calendar-date' && (!/^\d{4}-\d{2}-\d{2}$/.test(String(value)) || !Number.isFinite(Date.parse(String(value))) || new Date(String(value)).toISOString().slice(0, 10) !== value)) throw new Error('Invalid calendar date');
  }
}
