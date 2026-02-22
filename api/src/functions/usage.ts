import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { readUsageResponse } from '../lib/usageMeter.js';

export async function usage(_request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const payload = await readUsageResponse();
  return {
    status: 200,
    jsonBody: payload
  };
}
