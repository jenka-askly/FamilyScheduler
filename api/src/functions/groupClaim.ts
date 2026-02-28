import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { getSessionWithStatus, HttpError, requireSessionFromRequest } from '../lib/auth/sessions.js';
import { adjustGroupCounters, getGroupEntity, upsertGroupMember, upsertUserGroup } from '../lib/tables/entities.js';
import { ensureTablesReady } from '../lib/tables/withTables.js';
import { requireGroupMembership } from '../lib/tables/membership.js';
import { userKeyFromEmail } from '../lib/identity/userKey.js';

type ClaimBody = { groupId?: unknown; graceSessionId?: unknown; traceId?: unknown };

const prefix = (value: string): string => value.slice(0, 8);

export async function groupClaim(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as ClaimBody;
  const traceId = ensureTraceId(body.traceId);
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  const graceSessionId = typeof body.graceSessionId === 'string' ? body.graceSessionId.trim() : '';

  if (!groupId) return errorResponse(400, 'invalid_group_id', 'groupId is required', traceId);
  if (!graceSessionId) return errorResponse(400, 'invalid_grace_session_id', 'graceSessionId is required', traceId);

  let dsidSession;
  try {
    dsidSession = await requireSessionFromRequest(request, traceId, { groupId });
  } catch (error) {
    if (error instanceof HttpError) return error.response;
    throw error;
  }

  console.log(JSON.stringify({ event: 'CLAIM_START', traceId, groupId, dsidPrefix: prefix(dsidSession.sessionId), gracePrefix: prefix(graceSessionId) }));

  const graceSession = await getSessionWithStatus(graceSessionId);
  if (!graceSession.ok) {
    console.log(JSON.stringify({ event: 'CLAIM_FAIL_INVALID_GRACE', traceId, groupId, reason: graceSession.code, gracePrefix: prefix(graceSessionId) }));
    return errorResponse(401, 'invalid_grace_session', 'Grace session is invalid', traceId);
  }
  if (graceSession.kind !== 'igniteGrace') {
    console.log(JSON.stringify({ event: 'CLAIM_FAIL_WRONG_KIND', traceId, groupId, gracePrefix: prefix(graceSessionId), kind: graceSession.kind }));
    return errorResponse(403, 'grace_session_kind_invalid', 'Grace session kind invalid', traceId);
  }
  if (graceSession.scopeGroupId !== groupId) {
    console.log(JSON.stringify({ event: 'CLAIM_FAIL_SCOPE_GROUP', traceId, groupId, gracePrefix: prefix(graceSessionId), scopeGroupId: graceSession.scopeGroupId ?? null }));
    return errorResponse(403, 'grace_session_scope_mismatch', 'Grace session scope mismatch', traceId);
  }

  await ensureTablesReady();
  const group = await getGroupEntity(groupId);
  if (!group || group.isDeleted) {
    console.log(JSON.stringify({ event: 'CLAIM_FAIL_GROUP_NOT_FOUND', traceId, groupId }));
    return errorResponse(404, 'group_not_found', 'Group not found', traceId);
  }

  const membership = await requireGroupMembership({ groupId, email: dsidSession.email, traceId, allowStatuses: ['active', 'invited'] });
  if (!membership.ok) {
    const userKey = userKeyFromEmail(dsidSession.email);
    const now = new Date().toISOString();
    await upsertGroupMember({ partitionKey: groupId, rowKey: userKey, userKey, email: dsidSession.email, status: 'active', joinedAt: now, removedAt: undefined, updatedAt: now });
    await upsertUserGroup({ partitionKey: userKey, rowKey: groupId, groupId, status: 'active', joinedAt: now, removedAt: undefined, updatedAt: now });
    await adjustGroupCounters(groupId, { memberCountActive: 1 });
  } else if (membership.member.status === 'invited') {
    const now = new Date().toISOString();
    await upsertGroupMember({ ...membership.member, status: 'active', joinedAt: now, removedAt: undefined, updatedAt: now });
    await upsertUserGroup({ partitionKey: membership.userKey, rowKey: groupId, groupId, status: 'active', invitedAt: membership.member.invitedAt, joinedAt: now, removedAt: undefined, updatedAt: now });
    await adjustGroupCounters(groupId, { memberCountInvited: -1, memberCountActive: 1 });
  }

  console.log(JSON.stringify({ event: 'CLAIM_OK', traceId, groupId, dsidPrefix: prefix(dsidSession.sessionId), gracePrefix: prefix(graceSessionId) }));
  return { status: 200, jsonBody: { ok: true, traceId } };
}
