import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { errorResponse } from '../lib/http/errorResponse.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { requireSessionEmail } from '../lib/auth/requireSession.js';
import { ensureTablesReady } from '../lib/tables/withTables.js';
import { getGroupEntity, upsertGroup } from '../lib/tables/entities.js';
import { requireGroupMembership } from '../lib/tables/membership.js';

type GroupRenameBody = {
  groupId?: unknown;
  groupName?: unknown;
  traceId?: unknown;
};

const normalizeGroupName = (value: unknown): string => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');

export async function groupRename(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as GroupRenameBody;
  const traceId = ensureTraceId(body.traceId);
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  if (!groupId) return errorResponse(400, 'invalid_group_id', 'groupId is required', traceId);
  const session = await requireSessionEmail(request, traceId, { groupId });
  if (!session.ok) return session.response;

  const nextName = normalizeGroupName(body.groupName);
  if (!nextName) return errorResponse(400, 'bad_request', 'groupName is required', traceId);
  if (nextName.length > 60) return errorResponse(400, 'bad_request', 'groupName must be 60 characters or less', traceId);

  await ensureTablesReady();
  const caller = await requireGroupMembership({ groupId, email: session.email, traceId, allowStatuses: ['active'] });
  if (!caller.ok) return caller.response;

  const group = await getGroupEntity(groupId);
  if (!group || group.isDeleted) return errorResponse(404, 'group_not_found', 'Group not found', traceId);

  const now = new Date().toISOString();
  await upsertGroup({ ...group, groupName: nextName, updatedAt: now });

  return {
    status: 200,
    jsonBody: { ok: true, groupName: nextName, traceId }
  };
}
