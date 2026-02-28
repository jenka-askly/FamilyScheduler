import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'node:crypto';
import { requireSessionFromRequest, HttpError } from '../lib/auth/sessions.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { setEmailUpdatesEnabled } from '../lib/prefs/userPrefs.js';

export async function userPreferencesSet(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = randomUUID();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, 'invalid_json', 'Request body must be valid JSON', traceId);
  }

  const emailUpdatesEnabled = (body && typeof body === 'object') ? (body as { emailUpdatesEnabled?: unknown }).emailUpdatesEnabled : undefined;
  if (typeof emailUpdatesEnabled !== 'boolean') {
    return errorResponse(400, 'invalid_request', 'emailUpdatesEnabled must be a boolean', traceId);
  }

  try {
    const session = await requireSessionFromRequest(request, traceId);
    const storage = createStorageAdapter();
    const prefs = await setEmailUpdatesEnabled(storage, session.email, emailUpdatesEnabled);
    return {
      status: 200,
      jsonBody: {
        ok: true,
        emailUpdatesEnabled: prefs.emailUpdatesEnabled
      }
    };
  } catch (error) {
    if (error instanceof HttpError) return error.response;
    return errorResponse(500, 'user_preferences_set_failed', 'Failed to update user preferences', traceId);
  }
}
