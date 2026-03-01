import { randomUUID } from 'node:crypto';
import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { errorResponse } from '../lib/http/errorResponse.js';
import { requireSessionEmail } from '../lib/auth/requireSession.js';
import { getUserProfileEntity, listGroupMembers } from '../lib/tables/entities.js';
import { requireGroupMembership } from '../lib/tables/membership.js';
import { emailVerifiedOrTrue, memberKindOrFull } from '../lib/membership/memberKind.js';
import { ensureTablesReady } from '../lib/tables/withTables.js';

type GroupMembersDeps = {
  ensureTablesReady: typeof ensureTablesReady;
  requireSessionEmail: typeof requireSessionEmail;
  requireGroupMembership: typeof requireGroupMembership;
  listGroupMembers: typeof listGroupMembers;
  getUserProfileEntity: typeof getUserProfileEntity;
};

const groupMembersDeps: GroupMembersDeps = {
  ensureTablesReady,
  requireSessionEmail,
  requireGroupMembership,
  listGroupMembers,
  getUserProfileEntity
};

export const setGroupMembersDepsForTests = (overrides: Partial<GroupMembersDeps> | null): void => {
  if (!overrides) {
    groupMembersDeps.ensureTablesReady = ensureTablesReady;
    groupMembersDeps.requireSessionEmail = requireSessionEmail;
    groupMembersDeps.requireGroupMembership = requireGroupMembership;
    groupMembersDeps.listGroupMembers = listGroupMembers;
    groupMembersDeps.getUserProfileEntity = getUserProfileEntity;
    return;
  }
  if (overrides.ensureTablesReady) groupMembersDeps.ensureTablesReady = overrides.ensureTablesReady;
  if (overrides.requireSessionEmail) groupMembersDeps.requireSessionEmail = overrides.requireSessionEmail;
  if (overrides.requireGroupMembership) groupMembersDeps.requireGroupMembership = overrides.requireGroupMembership;
  if (overrides.listGroupMembers) groupMembersDeps.listGroupMembers = overrides.listGroupMembers;
  if (overrides.getUserProfileEntity) groupMembersDeps.getUserProfileEntity = overrides.getUserProfileEntity;
};

export async function groupMembers(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = randomUUID();
  const groupId = new URL(request.url).searchParams.get('groupId')?.trim() ?? '';
  if (!groupId) return errorResponse(400, 'groupId_required', 'groupId is required', traceId);

  const session = await groupMembersDeps.requireSessionEmail(request, traceId, { groupId });
  if (!session.ok) return session.response;

  await groupMembersDeps.ensureTablesReady();
  const membership = await groupMembersDeps.requireGroupMembership({ groupId, email: session.email, traceId, allowStatuses: ['active'], endpoint: 'groupMembers' });
  if (!membership.ok) return membership.response;

  const members = await groupMembersDeps.listGroupMembers(groupId, ['active', 'invited']);
  const membersWithProfiles = await Promise.all(members.map(async (member) => ({
    member,
    profile: await groupMembersDeps.getUserProfileEntity(member.userKey)
  })));
  return {
    status: 200,
    jsonBody: {
      ok: true,
      groupId,
      members: membersWithProfiles.map(({ member, profile }) => ({
        userKey: member.userKey,
        email: member.email,
        displayName: profile?.displayName,
        status: member.status,
        invitedAt: member.invitedAt,
        joinedAt: member.joinedAt,
        removedAt: member.removedAt,
        updatedAt: member.updatedAt,
        lastSeenAtUtc: member.lastSeenAtUtc ?? null,
        memberKind: memberKindOrFull(member),
        emailVerified: emailVerifiedOrTrue(member),
        inviteEmailStatus: member.inviteEmailStatus ?? 'not_sent',
        inviteEmailLastAttemptAtUtc: member.inviteEmailLastAttemptAtUtc,
        inviteEmailFailedReason: member.inviteEmailFailedReason,
        inviteEmailProviderMessage: member.inviteEmailProviderMessage
      })),
      traceId
    }
  };
}
