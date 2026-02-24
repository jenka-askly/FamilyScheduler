import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ExpiredTokenError, InvalidTokenError, verify } from '../lib/auth/magicLink.js';
import { createSession } from '../lib/auth/sessions.js';
import { MissingConfigError } from '../lib/errors/configError.js';
import { errorResponse, logConfigMissing } from '../lib/http/errorResponse.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';

type AuthConsumeLinkBody = { token?: unknown; traceId?: unknown };

const getEmailDomain = (email: string): string => {
  const [, domain = 'unknown'] = email.split('@');
  return domain.toLowerCase();
};

export async function authConsumeLink(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as AuthConsumeLinkBody;
  const traceId = ensureTraceId(body.traceId);

  const secret = process.env.MAGIC_LINK_SECRET?.trim();
  if (!secret) {
    logConfigMissing('authConsumeLink', traceId, ['MAGIC_LINK_SECRET']);
    return errorResponse(500, 'CONFIG_MISSING', 'Required configuration is missing.', traceId, { missing: ['MAGIC_LINK_SECRET'] });
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  try {
    const payload = verify(token, secret);
    const ttlRaw = process.env.SESSION_TTL_SECONDS?.trim();
    const ttl = ttlRaw ? Number(ttlRaw) : undefined;
    const session = await createSession(payload.sub, Number.isFinite(ttl) ? Math.floor(ttl as number) : undefined);
    console.log(JSON.stringify({ event: 'auth_consume_success', traceId, emailDomain: getEmailDomain(payload.sub), sessionIdPrefix: session.sessionId.slice(0, 8) }));
    return { status: 200, jsonBody: { ok: true, sessionId: session.sessionId, email: payload.sub, traceId, expiresAt: session.expiresAtISO } };
  } catch (error) {
    if (error instanceof ExpiredTokenError) {
      console.log(JSON.stringify({ event: 'auth_consume_failure', traceId, reason: 'expired_token' }));
      return { status: 400, jsonBody: { ok: false, error: 'expired_token', traceId } };
    }
    if (error instanceof InvalidTokenError) {
      console.log(JSON.stringify({ event: 'auth_consume_failure', traceId, reason: 'invalid_token' }));
      return { status: 400, jsonBody: { ok: false, error: 'invalid_token', traceId } };
    }
    if (error instanceof MissingConfigError) {
      logConfigMissing('authConsumeLink', traceId, error.missing);
      return errorResponse(500, 'CONFIG_MISSING', error.message, traceId, { missing: error.missing });
    }
    throw error;
  }
}
