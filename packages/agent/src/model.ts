import { z } from 'zod';

export const ModelProtocolSchema = z.enum(['openai', 'bedrock-converse']);
export type ModelOptions = { apiKey: string; model: string; endpoint?: string; protocol?: z.infer<typeof ModelProtocolSchema> };
type Message = { role: 'system' | 'user'; content: string };
/** Only curated, credential-free messages from this class may enter task receipts. */
export class ModelError extends Error {}
/** A response may be regenerated before any decision is accepted; connection/refusal failures may not. */
export class ModelOutputError extends ModelError {
  /** Untrusted response data for in-memory correction only, never a receipt/error message. */
  constructor(message: string, readonly proposal?: unknown) { super(message); }
}

async function body(response: Response, limit: number) {
  const reader = response.body?.getReader();
  if (!reader) throw new ModelError('The model returned no response body.');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) throw new ModelError('Model response exceeds budget.');
      chunks.push(chunk.value);
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  return Buffer.concat(chunks).toString('utf8');
}

/** Host-configured text inference only. Neither protocol exposes tools or execution authority. */
export function createJSONModel(options: ModelOptions, maxTokens: number) {
  const protocol = ModelProtocolSchema.parse(options.protocol ?? 'openai');
  const endpoint = new URL(options.endpoint ?? (protocol === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://bedrock-runtime.us-east-1.amazonaws.com'));
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || !options.apiKey || !options.model) throw new Error('Supply an HTTPS server model endpoint, key and model.');
  if (protocol === 'bedrock-converse') {
    if (endpoint.pathname !== '/') throw new Error('Supply only the HTTPS Bedrock runtime origin; the host binds the model route.');
    endpoint.pathname = `/model/${encodeURIComponent(options.model)}/converse`;
  }
  return async (messages: Message[], signal: AbortSignal): Promise<unknown> => {
    signal.throwIfAborted();
    const payload = protocol === 'openai'
      ? { model: options.model, max_tokens: maxTokens, response_format: { type: 'json_object' }, messages }
      : { system: messages.filter(message => message.role === 'system').map(message => ({ text: message.content })),
        messages: messages.filter(message => message.role === 'user').map(message => ({ role: 'user', content: [{ text: message.content }] })),
        inferenceConfig: { maxTokens } };
    const serialized = JSON.stringify(payload);
    if (Buffer.byteLength(serialized) > 128_000) throw new ModelError('The model context budget was reached. Saved observations remain available.');
    const response = await fetch(endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
      headers: { authorization: `Bearer ${options.apiKey}`, 'content-type': 'application/json' }, body: serialized });
    if (!response.ok) {
      let hint = '';
      try {
        const error: unknown = JSON.parse(await body(response, 4096));
        const code = z.object({ error: z.object({ code: z.string().nullable().optional() }).optional() }).safeParse(error);
        if (code.success && code.data.error?.code === 'ip_not_authorized') hint = ' The provider rejected this server’s IP address.';
        if (code.success && code.data.error?.code === 'invalid_api_key') hint = ' The provider rejected the key.';
      } catch { /* Provider bodies are untrusted and never copied into a receipt. */ }
      throw new ModelError(`Model connection returned HTTP ${response.status}.${hint} Check the server credential, endpoint and model. Source evidence has been retained.`);
    }
    const raw: unknown = JSON.parse(await body(response, 64_000));
    let content: string;
    if (protocol === 'openai') {
      const result = z.object({ choices: z.array(z.object({ finish_reason: z.literal('stop'), message: z.object({ content: z.string().max(50_000) }) })).length(1) }).parse(raw);
      content = result.choices[0]!.message.content;
    } else {
      const result = z.object({ stopReason: z.literal('end_turn'), output: z.object({ message: z.object({ role: z.literal('assistant'), content: z.array(z.object({ text: z.string().max(50_000) }).strict()).min(1).max(10) }) }) }).parse(raw);
      content = result.output.message.content.map(block => block.text).join('');
    }
    if (content.length > 50_000) throw new ModelError('Model response exceeds budget.');
    // Accept one final JSON object with an optional text introduction/fence. Never choose between objects.
    // The caller still validates every field and grants all authority independently.
    const trimmed = content.trim(), fenced = /^[^{]*?```(?:json)?\s*\n\s*(\{[\s\S]*\})\s*\n```$/i.exec(trimmed);
    const start = trimmed.indexOf('{');
    try {
      if (start === -1 || (!fenced && trimmed.slice(0, start).includes('```'))) throw new Error('No single JSON object');
      return JSON.parse(fenced ? fenced[1]! : trimmed.slice(start));
    }
    catch { throw new ModelOutputError('The model returned invalid JSON. No decision was accepted.'); }
  };
}
