import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'node:crypto';
import { HttpError, requireSessionFromRequest } from '../lib/auth/sessions.js';
import { getUserProfileEntity } from '../lib/tables/entities.js';
import { userKeyFromEmail } from '../lib/identity/userKey.js';

const normalizeDisplayName = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export async function userProfileGet(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = randomUUID();
  try {
    const session = await requireSessionFromRequest(request, traceId);
    const userKey = userKeyFromEmail(session.email);
    const profile = await getUserProfileEntity(userKey);
    const displayName = normalizeDisplayName(profile?.displayName);
    context.log?.('user_profile_get', JSON.stringify({ route: 'user/profile', traceId, userKey, outcome: 'ok' }));
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
