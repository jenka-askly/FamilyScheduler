import type { TimeIntentMissing, TimeSpec } from '../../../../packages/shared/src/types.js';
import { type AiProvider, getOpenAIClient } from './openaiClient.js';

const TIME_MISSING_KEYS: TimeIntentMissing[] = ['date', 'startTime', 'endTime', 'duration', 'timezone'];

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: {
    status: { type: 'string', enum: ['resolved', 'partial', 'unresolved'] },
    startUtc: { type: ['string', 'null'] },
    endUtc: { type: ['string', 'null'] },
    missing: {
      type: ['array', 'null'],
      items: { type: 'string' }
    },
    assumptions: {
      type: ['array', 'null'],
      items: { type: 'string' }
    }
  }
} as const;

export class TimeParseAiError extends Error {
  code: 'OPENAI_NOT_CONFIGURED' | 'OPENAI_CALL_FAILED' | 'OPENAI_BAD_RESPONSE';
  details?: Record<string, unknown>;

  constructor(code: TimeParseAiError['code'], message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'TimeParseAiError';
    this.code = code;
    this.details = details;
  }
}

type ParseTimeSpecAIArgs = {
  originalText: string;
  timezone: string;
  nowIso: string;
  locale?: string;
};

type ParseTimeSpecAIMeta = {
  opId?: string;
  modelOrDeployment: string;
  provider: AiProvider;
};

type AIOutput = {
  status: 'resolved' | 'partial' | 'unresolved';
  missing?: TimeIntentMissing[];
  startUtc?: string;
  endUtc?: string;
  assumptions?: string[];
};

const trimTo = (value: string, limit: number): string => value.length <= limit ? value : value.slice(0, limit);

const toOutputText = (payload: any): string | null => {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return payload.output_text;
  const itemText = payload?.output?.flatMap((entry: any) => entry?.content ?? [])?.find((entry: any) => entry?.type === 'output_text' && typeof entry?.text === 'string')?.text;
  return typeof itemText === 'string' && itemText.trim() ? itemText : null;
};

const isIsoUtc = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value)) && value.endsWith('Z');

const parseAiOutput = (raw: unknown): AIOutput => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TimeParseAiError('OPENAI_BAD_RESPONSE', 'AI output is not an object');
  const record = raw as Record<string, unknown>;
  const status = record.status;
  if (status !== 'resolved' && status !== 'partial' && status !== 'unresolved') throw new TimeParseAiError('OPENAI_BAD_RESPONSE', 'AI output has invalid status');
  const missing = Array.isArray(record.missing)
    ? record.missing.filter((item): item is TimeIntentMissing => typeof item === 'string' && TIME_MISSING_KEYS.includes(item as TimeIntentMissing))
    : undefined;

  const assumptions = Array.isArray(record.assumptions) ? record.assumptions.filter((item): item is string => typeof item === 'string') : undefined;

  if (status === 'resolved') {
    if (!isIsoUtc(record.startUtc) || !isIsoUtc(record.endUtc)) throw new TimeParseAiError('OPENAI_BAD_RESPONSE', 'Resolved output missing valid UTC interval');
    return { status, startUtc: record.startUtc, endUtc: record.endUtc, assumptions };
  }

  if (!missing?.length) throw new TimeParseAiError('OPENAI_BAD_RESPONSE', 'Partial/unresolved output requires missing fields');
  return { status, missing, assumptions };
};

const toTimeSpec = (input: ParseTimeSpecAIArgs, output: AIOutput): TimeSpec => {
  if (output.status === 'resolved') {
    return {
      intent: {
        status: 'resolved',
        originalText: input.originalText,
        assumptions: output.assumptions?.length ? output.assumptions : undefined
      },
      resolved: { startUtc: output.startUtc!, endUtc: output.endUtc!, timezone: input.timezone }
    };
  }

  return {
    intent: {
      status: output.status,
      originalText: input.originalText,
      missing: output.missing,
      assumptions: output.assumptions?.length ? output.assumptions : undefined
    }
  };
};

export async function parseTimeSpecAI(args: ParseTimeSpecAIArgs): Promise<TimeSpec> {
  const result = await parseTimeSpecAIWithMeta(args);
  return result.time;
}

export async function parseTimeSpecAIWithMeta(args: ParseTimeSpecAIArgs): Promise<{ time: TimeSpec; meta: ParseTimeSpecAIMeta }> {
  let client: ReturnType<typeof getOpenAIClient>;
  try {
    client = getOpenAIClient();
  } catch (error) {
    throw new TimeParseAiError('OPENAI_NOT_CONFIGURED', error instanceof Error ? error.message : 'OpenAI is not configured');
  }

  console.info(JSON.stringify({
    event: 'ai_time_parse_openai_before_request',
    provider: client.provider,
    configuredModel: client.modelOrDeployment,
    timeResolveModelEnv: process.env.TIME_RESOLVE_MODEL ?? null,
    openAiModelEnv: process.env.OPENAI_MODEL ?? null
  }));

  const response = await fetch(client.requestUrl, {
    method: 'POST',
    headers: client.headers,
    body: JSON.stringify({
      model: client.modelOrDeployment,
      temperature: 0,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: [
                'You resolve natural-language date/time phrases into strict JSON.',
                'Use nowIso and timezone as the explicit reference clock.',
                'Resolve relative expressions (tomorrow/next week/in 2 hours/etc.) against nowIso in timezone.',
                'Do not guess missing components. Return partial/unresolved with missing[] when needed.',
                'For a single time point (e.g. "1pm"), resolve to a 1-minute interval.',
                'When resolved, startUtc and endUtc MUST be UTC ISO-8601 strings ending with Z.'
              ].join(' ')
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify({
                originalText: args.originalText,
                timezone: args.timezone,
                nowIso: args.nowIso,
                locale: args.locale ?? null
              })
            }
          ]
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'time_spec_parse',
          schema,
          strict: true
        }
      }
    })
  }).catch((error) => {
    throw new TimeParseAiError('OPENAI_CALL_FAILED', error instanceof Error ? error.message : 'OpenAI request failed', {
      provider: client.provider,
      modelOrDeployment: client.modelOrDeployment,
      errName: error instanceof Error ? error.name : undefined,
      errMessage: trimTo(error instanceof Error ? error.message : String(error), 300)
    });
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new TimeParseAiError('OPENAI_CALL_FAILED', `OpenAI HTTP ${response.status}`, {
      provider: client.provider,
      modelOrDeployment: client.modelOrDeployment,
      errStatus: response.status,
      errBodyPreview: trimTo(errorText, 300)
    });
  }

  const payload = await response.json().catch(() => {
    throw new TimeParseAiError('OPENAI_BAD_RESPONSE', 'OpenAI response was not valid JSON');
  }) as any;

  const responseOpId = typeof payload?.id === 'string' ? payload.id : undefined;
  const responseModel = typeof payload?.model === 'string' ? payload.model : undefined;
  console.info(JSON.stringify({
    event: 'ai_time_parse_openai_result',
    provider: client.provider,
    opId: responseOpId ?? null,
    model: responseModel ?? null,
    configuredModel: client.modelOrDeployment
  }));

  const rawText = toOutputText(payload);
  if (!rawText) throw new TimeParseAiError('OPENAI_BAD_RESPONSE', 'OpenAI response missing output_text');

  const decoded = JSON.parse(rawText) as unknown;
  const parsed = parseAiOutput(decoded);

  return {
    time: toTimeSpec(args, parsed),
    meta: {
      opId: responseOpId,
      modelOrDeployment: responseModel ?? client.modelOrDeployment,
      provider: client.provider
    }
  };
}
