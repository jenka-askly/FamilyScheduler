import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { sendEmail } from '../lib/email/acsEmail.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { HttpError, requireSessionFromRequest } from '../lib/auth/sessions.js';
import { normalizeIdentityEmail, userKeyFromEmail } from '../lib/identity/userKey.js';
import { adjustGroupCounters, getGroupEntity, getGroupMemberEntity, upsertGroupMember, upsertUserGroup } from '../lib/tables/entities.js';
import { ensureTablesReady } from '../lib/tables/withTables.js';
import { requireGroupMembership } from '../lib/tables/membership.js';
import { incrementDailyMetric } from '../lib/tables/metrics.js';
import { isPlausibleEmail } from '../lib/auth/requireMembership.js';
import { resolveOrigin } from './groupJoin.js';

type JoinBody = { groupId?: unknown; traceId?: unknown; email?: unknown };

const redactEmailForLog = (email: string): string => {
  const normalized = normalizeIdentityEmail(email);
  const [local = '', domain = 'unknown'] = normalized.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
};

export async function groupJoinLink(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as JoinBody;
  const traceId = ensureTraceId(body.traceId);
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  if (!groupId) return errorResponse(400, 'invalid_group_id', 'groupId is required', traceId);

  const inviteeEmailRaw = typeof body.email === 'string' ? body.email.trim() : '';
  if (!isPlausibleEmail(inviteeEmailRaw)) return errorResponse(400, 'invalid_email', 'email is invalid', traceId);

  let session;
  try {
    session = await requireSessionFromRequest(request, traceId, { groupId });
  } catch (error) {
    if (error instanceof HttpError) return error.response;
    throw error;
  }

  await ensureTablesReady();
  const inviter = await requireGroupMembership({ groupId, email: session.email, traceId, allowStatuses: ['active'] });
  if (!inviter.ok) return inviter.response;

  const group = await getGroupEntity(groupId);
  if (!group || group.isDeleted) return errorResponse(404, 'group_not_found', 'Group not found', traceId);

  const inviteeEmail = normalizeIdentityEmail(inviteeEmailRaw);
  const inviteeUserKey = userKeyFromEmail(inviteeEmail);
  const now = new Date().toISOString();
  const existingInvitee = await getGroupMemberEntity(groupId, inviteeUserKey);
  if (existingInvitee?.status === 'active') return errorResponse(409, 'already_member', 'User is already active in this group', traceId);

  await upsertGroupMember({ partitionKey: groupId, rowKey: inviteeUserKey, userKey: inviteeUserKey, email: inviteeEmail, status: 'invited', invitedAt: now, updatedAt: now, joinedAt: undefined, removedAt: undefined });
  await upsertUserGroup({ partitionKey: inviteeUserKey, rowKey: groupId, groupId, status: 'invited', invitedAt: now, updatedAt: now, joinedAt: undefined, removedAt: undefined });
  if (!existingInvitee || existingInvitee.status === 'removed') {
    await adjustGroupCounters(groupId, { memberCountInvited: 1 });
  }
  await incrementDailyMetric('invitesSent', 1);

  const logEmail = redactEmailForLog(inviteeEmail);
  if (!process.env.AZURE_COMMUNICATION_CONNECTION_STRING || !process.env.EMAIL_SENDER_ADDRESS) {
    console.warn(JSON.stringify({ event: 'group_join_link_email_skipped', traceId, groupId, email: logEmail, reason: 'email_not_configured' }));
    return { status: 200, jsonBody: { ok: true, emailSent: false, reason: 'email_not_configured', traceId } };
  }

  const base = resolveOrigin(request);
  if (!base) return { status: 200, jsonBody: { ok: true, emailSent: false, reason: 'origin_unresolved', traceId } };

  const joinLink = `${base}/#/join?groupId=${encodeURIComponent(groupId)}&traceId=${encodeURIComponent(traceId)}`;

  try {
    await sendEmail({
      to: inviteeEmail,
      subject: 'Your FamilyScheduler link',
      plainText: `Use this link to join FamilyScheduler: ${joinLink}`,
      html: `<p>Use this link to join FamilyScheduler: <a href="${joinLink}">Join</a></p>`,
    });
    return { status: 200, jsonBody: { ok: true, emailSent: true, provider: 'acs', traceId } };
  } catch {
    return errorResponse(500, 'join_failed', 'Join failed', traceId);
  }
}
