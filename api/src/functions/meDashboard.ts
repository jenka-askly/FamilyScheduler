import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'node:crypto';
import { requireSessionEmail } from '../lib/auth/requireSession.js';
import { ensureTablesReady } from '../lib/tables/withTables.js';
import { listUserGroups, listActiveGroups } from '../lib/tables/entities.js';
import { userKeyFromEmail } from '../lib/identity/userKey.js';
import { readUserDailyUsage } from '../lib/usage/usageTables.js';
import { getMonthToDateSummary } from '../lib/tables/metrics.js';

type RecentItem = {
  type: 'invite' | 'group';
  label: string;
  groupId?: string;
  status?: 'invited' | 'active';
  timestamp: string;
  actions: string[];
};

export async function meDashboard(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = randomUUID();
  const session = await requireSessionEmail(request, traceId);
  if (!session.ok) return session.response;

  await ensureTablesReady();
  const userKey = userKeyFromEmail(session.email);
  const [memberships, groups, usageToday, monthSummary] = await Promise.all([
    listUserGroups(userKey, 200),
    listActiveGroups(),
    readUserDailyUsage(userKey, new Date().toISOString().slice(0, 10)),
    getMonthToDateSummary(new Date().toISOString().slice(0, 7))
  ]);

  const groupById = new Map(groups.map((g) => [g.groupId, g]));

  const normalizedGroups = memberships
    .filter((item) => item.status !== 'removed')
    .map((membership) => {
      const group = groupById.get(membership.groupId);
      if (!group || group.isDeleted) return null;
      return {
        groupId: group.groupId,
        groupName: group.groupName,
        myStatus: membership.status,
        invitedAt: membership.invitedAt ?? null,
        joinedAt: membership.joinedAt ?? null,
        removedAt: membership.removedAt ?? null,
        updatedAt: group.updatedAt,
        memberCountActive: group.memberCountActive ?? 0,
        memberCountInvited: group.memberCountInvited ?? 0,
        appointmentCountUpcoming: group.appointmentCountUpcoming ?? 0
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => {
      const rank = (status: string) => (status === 'active' ? 0 : 1);
      const byStatus = rank(a.myStatus) - rank(b.myStatus);
      if (byStatus !== 0) return byStatus;
      return a.groupName.localeCompare(b.groupName);
    });

  const recentInvites: RecentItem[] = normalizedGroups
    .filter((group) => group.myStatus === 'invited' && group.invitedAt)
    .sort((a, b) => Date.parse(b.invitedAt ?? '') - Date.parse(a.invitedAt ?? ''))
    .map((group) => ({
      type: 'invite',
      label: `Invitation to ${group.groupName}`,
      groupId: group.groupId,
      status: 'invited',
      timestamp: group.invitedAt ?? group.updatedAt,
      actions: ['accept', 'decline']
    }));

  const recentActive: RecentItem[] = normalizedGroups
    .filter((group) => group.myStatus === 'active')
    .sort((a, b) => {
      const aTs = Date.parse(a.joinedAt ?? a.updatedAt);
      const bTs = Date.parse(b.joinedAt ?? b.updatedAt);
      return bTs - aTs;
    })
    .map((group) => ({
      type: 'group',
      label: group.groupName,
      groupId: group.groupId,
      status: 'active',
      timestamp: group.joinedAt ?? group.updatedAt,
      actions: ['resume', 'open']
    }));

  const recent = [...recentInvites, ...recentActive].slice(0, 3);

  return {
    status: 200,
    jsonBody: {
      traceId,
      groups: normalizedGroups,
      recent,
      usageToday,
      monthSummary,
      health: { ok: true, time: new Date().toISOString() }
    }
  };
}
