import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'node:crypto';
import { diagnoseOpenAiConnectivity } from '../lib/openai/openaiClient.js';

export async function diagnoseOpenAi(_request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = randomUUID();
  if (process.env.DOGFOOD !== '1') {
    console.warn(JSON.stringify({
      traceId,
      stage: 'openai_diagnose_blocked',
      route: '/api/diagnose/openai',
      reason: 'dogfood_disabled'
    }));
    return {
      status: 404,
      jsonBody: { error: 'Not found' }
    };
  }
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
