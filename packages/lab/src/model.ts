import { ModelProtocolSchema, type ModelOptions } from '@juno/agent';

/** Model credentials and protocol come exclusively from server configuration. */
export function plannerConnection(): ModelOptions | undefined {
  const protocol = ModelProtocolSchema.safeParse(process.env.JUNO_PLANNER_PROTOCOL ?? 'openai');
  const apiKey = process.env.JUNO_PLANNER_API_KEY, model = process.env.JUNO_PLANNER_MODEL;
  if (!apiKey || !model || !protocol.success) return;
  return { apiKey, model, protocol: protocol.data, endpoint: process.env.JUNO_PLANNER_ENDPOINT };
}
export function plannerStatus() {
  return { configured: !!plannerConnection(), model: process.env.JUNO_PLANNER_MODEL ?? null };
}
