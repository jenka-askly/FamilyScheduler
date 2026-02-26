import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireSessionEmail } from '../lib/auth/requireSession.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { userKeyFromEmail } from '../lib/identity/userKey.js';
import { getGroupEntity, purgeAfterAt, upsertGroup } from '../lib/tables/entities.js';
import { requireGroupMembership } from '../lib/tables/membership.js';
import { ensureTablesReady } from '../lib/tables/withTables.js';

type GroupDeleteBody = {
  groupId?: unknown;
  traceId?: unknown;
};

export async function groupDelete(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as GroupDeleteBody;
  const traceId = ensureTraceId(body.traceId);
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  if (!groupId) return errorResponse(400, 'invalid_group_id', 'groupId is required', traceId);

  const session = await requireSessionEmail(request, traceId, { groupId });
  if (!session.ok) return session.response;

  await ensureTablesReady();
  const caller = await requireGroupMembership({ groupId, email: session.email, traceId, allowStatuses: ['active'] });
  if (!caller.ok) return caller.response;

  const group = await getGroupEntity(groupId);
  if (!group) return errorResponse(404, 'group_not_found', 'Group not found', traceId);

  const deletedAt = group.deletedAt || new Date().toISOString();
  if (!group.isDeleted) {
    await upsertGroup({
      ...group,
      isDeleted: true,
      deletedAt,
      deletedByUserKey: userKeyFromEmail(session.email),
      purgeAfterAt: purgeAfterAt(deletedAt),
      updatedAt: deletedAt
    });
  }

  return {
    status: 200,
    jsonBody: { ok: true, traceId, groupId, deletedAt }
  };
}
