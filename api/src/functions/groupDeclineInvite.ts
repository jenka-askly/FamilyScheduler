import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'node:crypto';
import { requireSessionEmail } from '../lib/auth/requireSession.js';
import { ensureTablesReady } from '../lib/tables/withTables.js';
import { getGroupMemberEntity, getUserGroupEntity, upsertGroupMember, upsertUserGroup, adjustGroupCounters } from '../lib/tables/entities.js';
import { userKeyFromEmail } from '../lib/identity/userKey.js';

export async function groupDeclineInvite(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = randomUUID();
  const session = await requireSessionEmail(request, traceId);
  if (!session.ok) return session.response;

  const body = await request.json() as { groupId?: unknown };
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  if (!groupId) return { status: 400, jsonBody: { ok: false, error: 'invalid_group_id', message: 'groupId is required', traceId } };

  await ensureTablesReady();
  const userKey = userKeyFromEmail(session.email);
  const [member, userGroup] = await Promise.all([
    getGroupMemberEntity(groupId, userKey),
    getUserGroupEntity(userKey, groupId)
  ]);
  if (!member || !userGroup) return { status: 404, jsonBody: { ok: false, error: 'not_found', message: 'Membership not found', traceId } };

  const previousStatus = userGroup.status;
  const now = new Date().toISOString();
  await Promise.all([
    upsertUserGroup({ ...userGroup, status: 'removed', removedAt: now, updatedAt: now }),
    upsertGroupMember({ ...member, status: 'removed', removedAt: now, updatedAt: now })
  ]);

  if (previousStatus === 'invited') {
    await adjustGroupCounters(groupId, { memberCountInvited: -1 });
  } else if (previousStatus === 'active') {
    await adjustGroupCounters(groupId, { memberCountActive: -1 });
  }

  return { status: 200, jsonBody: { ok: true, traceId } };
}
