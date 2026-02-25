import { errorResponse } from '../http/errorResponse.js';
import { normalizeIdentityEmail, userKeyFromEmail } from '../identity/userKey.js';
import { getGroupMemberEntity, type MembershipStatus } from './entities.js';

export const requireGroupMembership = async (params: { groupId: string; email: string; traceId: string; allowStatuses?: MembershipStatus[] }) => {
  const userKey = userKeyFromEmail(params.email);
  const member = await getGroupMemberEntity(params.groupId, userKey);
  const allowStatuses = params.allowStatuses ?? ['active'];
  if (!member || !allowStatuses.includes(member.status)) {
    return { ok: false as const, response: errorResponse(403, 'not_allowed', 'Not allowed', params.traceId) };
  }
  return { ok: true as const, member, userKey, normalizedEmail: normalizeIdentityEmail(params.email) };
};
