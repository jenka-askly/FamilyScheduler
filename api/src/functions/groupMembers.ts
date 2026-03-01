import { randomUUID } from 'node:crypto';
import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { errorResponse } from '../lib/http/errorResponse.js';
import { requireSessionEmail } from '../lib/auth/requireSession.js';
import { getUserProfileEntity, listGroupMembers } from '../lib/tables/entities.js';
import { requireGroupMembership } from '../lib/tables/membership.js';
import { emailVerifiedOrTrue, memberKindOrFull } from '../lib/membership/memberKind.js';
import { ensureTablesReady } from '../lib/tables/withTables.js';

export async function groupMembers(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = randomUUID();
  const groupId = new URL(request.url).searchParams.get('groupId')?.trim() ?? '';
  if (!groupId) return errorResponse(400, 'groupId_required', 'groupId is required', traceId);

  const session = await requireSessionEmail(request, traceId, { groupId });
  if (!session.ok) return session.response;

  await ensureTablesReady();
  const membership = await requireGroupMembership({ groupId, email: session.email, traceId, allowStatuses: ['active'] });
  if (!membership.ok) return membership.response;

  const members = await listGroupMembers(groupId, ['active', 'invited']);
  const membersWithProfiles = await Promise.all(members.map(async (member) => ({
    member,
    profile: await getUserProfileEntity(member.userKey)
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
        memberKind: memberKindOrFull(member),
        emailVerified: emailVerifiedOrTrue(member)
      })),
      traceId
    }
  };
}
