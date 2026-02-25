import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { sendEmail } from '../lib/email/acsEmail.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { redactEmailForLog, resolveOrigin, validateGroupJoinAccess } from './groupJoin.js';

type JoinBody = { groupId?: unknown; traceId?: unknown; email?: unknown };

export async function groupJoinLink(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as JoinBody;
  const traceId = ensureTraceId(body.traceId);
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  if (!groupId) return errorResponse(400, 'invalid_group_id', 'groupId is required', traceId);

  const emailRaw = typeof body.email === 'string' ? body.email.trim() : '';
  const logEmail = redactEmailForLog(emailRaw);
  console.info(JSON.stringify({ event: 'group_join_link_requested', traceId, groupId, email: logEmail }));

  const validation = await validateGroupJoinAccess(groupId, emailRaw, traceId);
  if (!validation.ok) {
    console.warn(JSON.stringify({ event: 'group_join_link_denied', traceId, groupId, email: logEmail, error: validation.error }));
    return validation.response;
  }

  if (!process.env.AZURE_COMMUNICATION_CONNECTION_STRING || !process.env.EMAIL_SENDER_ADDRESS) {
    console.warn(JSON.stringify({ event: 'group_join_link_email_skipped', traceId, groupId, email: logEmail, reason: 'email_not_configured' }));
    return { status: 200, jsonBody: { ok: true, emailSent: false, reason: 'email_not_configured', traceId } };
  }

  const base = resolveOrigin(request);
  if (!base) {
    console.warn(JSON.stringify({ event: 'group_join_link_email_skipped', traceId, groupId, email: logEmail, reason: 'origin_unresolved' }));
    return { status: 200, jsonBody: { ok: true, emailSent: false, reason: 'origin_unresolved', traceId } };
  }

  const joinLink = `${base}/#/join?groupId=${encodeURIComponent(groupId)}&traceId=${encodeURIComponent(traceId)}`;

  try {
    await sendEmail({
      to: validation.email,
      subject: 'Your FamilyScheduler link',
      plainText: `Use this link to join FamilyScheduler: ${joinLink}`,
      html: `<p>Use this link to join FamilyScheduler: <a href="${joinLink}">Join</a></p>`,
    });
    console.info(JSON.stringify({ event: 'group_join_link_email_sent', traceId, groupId, email: logEmail, provider: 'acs' }));
    return { status: 200, jsonBody: { ok: true, emailSent: true, provider: 'acs', traceId } };
  } catch {
    console.warn(JSON.stringify({ event: 'group_join_link_email_failed', traceId, groupId, email: logEmail, error: 'join_failed' }));
    return errorResponse(500, 'join_failed', 'Join failed', traceId);
  }
}
