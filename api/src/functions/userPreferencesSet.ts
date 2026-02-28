import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'node:crypto';
import { requireSessionFromRequest, HttpError } from '../lib/auth/sessions.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { normalizeMutedGroupIds, setUserPrefsPartial } from '../lib/prefs/userPrefs.js';

export async function userPreferencesSet(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = randomUUID();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, 'invalid_json', 'Request body must be valid JSON', traceId);
  }

  const requestBody = (body && typeof body === 'object') ? body as { emailUpdatesEnabled?: unknown; mutedGroupIds?: unknown } : {};
  const hasEmailUpdatesEnabled = requestBody.emailUpdatesEnabled !== undefined;
  const hasMutedGroupIds = requestBody.mutedGroupIds !== undefined;
  if (!hasEmailUpdatesEnabled && !hasMutedGroupIds) {
    return errorResponse(400, 'invalid_request', 'Provide at least one supported preference field', traceId);
  }

  if (hasEmailUpdatesEnabled && typeof requestBody.emailUpdatesEnabled !== 'boolean') {
    return errorResponse(400, 'invalid_request', 'emailUpdatesEnabled must be a boolean', traceId);
  }

  let mutedGroupIds: string[] | undefined;
  if (hasMutedGroupIds) {
    const normalized = normalizeMutedGroupIds(requestBody.mutedGroupIds);
    if (!normalized) return errorResponse(400, 'invalid_request', 'mutedGroupIds must be an array of UUID strings', traceId);
    if (normalized.length > 500) return errorResponse(400, 'invalid_request', 'mutedGroupIds cannot exceed 500 entries', traceId);
    mutedGroupIds = normalized;
  }

  try {
    const session = await requireSessionFromRequest(request, traceId);
    const storage = createStorageAdapter();
    const prefs = await setUserPrefsPartial(storage, session.email, {
      ...(hasEmailUpdatesEnabled ? { emailUpdatesEnabled: requestBody.emailUpdatesEnabled as boolean } : {}),
      ...(hasMutedGroupIds ? { mutedGroupIds } : {})
    });
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
    return errorResponse(500, 'user_preferences_set_failed', 'Failed to update user preferences', traceId);
  }
}
