import { randomBytes, randomUUID } from 'node:crypto';
import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { errorResponse } from '../lib/http/errorResponse.js';
import { HttpError, requireSessionFromRequest } from '../lib/auth/sessions.js';
import { IGNITE_DEFAULT_GRACE_SECONDS } from '../lib/ignite.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { createEmptyAppState } from '../lib/state.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';
import { requireGroupMembership } from '../lib/tables/membership.js';
import { ensureTablesReady } from '../lib/tables/withTables.js';
import { upsertGroup, upsertGroupMember, upsertUserGroup, upsertUserProfile } from '../lib/tables/entities.js';
import { normalizeIdentityEmail, userKeyFromEmail } from '../lib/identity/userKey.js';

type IgniteSpinoffBody = { sourceGroupId?: unknown; traceId?: unknown; groupName?: unknown };
const newPersonId = (): string => `P-${randomBytes(2).toString('hex').toUpperCase()}`;

export async function igniteSpinoff(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as IgniteSpinoffBody;
  const traceId = ensureTraceId(body.traceId);
  const sourceGroupId = typeof body.sourceGroupId === 'string' ? body.sourceGroupId.trim() : '';
  if (!sourceGroupId) return errorResponse(400, 'invalid_group_id', 'sourceGroupId is required', traceId);
  let sessionEmail = '';
  try {
    const session = await requireSessionFromRequest(request, traceId, { groupId: sourceGroupId });
    sessionEmail = session.email;
  } catch (error) {
    if (error instanceof HttpError) return error.response;
    throw error;
  }

  const storage = createStorageAdapter();
  let loadedA;
  try { loadedA = await storage.load(sourceGroupId); } catch (error) { if (error instanceof GroupNotFoundError) return errorResponse(404, 'group_not_found', 'Group not found', traceId); throw error; }
  await ensureTablesReady();
  const membership = await requireGroupMembership({ groupId: sourceGroupId, email: sessionEmail, traceId, allowStatuses: ['active'] });
  if (!membership.ok) return membership.response;
  const organizer = loadedA.state.people.find((person) => (person.email ?? '').trim().toLowerCase() === sessionEmail.trim().toLowerCase());

  const newGroupId = randomUUID();
  const nowISO = new Date().toISOString();
  const newGroupName = ((typeof body.groupName === 'string' ? body.groupName.trim().replace(/\s+/g, ' ') : '') || 'Breakout').slice(0, 60);
  const memberId = newPersonId();
  const normalizedEmail = normalizeIdentityEmail(sessionEmail);
  const organizerUserKey = userKeyFromEmail(normalizedEmail);

  await upsertGroup({
    partitionKey: 'group',
    rowKey: newGroupId,
    groupId: newGroupId,
    groupName: newGroupName,
    createdAt: nowISO,
    updatedAt: nowISO,
    createdByUserKey: organizerUserKey,
    isDeleted: false,
    memberCountActive: 1,
    memberCountInvited: 0,
    appointmentCountUpcoming: 0
  });
  await upsertGroupMember({ partitionKey: newGroupId, rowKey: organizerUserKey, userKey: organizerUserKey, email: normalizedEmail, status: 'active', joinedAt: nowISO, updatedAt: nowISO });
  await upsertUserGroup({ partitionKey: organizerUserKey, rowKey: newGroupId, groupId: newGroupId, status: 'active', joinedAt: nowISO, updatedAt: nowISO });
  await upsertUserProfile({ userKey: organizerUserKey, displayName: organizer?.name?.trim() || undefined, email: normalizedEmail, updatedAt: nowISO, createdAt: nowISO });

  const stateB = createEmptyAppState(newGroupId, newGroupName);
  stateB.people = [{
    personId: memberId,
    name: organizer?.name?.trim() || 'Organizer',
    email: normalizedEmail,
    status: 'active',
    createdAt: nowISO,
    timezone: organizer?.timezone ?? process.env.TZ ?? 'America/Los_Angeles',
    notes: organizer?.notes ?? '',
    cellE164: organizer?.cellE164 ?? '',
    cellDisplay: organizer?.cellDisplay ?? ''
  }];
  stateB.members = [{ memberId, email: normalizedEmail, status: 'active', joinedAt: nowISO }];
  await storage.initIfMissing(newGroupId, stateB);

  const loadedB = await storage.load(newGroupId);
  loadedB.state.ignite = { sessionId: randomUUID(), status: 'OPEN', createdAt: nowISO, createdByPersonId: memberId, graceSeconds: IGNITE_DEFAULT_GRACE_SECONDS, joinedPersonIds: [], photoUpdatedAtByPersonId: {} };
  await storage.save(newGroupId, loadedB.state, loadedB.etag);

  return { status: 200, jsonBody: { ok: true, newGroupId, groupName: loadedB.state.groupName, linkPath: `/#/g/${newGroupId}/ignite`, traceId } };
}
