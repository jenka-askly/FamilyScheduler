import type { InvocationContext } from '@azure/functions';
import { parseTimeSpec } from './timeSpec.js';
import { parseTimeSpecAIWithMeta, TimeParseAiError } from '../ai/parseTimeSpecAI.js';

type ResolveArgs = {
  whenText: string;
  timezone: string;
  now: Date;
  traceId: string;
  context: InvocationContext;
  locale?: string;
};

const aiEnabled = (): boolean => process.env.TIME_RESOLVE_OPENAI_FALLBACK !== '0';

export async function resolveTimeSpecWithFallback(args: ResolveArgs): Promise<{ time: ReturnType<typeof parseTimeSpec>; fallbackAttempted: boolean; usedFallback: boolean; opId?: string; model?: string }> {
  if (aiEnabled()) {
    try {
      const aiResult = await parseTimeSpecAIWithMeta({
        originalText: args.whenText,
        timezone: args.timezone,
        nowIso: args.now.toISOString(),
        locale: args.locale
      });
      args.context.log(JSON.stringify({ event: 'ai_time_parse', traceId: args.traceId, opId: aiResult.meta.opId ?? null, originalText: args.whenText, status: aiResult.time.intent.status }));
      return { time: aiResult.time, fallbackAttempted: true, usedFallback: false, opId: aiResult.meta.opId, model: aiResult.meta.model };
    } catch (error) {
      const code = error instanceof TimeParseAiError ? error.code : 'OPENAI_CALL_FAILED';
      args.context.log(JSON.stringify({ event: 'ai_time_parse', traceId: args.traceId, opId: null, originalText: args.whenText, status: 'fallback', errorCode: code }));
    }
  }

  const timeLocal = parseTimeSpec({ originalText: args.whenText, timezone: args.timezone, now: args.now });
  return { time: timeLocal, fallbackAttempted: aiEnabled(), usedFallback: aiEnabled(), opId: undefined, model: undefined };
}
