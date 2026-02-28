import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireSessionEmail, type SessionResult } from '../lib/auth/requireSession.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { type GroupEntity, getGroupEntity, restoreGroupById } from '../lib/tables/entities.js';
import { requireGroupMembership } from '../lib/tables/membership.js';
import { ensureTablesReady } from '../lib/tables/withTables.js';

type GroupRestoreBody = {
  groupId?: unknown;
  traceId?: unknown;
};

type GroupRestoreDeps = {
  requireSessionEmail: (request: HttpRequest, traceId: string, options?: { groupId?: string }) => Promise<SessionResult>;
  ensureTablesReady: () => Promise<void>;
  requireGroupMembership: typeof requireGroupMembership;
  getGroupEntity: (groupId: string) => Promise<GroupEntity | null>;
  restoreGroupById: (group: GroupEntity, restoredAt: string) => Promise<void>;
};

const groupRestoreDeps: GroupRestoreDeps = {
  requireSessionEmail,
  ensureTablesReady,
  requireGroupMembership,
  getGroupEntity,
  restoreGroupById
};

export const setGroupRestoreDepsForTests = (overrides: Partial<GroupRestoreDeps> | null): void => {
  if (!overrides) {
    groupRestoreDeps.requireSessionEmail = requireSessionEmail;
    groupRestoreDeps.ensureTablesReady = ensureTablesReady;
    groupRestoreDeps.requireGroupMembership = requireGroupMembership;
    groupRestoreDeps.getGroupEntity = getGroupEntity;
    groupRestoreDeps.restoreGroupById = restoreGroupById;
    return;
  }
  if (overrides.requireSessionEmail) groupRestoreDeps.requireSessionEmail = overrides.requireSessionEmail;
  if (overrides.ensureTablesReady) groupRestoreDeps.ensureTablesReady = overrides.ensureTablesReady;
  if (overrides.requireGroupMembership) groupRestoreDeps.requireGroupMembership = overrides.requireGroupMembership;
  if (overrides.getGroupEntity) groupRestoreDeps.getGroupEntity = overrides.getGroupEntity;
  if (overrides.restoreGroupById) groupRestoreDeps.restoreGroupById = overrides.restoreGroupById;
};

export async function groupRestore(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as GroupRestoreBody;
  const traceId = ensureTraceId(body.traceId);
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  if (!groupId) return errorResponse(400, 'invalid_group_id', 'groupId is required', traceId);

  const session = await groupRestoreDeps.requireSessionEmail(request, traceId, { groupId });
  if (!session.ok) return session.response;

  await groupRestoreDeps.ensureTablesReady();
  const caller = await groupRestoreDeps.requireGroupMembership({ groupId, email: session.email, traceId, allowStatuses: ['active'] });
  if (!caller.ok) return caller.response;

  const group = await groupRestoreDeps.getGroupEntity(groupId);
  if (!group) {
    return {
      status: 200,
      jsonBody: { ok: false, message: 'Group not found', traceId }
    };
  }

  if (!group.isDeleted) {
    return {
      status: 200,
      jsonBody: { ok: true, message: 'Already active', traceId }
    };
  }

  const restoredAt = new Date().toISOString();
  await groupRestoreDeps.restoreGroupById(group, restoredAt);

  return {
    status: 200,
    jsonBody: { ok: true, traceId }
  };
}
