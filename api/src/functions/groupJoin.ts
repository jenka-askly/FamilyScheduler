import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { errorResponse } from '../lib/http/errorResponse.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { HttpError, requireSessionFromRequest } from '../lib/auth/sessions.js';
import { getGroupEntity, upsertGroupMember, upsertUserGroup } from '../lib/tables/entities.js';
import { ensureTablesReady } from '../lib/tables/withTables.js';
import { requireGroupMembership } from '../lib/tables/membership.js';
import { incrementDailyMetric } from '../lib/tables/metrics.js';

type JoinBody = { groupId?: unknown; traceId?: unknown };

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

  const membership = await requireGroupMembership({ groupId, email: session.email, traceId, allowStatuses: ['active', 'invited'] });
  if (!membership.ok) return membership.response;

  if (membership.member.status === 'invited') {
    const now = new Date().toISOString();
    await upsertGroupMember({ ...membership.member, status: 'active', joinedAt: now, removedAt: undefined, updatedAt: now });
    await upsertUserGroup({ partitionKey: membership.userKey, rowKey: groupId, groupId, status: 'active', invitedAt: membership.member.invitedAt, joinedAt: now, removedAt: undefined, updatedAt: now });
    await incrementDailyMetric('invitesAccepted', 1);
  }

  return { status: 200, jsonBody: { ok: true, traceId, groupId, groupName: group.groupName, updatedAt: group.updatedAt } };
}
