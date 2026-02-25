import { randomBytes, randomUUID } from 'node:crypto';
import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { errorResponse } from '../lib/http/errorResponse.js';
import { HttpError, requireSessionFromRequest } from '../lib/auth/sessions.js';
import { requireActiveMember } from '../lib/auth/requireMembership.js';
import { IGNITE_DEFAULT_GRACE_SECONDS } from '../lib/ignite.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { createEmptyAppState } from '../lib/state.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';

type IgniteSpinoffBody = { sourceGroupId?: unknown; traceId?: unknown; groupName?: unknown };
const newPersonId = (): string => `P-${randomBytes(2).toString('hex').toUpperCase()}`;

export async function igniteSpinoff(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as IgniteSpinoffBody;
  const traceId = ensureTraceId(body.traceId);
  const sourceGroupId = typeof body.sourceGroupId === 'string' ? body.sourceGroupId.trim() : '';
  if (!sourceGroupId) return errorResponse(400, 'invalid_group_id', 'sourceGroupId is required', traceId);
  let session;
  try {
    session = await requireSessionFromRequest(request, traceId, { groupId: sourceGroupId });
  } catch (error) {
    if (error instanceof HttpError) return error.response;
    throw error;
  }

  const storage = createStorageAdapter();
  let loadedA;
  try { loadedA = await storage.load(sourceGroupId); } catch (error) { if (error instanceof GroupNotFoundError) return errorResponse(404, 'group_not_found', 'Group not found', traceId); throw error; }
  const sessionEmail = session.email.trim().toLowerCase();
  const membership = requireActiveMember(loadedA.state, sessionEmail, traceId);
  if (!membership.ok) return membership.response;
  const organizer = loadedA.state.people.find((person) => person.personId === membership.member.memberId);

  const newGroupId = randomUUID();
  const nowISO = new Date().toISOString();
  const newGroupName = ((typeof body.groupName === 'string' ? body.groupName.trim().replace(/\s+/g, ' ') : '') || 'Breakout').slice(0, 60);
  const memberId = newPersonId();

  const stateB = createEmptyAppState(newGroupId, newGroupName);
  stateB.people = [{
    personId: memberId,
    name: organizer?.name?.trim() || 'Organizer',
    email: sessionEmail,
    status: 'active',
    createdAt: nowISO,
    timezone: organizer?.timezone ?? process.env.TZ ?? 'America/Los_Angeles',
    notes: organizer?.notes ?? '',
    cellE164: organizer?.cellE164 ?? '',
    cellDisplay: organizer?.cellDisplay ?? ''
  }];
  stateB.members = [{ memberId, email: sessionEmail, status: 'active', joinedAt: nowISO }];
  await storage.initIfMissing(newGroupId, stateB);

  const loadedB = await storage.load(newGroupId);
  loadedB.state.ignite = { sessionId: randomUUID(), status: 'OPEN', createdAt: nowISO, createdByPersonId: memberId, graceSeconds: IGNITE_DEFAULT_GRACE_SECONDS, joinedPersonIds: [], photoUpdatedAtByPersonId: {} };
  await storage.save(newGroupId, loadedB.state, loadedB.etag);

  return { status: 200, jsonBody: { ok: true, newGroupId, groupName: loadedB.state.groupName, linkPath: `/#/g/${newGroupId}/ignite`, traceId } };
}
