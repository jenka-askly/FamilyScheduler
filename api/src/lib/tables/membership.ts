import { errorResponse } from '../http/errorResponse.js';
import { normalizeIdentityEmail, userKeyFromEmail } from '../identity/userKey.js';
import {
  getGroupMemberEntity,
  getUserGroupEntity,
  upsertGroupMember,
  upsertUserGroup,
  type MembershipStatus
} from './entities.js';

const LAST_SEEN_THROTTLE_MS = 60_000;

const shouldPersistLastSeen = (lastSeenAtUtc: string | undefined, nowMs: number): boolean => {
  if (!lastSeenAtUtc) return true;
  const previousMs = Date.parse(lastSeenAtUtc);
  if (Number.isNaN(previousMs)) return true;
  return (nowMs - previousMs) >= LAST_SEEN_THROTTLE_MS;
};

type MembershipDeps = {
  getGroupMemberEntity: typeof getGroupMemberEntity;
  getUserGroupEntity: typeof getUserGroupEntity;
  upsertGroupMember: typeof upsertGroupMember;
  upsertUserGroup: typeof upsertUserGroup;
  warn: (payload: Record<string, unknown>) => void;
};

const membershipDeps: MembershipDeps = {
  getGroupMemberEntity,
  getUserGroupEntity,
  upsertGroupMember,
  upsertUserGroup,
  warn: (payload) => { console.warn(JSON.stringify(payload)); }
};

export const setMembershipDepsForTests = (overrides: Partial<MembershipDeps> | null): void => {
  if (!overrides) {
    membershipDeps.getGroupMemberEntity = getGroupMemberEntity;
    membershipDeps.getUserGroupEntity = getUserGroupEntity;
    membershipDeps.upsertGroupMember = upsertGroupMember;
    membershipDeps.upsertUserGroup = upsertUserGroup;
    membershipDeps.warn = (payload) => { console.warn(JSON.stringify(payload)); };
    return;
  }
  if (overrides.getGroupMemberEntity) membershipDeps.getGroupMemberEntity = overrides.getGroupMemberEntity;
  if (overrides.getUserGroupEntity) membershipDeps.getUserGroupEntity = overrides.getUserGroupEntity;
  if (overrides.upsertGroupMember) membershipDeps.upsertGroupMember = overrides.upsertGroupMember;
  if (overrides.upsertUserGroup) membershipDeps.upsertUserGroup = overrides.upsertUserGroup;
  if (overrides.warn) membershipDeps.warn = overrides.warn;
};

export const requireGroupMembership = async (params: { groupId: string; email: string; traceId: string; allowStatuses?: MembershipStatus[]; endpoint?: string }) => {
  const userKey = userKeyFromEmail(params.email);
  const member = await membershipDeps.getGroupMemberEntity(params.groupId, userKey);
  const allowStatuses = params.allowStatuses ?? ['active'];
  if (!member || !allowStatuses.includes(member.status)) {
    return { ok: false as const, response: errorResponse(403, 'not_allowed', 'Not allowed', params.traceId) };
  }
  const nowMs = Date.now();
  if (shouldPersistLastSeen(member.lastSeenAtUtc, nowMs)) {
    const nowUtc = new Date(nowMs).toISOString();
    try {
      const userGroup = await membershipDeps.getUserGroupEntity(userKey, params.groupId);
      await Promise.all([
        membershipDeps.upsertGroupMember({ ...member, lastSeenAtUtc: nowUtc, updatedAt: nowUtc }),
        userGroup
          ? membershipDeps.upsertUserGroup({ ...userGroup, lastSeenAtUtc: nowUtc, updatedAt: nowUtc })
          : Promise.resolve()
      ]);
      member.lastSeenAtUtc = nowUtc;
    } catch (error) {
      membershipDeps.warn({
        level: 'warn',
        message: 'membership_last_seen_touch_failed',
        traceId: params.traceId,
        groupId: params.groupId,
        userKey,
        endpoint: params.endpoint ?? 'unknown',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return { ok: true as const, member, userKey, normalizedEmail: normalizeIdentityEmail(params.email) };
};
