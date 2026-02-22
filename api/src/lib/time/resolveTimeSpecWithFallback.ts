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

const trimTo = (value: string, limit: number): string => value.length <= limit ? value : value.slice(0, limit);
const isAiEnabled = (): boolean => process.env.TIME_RESOLVE_OPENAI_FALLBACK !== '0';

export async function resolveTimeSpecWithFallback(args: ResolveArgs): Promise<
  | { ok: true; time: ReturnType<typeof parseTimeSpec>; fallbackAttempted: boolean; usedFallback: boolean; opId?: string; model?: string }
  | { ok: false; error: { code: string; message: string }; fallbackAttempted: boolean; usedFallback: boolean; opId?: string; model?: string }
> {
  const timeLocal = parseTimeSpec({ originalText: args.whenText, timezone: args.timezone, now: args.now });
  if (!isAiEnabled()) {
    return { ok: true, time: timeLocal, fallbackAttempted: false, usedFallback: false, opId: undefined, model: undefined };
  }

  try {
    const aiResult = await parseTimeSpecAIWithMeta({
      originalText: args.whenText,
      timezone: args.timezone,
      nowIso: args.now.toISOString(),
      locale: args.locale
    });
    args.context.log(JSON.stringify({
      event: 'ai_time_parse',
      status: 'ok',
      traceId: args.traceId,
      opId: aiResult.meta.opId ?? null,
      provider: aiResult.meta.provider,
      modelOrDeployment: aiResult.meta.modelOrDeployment,
      parseStatus: aiResult.time.intent.status
    }));
    return { ok: true, time: aiResult.time, fallbackAttempted: true, usedFallback: true, opId: aiResult.meta.opId, model: aiResult.meta.modelOrDeployment };
  } catch (error) {
    const code = error instanceof TimeParseAiError ? error.code : 'OPENAI_CALL_FAILED';
    const details = error instanceof TimeParseAiError ? error.details : undefined;
    const errStatus = typeof (details?.errStatus) === 'number' ? details.errStatus
      : typeof (error as any)?.status === 'number' ? (error as any).status
        : typeof (error as any)?.response?.status === 'number' ? (error as any).response.status
          : undefined;

    args.context.log(JSON.stringify({
      event: 'ai_time_parse',
      status: 'fallback',
      traceId: args.traceId,
      opId: null,
      errorCode: code,
      errName: error instanceof Error ? error.name : undefined,
      errMessage: trimTo(error instanceof Error ? error.message : String(error), 300),
      errStatus,
      errCode: (error as any)?.code,
      errType: (error as any)?.type,
      errBodyPreview: typeof details?.errBodyPreview === 'string' ? trimTo(details.errBodyPreview, 300) : undefined,
      provider: typeof details?.provider === 'string' ? details.provider : undefined,
      modelOrDeployment: typeof details?.modelOrDeployment === 'string' ? details.modelOrDeployment : undefined,
      nowIso: args.now.toISOString(),
      timezone: args.timezone
    }));
    return {
      ok: false,
      error: {
        code,
        message: trimTo(error instanceof Error ? error.message : String(error), 300)
      },
      fallbackAttempted: true,
      usedFallback: false,
      opId: undefined,
      model: undefined
    };
  }
}
