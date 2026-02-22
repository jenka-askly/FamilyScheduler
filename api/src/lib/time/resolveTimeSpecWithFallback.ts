import type { InvocationContext } from '@azure/functions';
import type { TimeIntentMissing, TimeSpec } from '../../../../packages/shared/src/types.js';
import { parseTimeSpec } from './timeSpec.js';
import { parseOpenAiTimeResolve, type OpenAiTimeResolve } from './resolveTimeSpecWithFallbackSchema.js';

export type TimeResolveFallbackErrorCode = 'OPENAI_NOT_CONFIGURED' | 'OPENAI_CALL_FAILED' | 'OPENAI_BAD_RESPONSE';

const missingKeys: TimeIntentMissing[] = ['date', 'startTime', 'endTime', 'duration', 'timezone'];

export class TimeResolveFallbackError extends Error {
  code: TimeResolveFallbackErrorCode;
  httpStatus?: number;

  constructor(code: TimeResolveFallbackErrorCode, message: string, httpStatus?: number) {
    super(message);
    this.name = 'TimeResolveFallbackError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

type ResolveArgs = {
  whenText: string;
  timezone: string;
  now: Date;
  traceId: string;
  context: InvocationContext;
};

const fallbackEnabled = (): boolean => process.env.TIME_RESOLVE_OPENAI_FALLBACK === '1';

const toTimeSpec = (whenText: string, timezone: string, aiResult: OpenAiTimeResolve): TimeSpec => {
  if (aiResult.status === 'resolved') {
    return {
      intent: {
        status: 'resolved',
        originalText: whenText,
        assumptions: aiResult.assumptions.length ? aiResult.assumptions : undefined
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
      missing: aiResult.missing.filter((value): value is TimeIntentMissing => missingKeys.includes(value as TimeIntentMissing)),
      assumptions: aiResult.assumptions.length ? aiResult.assumptions : undefined
    }
  };
};

const callOpenAi = async ({ whenText, timezone, now }: ResolveArgs): Promise<OpenAiTimeResolve> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new TimeResolveFallbackError('OPENAI_NOT_CONFIGURED', 'OPENAI_API_KEY is not configured');

  const model = process.env.TIME_RESOLVE_MODEL ?? process.env.OPENAI_MODEL;
  if (!model) throw new TimeResolveFallbackError('OPENAI_NOT_CONFIGURED', 'OPENAI_MODEL is not configured');

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
        { role: 'system', content: 'You convert a natural-language time expression into UTC timestamps. Return ONLY valid JSON.' },
        {
          role: 'user',
          content: JSON.stringify({
            whenText,
            timezone,
            now: now.toISOString(),
            rules: [
              'If a single time is given, return startUtc only and omit endUtc (or set endUtc=null).',
              'If a range is given, return both startUtc and endUtc.',
              'If cannot determine date/time, return status="unresolved" plus missing array.'
            ]
          })
        }
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

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent) as unknown;
  } catch {
    throw new TimeResolveFallbackError('OPENAI_BAD_RESPONSE', 'OpenAI response content was not valid JSON');
  }

  const validated = parseOpenAiTimeResolve(parsed);
  if (!validated) throw new TimeResolveFallbackError('OPENAI_BAD_RESPONSE', 'OpenAI response schema validation failed');
  return validated;
};

export async function resolveTimeSpecWithFallback(args: ResolveArgs): Promise<{ time: TimeSpec; fallbackAttempted: boolean; usedFallback: boolean }> {
  const timeLocal = parseTimeSpec({ originalText: args.whenText, timezone: args.timezone, now: args.now });
  if (timeLocal.intent.status === 'resolved') return { time: timeLocal, fallbackAttempted: false, usedFallback: false };
  if (!fallbackEnabled()) return { time: timeLocal, fallbackAttempted: false, usedFallback: false };

  const aiResult = await callOpenAi(args);
  return { time: toTimeSpec(args.whenText, args.timezone, aiResult), fallbackAttempted: true, usedFallback: true };
}
