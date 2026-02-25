import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import apiPkg from '../../package.json' with { type: 'json' };

export async function health(_request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  return {
    status: 200,
    jsonBody: {
      ok: true,
      time: new Date().toISOString(),
      version: process.env.BUILD_SHA?.trim() || apiPkg.version
    }
  };
}
