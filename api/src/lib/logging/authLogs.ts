import { randomUUID } from 'node:crypto';

export const debugAuthLogsEnabled = process.env.DEBUG_AUTH_LOGS === 'true';

export const logAuth = (payload: Record<string, unknown>): void => {
  if (!debugAuthLogsEnabled) return;
  console.log(payload);
};

export const ensureTraceId = (traceId?: unknown): string => (typeof traceId === 'string' && traceId.trim().length > 0 ? traceId.trim() : randomUUID());
