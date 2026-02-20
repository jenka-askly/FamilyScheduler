import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'node:crypto';
import { diagnoseOpenAiConnectivity } from '../lib/openai/openaiClient.js';

export async function diagnoseOpenAi(_request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = randomUUID();
  const result = await diagnoseOpenAiConnectivity(7000);
  const payload = {
    traceId,
    route: '/api/diagnose/openai',
    ok: result.ok,
    model: result.model,
    hasApiKey: result.hasApiKey,
    latencyMs: result.latencyMs,
    lastError: result.lastError
  };

  if (result.ok) {
    console.info(JSON.stringify({ ...payload, stage: 'openai_diagnose_success' }));
  } else {
    console.warn(JSON.stringify({ ...payload, stage: 'openai_diagnose_failure' }));
  }

  return {
    status: result.ok ? 200 : 503,
    jsonBody: {
      ok: result.ok,
      model: result.model,
      hasApiKey: result.hasApiKey,
      latencyMs: result.latencyMs,
      ...(result.lastError ? { lastError: result.lastError } : {})
    }
  };
}
