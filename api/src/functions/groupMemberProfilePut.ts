import { randomUUID } from 'node:crypto';
import { type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { HttpError, requireSessionFromRequest } from '../lib/auth/sessions.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { getGroupMemberEntity, upsertUserProfile, type GroupMembersEntity } from '../lib/tables/entities.js';
import { requireGroupMembership } from '../lib/tables/membership.js';
import { ensureTablesReady } from '../lib/tables/withTables.js';

type MemberProfilePutBody = {
  groupId?: unknown;
  userKey?: unknown;
  displayName?: unknown;
};

type MemberProfilePutDeps = {
  ensureTablesReady: () => Promise<void>;
  requireSessionFromRequest: (request: HttpRequest, traceId: string, options?: { groupId?: string }) => Promise<{ email: string; sessionId: string; kind: 'full' | 'provisional' | 'igniteGrace'; scopeGroupId?: string }>; 
  requireGroupMembership: typeof requireGroupMembership;
  getGroupMemberEntity: (groupId: string, userKey: string) => Promise<GroupMembersEntity | null>;
  upsertUserProfile: typeof upsertUserProfile;
};

const deps: MemberProfilePutDeps = {
  ensureTablesReady,
  requireSessionFromRequest,
  requireGroupMembership,
  getGroupMemberEntity,
  upsertUserProfile
};

export const setGroupMemberProfilePutDepsForTests = (overrides: Partial<MemberProfilePutDeps> | null): void => {
  if (!overrides) {
    deps.ensureTablesReady = ensureTablesReady;
    deps.requireSessionFromRequest = requireSessionFromRequest;
    deps.requireGroupMembership = requireGroupMembership;
    deps.getGroupMemberEntity = getGroupMemberEntity;
    deps.upsertUserProfile = upsertUserProfile;
    return;
  }
  if (overrides.ensureTablesReady) deps.ensureTablesReady = overrides.ensureTablesReady;
  if (overrides.requireSessionFromRequest) deps.requireSessionFromRequest = overrides.requireSessionFromRequest;
  if (overrides.requireGroupMembership) deps.requireGroupMembership = overrides.requireGroupMembership;
  if (overrides.getGroupMemberEntity) deps.getGroupMemberEntity = overrides.getGroupMemberEntity;
  if (overrides.upsertUserProfile) deps.upsertUserProfile = overrides.upsertUserProfile;
};

export async function groupMemberProfilePut(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = randomUUID();
  let body: MemberProfilePutBody;
  try {
    body = await request.json() as MemberProfilePutBody;
  } catch {
    return errorResponse(400, 'invalid_body', 'Invalid request body', traceId);
  }

  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  const userKey = typeof body.userKey === 'string' ? body.userKey.trim() : '';
  const displayNameRaw = typeof body.displayName === 'string' ? body.displayName : '';
  const displayName = displayNameRaw.trim().replace(/\s+/g, ' ');

  if (!groupId) return errorResponse(400, 'invalid_group_id', 'groupId is required', traceId);
  if (!userKey) return errorResponse(400, 'invalid_user_key', 'userKey is required', traceId);
  if (!displayName) return errorResponse(400, 'invalid_display_name', 'displayName is required', traceId);
  if (displayName.length > 40) return errorResponse(400, 'invalid_display_name', 'displayName must be 40 characters or less', traceId);

  try {
    const session = await deps.requireSessionFromRequest(request, traceId, { groupId });
    await deps.ensureTablesReady();
    const caller = await deps.requireGroupMembership({ groupId, email: session.email, traceId, allowStatuses: ['active'] });
    if (!caller.ok) return caller.response;

    const targetMember = await deps.getGroupMemberEntity(groupId, userKey);
    if (!targetMember || (targetMember.status !== 'active' && targetMember.status !== 'invited')) {
      return errorResponse(404, 'member_not_found', 'Member not found', traceId);
    }

    const now = new Date().toISOString();
    await deps.upsertUserProfile({
      userKey,
      email: targetMember.email,
      displayName,
      updatedAt: now,
      createdAt: now
    });

    context.log?.('group_member_profile_put', JSON.stringify({
      route: 'group/member-profile',
      traceId,
      groupId,
      requesterEmail: session.email,
      targetUserKey: userKey,
      displayNameLength: displayName.length,
      outcome: 'ok'
    }));

    return { status: 200, jsonBody: { ok: true, traceId } };
  } catch (error) {
    if (error instanceof HttpError) return error.response;
    throw error;
  }
}

