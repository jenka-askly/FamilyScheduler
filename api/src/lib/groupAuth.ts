import type { HttpRequest, HttpResponseInit } from '@azure/functions';
import { HttpError, requireSessionFromRequest } from './auth/sessions.js';
import { isPlausibleEmail, normalizeEmail } from './auth/requireMembership.js';

export const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const validateEmailIdentityRequest = (
  groupId: unknown,
  email: unknown
): { ok: true; groupId: string; email: string } | { ok: false; response: HttpResponseInit } => {
  const gid = typeof groupId === 'string' ? groupId.trim() : '';
  if (!uuidV4Pattern.test(gid)) return { ok: false, response: { status: 400, jsonBody: { error: 'invalid_group_id' } } };

  const emailValue = typeof email === 'string' ? email.trim() : '';
  if (!emailValue) return { ok: false, response: { status: 400, jsonBody: { error: 'identity_required', message: 'email is required' } } };
  if (!isPlausibleEmail(emailValue)) return { ok: false, response: { status: 400, jsonBody: { error: 'invalid_email', message: 'email is invalid' } } };

  return { ok: true, groupId: gid, email: normalizeEmail(emailValue) };
};

export const requireIdentityFromRequest = async (
  request: HttpRequest,
  traceId: string,
  options: { groupId: string; allowUnauthEmail?: boolean; body?: Record<string, unknown>; query?: URLSearchParams } = { groupId: '' }
): Promise<{ ok: true; groupId: string; email: string } | { ok: false; response: HttpResponseInit }> => {
  const groupId = typeof options.groupId === 'string' ? options.groupId.trim() : '';
  if (!uuidV4Pattern.test(groupId)) return { ok: false, response: { status: 400, jsonBody: { ok: false, error: 'invalid_group_id', message: 'groupId must be a valid UUID', traceId } } };

  const bodyEmail = typeof options.body?.email === 'string' ? options.body.email : undefined;
  const queryEmail = options.query?.get('email') ?? undefined;
  const fallbackEmail = bodyEmail ?? queryEmail;

  try {
    const session = await requireSessionFromRequest(request, traceId, { groupId });
    return { ok: true, groupId, email: session.email };
  } catch (error) {
    if (!(error instanceof HttpError)) throw error;
    if (!options.allowUnauthEmail || !fallbackEmail) return { ok: false, response: error.response };
  }

  const validated = validateEmailIdentityRequest(groupId, fallbackEmail);
  if (!validated.ok) {
    const payload = (validated.response.jsonBody as Record<string, unknown>) ?? {};
    return {
      ok: false,
      response: {
        ...validated.response,
        jsonBody: {
          ok: false,
          ...payload,
          message: typeof payload.message === 'string' ? payload.message : (payload.error === 'invalid_email' ? 'email is invalid' : 'email is required'),
          traceId
        }
      }
    };
  }
  return { ok: true, groupId, email: validated.email };
};
