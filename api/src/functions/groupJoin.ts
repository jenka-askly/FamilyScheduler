import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { errorResponse } from '../lib/http/errorResponse.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { findActiveMemberByEmail, isPlausibleEmail, normalizeEmail } from '../lib/auth/requireMembership.js';
import { HttpError, requireSessionFromRequest } from '../lib/auth/sessions.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';

type JoinBody = { groupId?: unknown; traceId?: unknown; email?: unknown };

export type GroupJoinValidationResult =
  | { ok: true; traceId: string; groupId: string; email: string }
  | { ok: false; traceId: string; response: HttpResponseInit; error: 'group_not_found' | 'not_allowed' | 'join_failed' };

export const resolveOrigin = (request: HttpRequest): string | null => {
  const explicit = process.env.WEB_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const origin = request.headers.get('origin');
  if (origin) return origin;
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (!forwardedHost) return null;
  return `https://${forwardedHost}`;
};

export const redactEmailForLog = (email: string): string => {
  const normalized = normalizeEmail(email);
  const [local = '', domain = 'unknown'] = normalized.split('@');
  if (!local) return `***@${domain}`;
  const prefix = local.slice(0, 2);
  return `${prefix}***@${domain}`;
};

export const validateGroupJoinAccess = async (groupId: string, emailRaw: string, traceId: string): Promise<GroupJoinValidationResult> => {
  if (!isPlausibleEmail(emailRaw)) {
    return { ok: false, traceId, error: 'not_allowed', response: errorResponse(403, 'not_allowed', 'Not allowed', traceId) };
  }

  const email = normalizeEmail(emailRaw);
  const storage = createStorageAdapter();
  let loaded;
  try {
    loaded = await storage.load(groupId);
  } catch (error) {
    if (error instanceof GroupNotFoundError) {
      return { ok: false, traceId, error: 'group_not_found', response: errorResponse(404, 'group_not_found', 'Group not found', traceId) };
    }
    console.warn(JSON.stringify({ event: 'group_join_validation_failed', traceId, groupId, error: 'join_failed' }));
    return { ok: false, traceId, error: 'join_failed', response: errorResponse(500, 'join_failed', 'Join failed', traceId) };
  }

  const member = findActiveMemberByEmail(loaded.state, email);
  if (!member) {
    return { ok: false, traceId, error: 'not_allowed', response: errorResponse(403, 'not_allowed', 'Not allowed', traceId) };
  }

  return { ok: true, traceId, groupId, email };
};

export async function groupJoin(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as JoinBody;
  const traceId = ensureTraceId(body.traceId);
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  if (!groupId) return errorResponse(400, 'invalid_group_id', 'groupId is required', traceId);

  let emailRaw = typeof body.email === 'string' ? body.email.trim() : '';
  const hasSessionHeader = !!request.headers?.get('x-session-id')?.trim();
  if (hasSessionHeader) {
    try {
      const session = await requireSessionFromRequest(request, traceId, { groupId });
      emailRaw = session.email;
    } catch (error) {
      if (error instanceof HttpError) return error.response;
      throw error;
    }
  }

  const validation = await validateGroupJoinAccess(groupId, emailRaw, traceId);
  if (!validation.ok) return validation.response;

  return { status: 200, jsonBody: { ok: true, traceId } };
}
