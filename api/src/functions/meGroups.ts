import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'node:crypto';
import { requireSessionEmail } from '../lib/auth/requireSession.js';
import { ensureTablesReady } from '../lib/tables/withTables.js';
import { listUserGroups, getGroupEntity } from '../lib/tables/entities.js';
import { userKeyFromEmail } from '../lib/identity/userKey.js';

export async function meGroups(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = randomUUID();
  const session = await requireSessionEmail(request, traceId);
  if (!session.ok) return session.response;

  await ensureTablesReady();
  const userKey = userKeyFromEmail(session.email);
  const memberships = (await listUserGroups(userKey, 200)).filter((item) => item.status !== 'removed');

  const rows = await Promise.all(memberships.map(async (membership) => {
    const group = await getGroupEntity(membership.groupId);
    if (!group || group.isDeleted) return null;
    return {
      groupId: group.groupId,
      groupName: group.groupName,
      myStatus: membership.status,
      invitedAt: membership.invitedAt ?? null,
      joinedAt: membership.joinedAt ?? null,
      removedAt: membership.removedAt ?? null,
      updatedAt: group.updatedAt
    };
  }));

  const groups = rows.filter((item): item is NonNullable<typeof item> => Boolean(item)).sort((a, b) => {
    const rank = (status: string) => (status === 'active' ? 0 : 1);
    const byStatus = rank(a.myStatus) - rank(b.myStatus);
    if (byStatus !== 0) return byStatus;
    return a.groupName.localeCompare(b.groupName);
  });

  return { status: 200, jsonBody: { ok: true, groups, traceId } };
}
