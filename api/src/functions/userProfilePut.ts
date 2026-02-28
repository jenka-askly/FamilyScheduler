import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'node:crypto';
import { HttpError, requireSessionFromRequest } from '../lib/auth/sessions.js';
import { userKeyFromEmail } from '../lib/identity/userKey.js';
import { upsertUserProfile } from '../lib/tables/entities.js';

const validationError = (traceId: string, field: string, message: string): HttpResponseInit => ({
  status: 400,
  jsonBody: { ok: false, error: 'VALIDATION_ERROR', field, message, traceId }
});

export async function userProfilePut(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = randomUUID();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError(traceId, 'displayName', 'displayName is required');
  }

  const displayNameRaw = (body && typeof body === 'object') ? (body as { displayName?: unknown }).displayName : undefined;
  if (typeof displayNameRaw !== 'string') return validationError(traceId, 'displayName', 'displayName is required');
  const displayName = displayNameRaw.trim().replace(/\s+/g, ' ');
  if (!displayName) return validationError(traceId, 'displayName', 'displayName is required');
  if (displayName.length > 40) return validationError(traceId, 'displayName', 'displayName must be 40 characters or less');

  try {
    const session = await requireSessionFromRequest(request, traceId);
    const userKey = userKeyFromEmail(session.email);
    const now = new Date().toISOString();
    await upsertUserProfile({ userKey, email: session.email, displayName, updatedAt: now, createdAt: now });
    context.log?.('user_profile_put', JSON.stringify({ route: 'user/profile', traceId, userKey, outcome: 'ok' }));
    return {
      status: 200,
      jsonBody: {
        ok: true,
        email: session.email,
        displayName,
        hasPhoto: false,
        photoUpdatedAt: undefined
      }
    };
  } catch (error) {
    if (error instanceof HttpError) return error.response;
    throw error;
  }
}
