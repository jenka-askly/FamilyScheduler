import { randomUUID } from 'node:crypto';
import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { sendEmail } from '../lib/email/acsEmail.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { sign, type MagicLinkPayload } from '../lib/auth/magicLink.js';

type AuthRequestLinkBody = { email?: unknown; traceId?: unknown; returnTo?: unknown; attemptId?: unknown };

const isSafeReturnTo = (value: string): boolean => value.startsWith('/') && !value.startsWith('//') && !value.includes('://');

const toSafeReturnTo = (value: unknown): string => {
  if (typeof value !== 'string') return '/';
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200 || !isSafeReturnTo(trimmed)) return '/';
  return trimmed;
};

const toAttemptId = (value: unknown): string => {
  if (typeof value !== 'string') return randomUUID();
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 120) return randomUUID();
  return trimmed;
};

const resolveOrigin = (request: HttpRequest): string | null => {
  const headerGetter = (request as { headers?: { get?: (name: string) => string | null } }).headers?.get;
  if (typeof headerGetter !== 'function') return null;
  try {
    const origin = headerGetter('origin');
    if (origin) return origin;
    const forwardedHost = headerGetter('x-forwarded-host');
    if (!forwardedHost) return null;
    return `https://${forwardedHost}`;
  } catch {
    return null;
  }
};

const getEmailDomain = (email: string): string => {
  const [, domain = 'unknown'] = email.split('@');
  return domain.toLowerCase();
};

const isPlausibleEmail = (email: string): boolean => {
  const trimmed = email.trim();
  const atIdx = trimmed.indexOf('@');
  if (atIdx <= 0) return false;
  const domain = trimmed.slice(atIdx + 1);
  return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.');
};

const MAGIC_LINK_TTL_MINUTES = 15;

const requiredConfigMissing = (): string[] => {
  const required = ['MAGIC_LINK_SECRET', 'AZURE_COMMUNICATION_CONNECTION_STRING', 'EMAIL_SENDER_ADDRESS'] as const;
  return required.filter((key) => !process.env[key] || !process.env[key]?.trim()) as string[];
};

const failureResponse = (
  status: number,
  traceId: string,
  error: string,
  code: string,
  extra: Record<string, unknown> = {}
): HttpResponseInit => ({ status, jsonBody: { ok: false, error, code, traceId, ...extra } });

const logFailure = (
  traceId: string,
  code: string,
  extra: { missing?: string[]; message?: string } = {},
  error?: unknown
): void => {
  const err = error instanceof Error ? error : undefined;
  console.error(JSON.stringify({
    event: 'auth_request_link_failed',
    traceId,
    code,
    ...extra,
    stack: err?.stack
  }));
};

export async function authRequestLink(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  let traceId = ensureTraceId(undefined);
  try {
    let body: AuthRequestLinkBody;
    try {
      body = await request.json() as AuthRequestLinkBody;
    } catch (error) {
      logFailure(traceId, 'BAD_JSON', { message: 'Request body must be valid JSON.' }, error);
      return failureResponse(400, traceId, 'bad_request', 'BAD_JSON');
    }

    traceId = ensureTraceId(body.traceId);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    const missing = requiredConfigMissing();
    if (missing.length > 0) {
      logFailure(traceId, 'CONFIG_MISSING', { missing: [...missing].sort() });
      return failureResponse(500, traceId, 'config_missing', 'CONFIG_MISSING', { missing: [...missing].sort() });
    }

    if (!isPlausibleEmail(email)) {
      console.log(JSON.stringify({ event: 'auth_link_skipped_invalid_email', traceId }));
      return { status: 200, jsonBody: { ok: true, traceId } };
    }

    const secret = process.env.MAGIC_LINK_SECRET!.trim();
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (MAGIC_LINK_TTL_MINUTES * 60);
    const returnTo = toSafeReturnTo(body.returnTo);
    const attemptId = toAttemptId(body.attemptId);

    const payload: MagicLinkPayload = {
      v: 1,
      sub: email,
      jti: randomUUID(),
      purpose: 'login',
      iat: now,
      exp,
      returnTo
    };

    const token = sign(payload, secret);
    const base = process.env.WEB_BASE_URL?.trim() || resolveOrigin(request);
    if (!base) {
      logFailure(traceId, 'CONFIG_MISSING', { missing: ['WEB_BASE_URL'] });
      return failureResponse(500, traceId, 'config_missing', 'CONFIG_MISSING', { missing: ['WEB_BASE_URL'] });
    }

    const link = `${base}/#/auth/consume?token=${encodeURIComponent(token)}&attemptId=${encodeURIComponent(attemptId)}&returnTo=${encodeURIComponent(returnTo)}`;
    console.log(JSON.stringify({ event: 'auth_link_attempt', traceId, toDomain: getEmailDomain(email), sender: process.env.EMAIL_SENDER_ADDRESS }));

    try {
      const providerResult = await sendEmail({
        to: email,
        subject: 'Sign in to FamilyScheduler',
        plainText: `Sign in to FamilyScheduler\n\nYou requested a secure sign-in link.\n\nSign in: ${link}\n\nIf the button does not work, copy and paste this link into your browser:\n${link}\n\nIf you didn’t request this, ignore this email.\nThis link expires in ${MAGIC_LINK_TTL_MINUTES} minutes.`,
        html: `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5"><h2 style="margin:0 0 12px">Sign in to FamilyScheduler</h2><p style="margin:0 0 16px">You requested a secure sign-in link.</p><p style="margin:0 0 20px"><a href="${link}" style="display:inline-block;background:#1f6feb;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">Sign in</a></p><p style="margin:0 0 8px;font-size:14px">If the button does not work, use this link:</p><p style="margin:0 0 16px;word-break:break-all;font-size:14px"><a href="${link}">${link}</a></p><p style="margin:0 0 4px;font-size:13px;color:#444">If you didn’t request this, ignore this email.</p><p style="margin:0;font-size:13px;color:#444">This link expires in ${MAGIC_LINK_TTL_MINUTES} minutes.</p></div>`
      });
      console.log(JSON.stringify({ event: 'auth_link_success', traceId, operationId: providerResult.id }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send auth email.';
      logFailure(traceId, 'EMAIL_SEND_FAILED', { message }, error);
      return failureResponse(502, traceId, 'email_send_failed', 'EMAIL_SEND_FAILED', { message });
    }

    return { status: 200, jsonBody: { ok: true, traceId } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unhandled auth request-link failure.';
    logFailure(traceId, 'UNEXPECTED_ERROR', { message }, error);
    return failureResponse(500, traceId, 'internal_error', 'UNEXPECTED_ERROR', { message });
  }
}
