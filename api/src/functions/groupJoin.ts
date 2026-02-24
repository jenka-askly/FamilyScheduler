import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { sendEmail } from '../lib/email/acsEmail.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { isPlausibleEmail, getEmailDomain, normalizeEmail } from '../lib/auth/requireMembership.js';

type JoinBody = { groupId?: unknown; traceId?: unknown; email?: unknown };

const resolveOrigin = (request: HttpRequest): string | null => {
  const explicit = process.env.WEB_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const origin = request.headers.get('origin');
  if (origin) return origin;
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (!forwardedHost) return null;
  return `https://${forwardedHost}`;
};

export async function groupJoin(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as JoinBody;
  const traceId = ensureTraceId(body.traceId);
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  if (!groupId) return errorResponse(400, 'invalid_group_id', 'groupId is required', traceId);

  const emailRaw = typeof body.email === 'string' ? body.email.trim() : '';
  if (!emailRaw || !isPlausibleEmail(emailRaw)) return { status: 200, jsonBody: { ok: true, emailSent: false, traceId } };
  const email = normalizeEmail(emailRaw);

  if (!process.env.AZURE_COMMUNICATION_CONNECTION_STRING || !process.env.EMAIL_SENDER_ADDRESS) {
    console.log(JSON.stringify({ event: 'email_send_skipped', reason: 'missing_env', traceId, groupId, toDomain: getEmailDomain(email) }));
    return { status: 200, jsonBody: { ok: true, emailSent: false, traceId } };
  }

  const base = resolveOrigin(request);
  if (!base) return { status: 200, jsonBody: { ok: true, emailSent: false, traceId } };
  const joinLink = `${base}/#/join?groupId=${encodeURIComponent(groupId)}&traceId=${encodeURIComponent(traceId)}`;

  try {
    await sendEmail({
      to: email,
      subject: 'Your FamilyScheduler link',
      plainText: `Use this link to join FamilyScheduler: ${joinLink}`,
      html: `<p>Use this link to join FamilyScheduler: <a href="${joinLink}">Join</a></p>`,
    });
    return { status: 200, jsonBody: { ok: true, emailSent: true, traceId } };
  } catch {
    console.log(JSON.stringify({ event: 'email_send_failure', traceId, groupId, toDomain: getEmailDomain(email) }));
    return { status: 200, jsonBody: { ok: true, emailSent: false, traceId } };
  }
}
