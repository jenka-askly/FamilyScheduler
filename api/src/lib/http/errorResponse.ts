import type { HttpResponseInit } from '@azure/functions';

export const errorResponse = (
  status: number,
  error: string,
  message: string,
  traceId: string,
  extra: Record<string, unknown> = {}
): HttpResponseInit => ({ status, jsonBody: { ok: false, error, message, traceId, ...extra } });

export const logConfigMissing = (route: string, traceId: string, missing: string[]): void => {
  console.error(JSON.stringify({ level: 'error', code: 'CONFIG_MISSING', route, traceId, missing: [...missing].sort() }));
};
