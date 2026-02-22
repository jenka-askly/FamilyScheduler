import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

export type UsageState = 'unknown' | 'ok' | 'warning' | 'limit_reached';

export async function usage(_request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const nowIso = new Date().toISOString();
  return {
    status: 200,
    jsonBody: {
      usageState: 'unknown' as UsageState,
      usageSummary: 'usage data not configured',
      updatedAt: nowIso
    }
  };
}
