import type { TimeIntentMissing, TimeSpec } from '../../../../packages/shared/src/types.js';
import { parseTimeSpec } from './timeSpec.js';

export type TimeResolveFallbackErrorCode = 'OPENAI_NOT_CONFIGURED' | 'OPENAI_CALL_FAILED' | 'OPENAI_BAD_RESPONSE';

type AiResolved = { status: 'resolved'; startUtc: string; endUtc?: string | null; missing: string[]; assumptions: string[] };
type AiUnresolved = { status: 'unresolved'; missing: string[]; assumptions: string[] };
type AiTimeResolve = AiResolved | AiUnresolved;

const missingKeys: TimeIntentMissing[] = ['date', 'startTime', 'endTime', 'duration', 'timezone'];

export class TimeResolveFallbackError extends Error {
  code: TimeResolveFallbackErrorCode;
  status?: number;

  constructor(code: TimeResolveFallbackErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'TimeResolveFallbackError';
    this.code = code;
    this.status = status;
  }
}

type ResolveArgs = { whenText: string; timezone: string; now: Date; traceId?: string; log?: (obj: unknown) => void };

const isIsoDate = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value));

const parseModelResponse = (value: unknown): AiTimeResolve => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TimeResolveFallbackError('OPENAI_BAD_RESPONSE', 'OpenAI response schema validation failed');
  const record = value as Record<string, unknown>;
  const status = record.status;
  const assumptions = Array.isArray(record.assumptions) ? record.assumptions.filter((item): item is string => typeof item === 'string') : [];
  const missing = Array.isArray(record.missing) ? record.missing.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];

  if (status === 'resolved') {
    if (!isIsoDate(record.startUtc)) throw new TimeResolveFallbackError('OPENAI_BAD_RESPONSE', 'OpenAI response schema validation failed');
    if (record.endUtc !== undefined && record.endUtc !== null && !isIsoDate(record.endUtc)) throw new TimeResolveFallbackError('OPENAI_BAD_RESPONSE', 'OpenAI response schema validation failed');
    return { status: 'resolved', startUtc: record.startUtc, endUtc: (record.endUtc as string | null | undefined), missing, assumptions };
  }

  if (status === 'unresolved') {
    if (!missing.length) throw new TimeResolveFallbackError('OPENAI_BAD_RESPONSE', 'OpenAI response schema validation failed');
    return { status: 'unresolved', missing, assumptions };
  }

  throw new TimeResolveFallbackError('OPENAI_BAD_RESPONSE', 'OpenAI response schema validation failed');
};

const toTimeSpec = (whenText: string, timezone: string, aiResult: AiTimeResolve): TimeSpec => {
  if (aiResult.status === 'resolved') {
    const assumptions = [...aiResult.assumptions];
    if (!aiResult.endUtc) assumptions.push('No duration provided.');
    return {
      intent: {
        status: 'resolved',
        originalText: whenText,
        assumptions: assumptions.length ? assumptions : undefined
      },
      resolved: {
        timezone,
        startUtc: aiResult.startUtc,
        ...(aiResult.endUtc ? { endUtc: aiResult.endUtc } : {})
      } as TimeSpec['resolved']
    };
  }

  return {
    intent: {
      status: 'unresolved',
      originalText: whenText,
      missing: aiResult.missing.filter((item): item is TimeIntentMissing => missingKeys.includes(item as TimeIntentMissing)),
      assumptions: aiResult.assumptions.length ? aiResult.assumptions : undefined
    }
  };
};

const callOpenAi = async (args: ResolveArgs): Promise<AiTimeResolve> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new TimeResolveFallbackError('OPENAI_NOT_CONFIGURED', 'OPENAI_API_KEY is not configured');
  const model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You convert a natural language time expression into a UTC timestamp interval. Return ONLY valid JSON.' },
        { role: 'user', content: JSON.stringify({ whenText: args.whenText, timezone: args.timezone, now: args.now.toISOString() }) }
      ]
    })
  }).catch((error) => {
    throw new TimeResolveFallbackError('OPENAI_CALL_FAILED', error instanceof Error ? error.message : 'OpenAI request failed');
  });

  if (!response.ok) throw new TimeResolveFallbackError('OPENAI_CALL_FAILED', `OpenAI HTTP ${response.status}`, response.status);

  const payload = await response.json().catch(() => {
    throw new TimeResolveFallbackError('OPENAI_BAD_RESPONSE', 'OpenAI response was not valid JSON');
  }) as { choices?: Array<{ message?: { content?: string } }> };

  const rawContent = payload.choices?.[0]?.message?.content;
  if (!rawContent) throw new TimeResolveFallbackError('OPENAI_BAD_RESPONSE', 'OpenAI response missing content');

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawContent) as unknown;
  } catch {
    throw new TimeResolveFallbackError('OPENAI_BAD_RESPONSE', 'OpenAI response content was not valid JSON');
  }

  return parseModelResponse(parsedJson);
};

export async function resolveTimeSpecWithFallback(args: ResolveArgs): Promise<{ usedFallback: boolean; time: TimeSpec }> {
  const parsed = parseTimeSpec({ originalText: args.whenText, timezone: args.timezone, now: args.now });
  if (parsed.intent.status === 'resolved') return { usedFallback: false, time: parsed };

  if ((process.env.TIME_RESOLVE_OPENAI_FALLBACK ?? '0') !== '1') return { usedFallback: false, time: parsed };

  args.log?.({ traceId: args.traceId, stage: 'time_resolve_openai_fallback_start' });
  const aiResult = await callOpenAi(args);
  return { usedFallback: true, time: toTimeSpec(args.whenText, args.timezone, aiResult) };
}
