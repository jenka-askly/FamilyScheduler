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
  const headerGetter = (request as { headers?: { get?: (name: string) => string | null } }).headers?.get;
  if (typeof headerGetter !== 'function') return null;
  const origin = headerGetter('origin');
  if (origin) return origin;
  const forwardedHost = headerGetter('x-forwarded-host');
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

const MAGIC_LINK_TTL_MINUTES = 15;

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
    logConfigMissing('authRequestLink', traceId, ['WEB_BASE_URL']);
    return errorResponse(500, 'CONFIG_MISSING', 'Required configuration is missing.', traceId, { missing: ['WEB_BASE_URL'] });
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
