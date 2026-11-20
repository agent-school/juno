import { afterEach, expect, it, vi } from 'vitest';
import { plannerConnection, plannerStatus } from '../../src/model.js';

afterEach(() => vi.unstubAllEnvs());
it('selects a server-only protocol for both planners and exposes no credential in status', () => {
  vi.stubEnv('JUNO_PLANNER_API_KEY', 'server-private-sentinel'); vi.stubEnv('JUNO_PLANNER_MODEL', 'configured-model');
  vi.stubEnv('JUNO_PLANNER_PROTOCOL', 'bedrock-converse'); vi.stubEnv('JUNO_PLANNER_ENDPOINT', 'https://bedrock-runtime.us-east-1.amazonaws.com');
  expect(plannerConnection()).toEqual({ apiKey: 'server-private-sentinel', model: 'configured-model', protocol: 'bedrock-converse', endpoint: 'https://bedrock-runtime.us-east-1.amazonaws.com' });
  expect(plannerStatus()).toEqual({ configured: true, model: 'configured-model' });
  vi.stubEnv('JUNO_PLANNER_PROTOCOL', 'unknown-provider');
  expect(plannerConnection()).toBeUndefined(); expect(plannerStatus().configured).toBe(false);
  vi.stubEnv('JUNO_PLANNER_PROTOCOL', 'openai'); vi.stubEnv('JUNO_PLANNER_API_KEY', '');
  expect(plannerConnection()).toBeUndefined(); expect(plannerStatus().configured).toBe(false);
});
