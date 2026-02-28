import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'node:crypto';
import { requireSessionFromRequest, HttpError } from '../lib/auth/sessions.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { getUserPrefs } from '../lib/prefs/userPrefs.js';

export async function userPreferencesGet(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = randomUUID();

  try {
    const session = await requireSessionFromRequest(request, traceId);
    const storage = createStorageAdapter();
    const prefs = await getUserPrefs(storage, session.email, traceId);
    return {
      status: 200,
      jsonBody: {
        ok: true,
        emailUpdatesEnabled: prefs.emailUpdatesEnabled,
        mutedGroupIds: prefs.mutedGroupIds
      }
    };
  } catch (error) {
    if (error instanceof HttpError) return error.response;
    return errorResponse(500, 'user_preferences_get_failed', 'Failed to load user preferences', traceId);
  }
}
