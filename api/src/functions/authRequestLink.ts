import { randomUUID } from 'node:crypto';
import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { sendEmail } from '../lib/email/acsEmail.js';
import { errorResponse, logConfigMissing } from '../lib/http/errorResponse.js';
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
  const origin = request.headers.get('origin');
  if (origin) return origin;
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (!forwardedHost) return null;
  return `https://${forwardedHost}`;
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

const requiredConfigMissing = (): string[] => {
  const required = ['MAGIC_LINK_SECRET', 'AZURE_COMMUNICATION_CONNECTION_STRING', 'EMAIL_SENDER_ADDRESS'] as const;
  return required.filter((key) => !process.env[key] || !process.env[key]?.trim()) as string[];
};

export async function authRequestLink(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as AuthRequestLinkBody;
  const traceId = ensureTraceId(body.traceId);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  const missing = requiredConfigMissing();
  if (missing.length > 0) {
    logConfigMissing('authRequestLink', traceId, missing);
    return errorResponse(500, 'CONFIG_MISSING', 'Required configuration is missing.', traceId, { missing });
  }

  if (!isPlausibleEmail(email)) {
    console.log(JSON.stringify({ event: 'auth_link_skipped_invalid_email', traceId }));
    return { status: 200, jsonBody: { ok: true, traceId } };
  }

  const secret = process.env.MAGIC_LINK_SECRET!.trim();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (15 * 60);
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
    logConfigMissing('authRequestLink', traceId, ['WEB_BASE_URL']);
    return errorResponse(500, 'CONFIG_MISSING', 'Required configuration is missing.', traceId, { missing: ['WEB_BASE_URL'] });
  }

  const link = `${base}/#/auth/consume?token=${encodeURIComponent(token)}&attemptId=${encodeURIComponent(attemptId)}&returnTo=${encodeURIComponent(returnTo)}`;
  console.log(JSON.stringify({ event: 'auth_link_attempt', traceId, toDomain: getEmailDomain(email), sender: process.env.EMAIL_SENDER_ADDRESS }));

  try {
    const providerResult = await sendEmail({
      to: email,
      subject: 'Sign in to Family Scheduler',
      plainText: `Click to sign in to Family Scheduler:\n${link}\n\nIf you don’t see this email, check your Junk/Spam folder.`,
      html: `<p>Click to sign in to Family Scheduler: <a href="${link}">Sign in</a></p><p>If you don’t see this email, check your Junk/Spam folder.</p>`
    });
    console.log(JSON.stringify({ event: 'auth_link_success', traceId, operationId: providerResult.id }));
  } catch (error) {
    const details = error as { statusCode?: number; code?: string; response?: { body?: { error?: { code?: string } } } };
    console.log(JSON.stringify({
      event: 'auth_link_failure',
      traceId,
      providerCode: details?.response?.body?.error?.code ?? details?.code,
      statusCode: details?.statusCode
    }));
  }

  return { status: 200, jsonBody: { ok: true, traceId } };
}
