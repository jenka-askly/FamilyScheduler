import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { errorResponse } from '../lib/http/errorResponse.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { HttpError, requireSessionFromRequest } from '../lib/auth/sessions.js';
import { adjustGroupCounters, getGroupEntity, upsertGroupMember, upsertUserGroup, upsertUserProfile, type MemberKind } from '../lib/tables/entities.js';
import { resolveEmailVerifiedFromSessionKind, resolveMemberKindFromSessionKind } from '../lib/membership/memberKind.js';
import { ensureTablesReady } from '../lib/tables/withTables.js';
import { requireGroupMembership } from '../lib/tables/membership.js';
import { incrementDailyMetric } from '../lib/tables/metrics.js';
import { normalizeIdentityEmail, userKeyFromEmail } from '../lib/identity/userKey.js';

type JoinBody = { groupId?: unknown; traceId?: unknown };


const logMembershipActivation = (payload: {
  groupId: string;
  email: string;
  memberKind: MemberKind;
  emailVerified: boolean;
  sessionKind: string;
  operation: 'activate membership' | 'create membership';
  traceId: string;
  error?: unknown;
}): void => {
  console.log(JSON.stringify({
    event: payload.error ? 'GROUP_JOIN_MEMBERSHIP_UPSERT_FAILED' : 'GROUP_JOIN_MEMBERSHIP_UPSERT',
    traceId: payload.traceId,
    groupId: payload.groupId,
    email: payload.email,
    memberKind: payload.memberKind,
    emailVerified: payload.emailVerified,
    sessionKind: payload.sessionKind,
    operation: payload.operation,
    ...(payload.error ? { error: payload.error instanceof Error ? payload.error.message : String(payload.error) } : {})
  }));
};

export const resolveOrigin = (request: HttpRequest): string | null => {
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

  let session;
  try {
    session = await requireSessionFromRequest(request, traceId, { groupId });
  } catch (error) {
    if (error instanceof HttpError) return error.response;
    throw error;
  }

  await ensureTablesReady();
  const group = await getGroupEntity(groupId);
  if (!group || group.isDeleted) return errorResponse(404, 'group_not_found', 'Group not found', traceId);

  const normalizedEmail = normalizeIdentityEmail(session.email);

  if (session.kind === 'igniteGrace') {
    const userKey = userKeyFromEmail(normalizedEmail);
    const now = new Date().toISOString();
    const memberKind = resolveMemberKindFromSessionKind(session.kind);
    const emailVerified = resolveEmailVerifiedFromSessionKind(session.kind);
    const membership = await requireGroupMembership({ groupId, email: normalizedEmail, traceId, allowStatuses: ['active', 'invited'] });
    if (!membership.ok) {
      try {
        await upsertGroupMember({ partitionKey: groupId, rowKey: userKey, userKey, email: normalizedEmail, status: 'active', joinedAt: now, removedAt: undefined, updatedAt: now, memberKind, emailVerified });
        await upsertUserGroup({ partitionKey: userKey, rowKey: groupId, groupId, status: 'active', joinedAt: now, removedAt: undefined, updatedAt: now, memberKind, emailVerified });
        await adjustGroupCounters(groupId, { memberCountActive: 1 });
        await upsertUserProfile({ userKey, email: normalizedEmail, updatedAt: now, createdAt: now });
        logMembershipActivation({ traceId, groupId, email: normalizedEmail, memberKind, emailVerified, sessionKind: session.kind, operation: 'create membership' });
      } catch (error) {
        logMembershipActivation({ traceId, groupId, email: normalizedEmail, memberKind, emailVerified, sessionKind: session.kind, operation: 'create membership', error });
        throw error;
      }
    } else if (membership.member.status === 'invited') {
      try {
        await upsertGroupMember({ ...membership.member, status: 'active', joinedAt: now, removedAt: undefined, updatedAt: now, memberKind, emailVerified });
        await upsertUserGroup({ partitionKey: membership.userKey, rowKey: groupId, groupId, status: 'active', invitedAt: membership.member.invitedAt, joinedAt: now, removedAt: undefined, updatedAt: now, memberKind, emailVerified });
        await adjustGroupCounters(groupId, { memberCountInvited: -1, memberCountActive: 1 });
        await incrementDailyMetric('invitesAccepted', 1);
        await upsertUserProfile({ userKey: membership.userKey, email: normalizedEmail, updatedAt: now, createdAt: now });
        logMembershipActivation({ traceId, groupId, email: normalizedEmail, memberKind, emailVerified, sessionKind: session.kind, operation: 'activate membership' });
      } catch (error) {
        logMembershipActivation({ traceId, groupId, email: normalizedEmail, memberKind, emailVerified, sessionKind: session.kind, operation: 'activate membership', error });
        throw error;
      }
    }

    console.log(JSON.stringify({ event: 'GROUP_JOIN_NO_UPGRADE', traceId, groupId, sessionKind: session.kind }));
    return { status: 200, jsonBody: { ok: true, traceId, groupId, groupName: group.groupName, updatedAt: group.updatedAt } };
  }

  const membership = await requireGroupMembership({ groupId, email: normalizedEmail, traceId, allowStatuses: ['active', 'invited'] });
  if (!membership.ok) return membership.response;

  if (membership.member.status === 'invited') {
    const now = new Date().toISOString();
    const memberKind = resolveMemberKindFromSessionKind(session.kind);
    const emailVerified = resolveEmailVerifiedFromSessionKind(session.kind);
    try {
      await upsertGroupMember({ ...membership.member, status: 'active', joinedAt: now, removedAt: undefined, updatedAt: now, memberKind, emailVerified });
      await upsertUserGroup({ partitionKey: membership.userKey, rowKey: groupId, groupId, status: 'active', invitedAt: membership.member.invitedAt, joinedAt: now, removedAt: undefined, updatedAt: now, memberKind, emailVerified });
      await adjustGroupCounters(groupId, { memberCountInvited: -1, memberCountActive: 1 });
      await incrementDailyMetric('invitesAccepted', 1);
      await upsertUserProfile({ userKey: membership.userKey, email: normalizedEmail, updatedAt: now, createdAt: now });
      logMembershipActivation({ traceId, groupId, email: normalizedEmail, memberKind, emailVerified, sessionKind: session.kind, operation: 'activate membership' });
    } catch (error) {
      logMembershipActivation({ traceId, groupId, email: normalizedEmail, memberKind, emailVerified, sessionKind: session.kind, operation: 'activate membership', error });
      throw error;
    }
  }

  return { status: 200, jsonBody: { ok: true, traceId, groupId, groupName: group.groupName, updatedAt: group.updatedAt } };
}
