import { randomBytes, randomUUID } from 'node:crypto';
import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { findActivePersonByPhone, validateJoinRequest } from '../lib/groupAuth.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { IGNITE_DEFAULT_GRACE_SECONDS } from '../lib/ignite.js';
import { ensureTraceId, logAuth } from '../lib/logging/authLogs.js';
import { createEmptyAppState } from '../lib/state.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';

type IgniteSpinoffBody = {
  sourceGroupId?: unknown;
  phone?: unknown;
  traceId?: unknown;
  groupName?: unknown;
};

const newPersonId = (): string => `P-${randomBytes(2).toString('hex').toUpperCase()}`;

export async function igniteSpinoff(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as IgniteSpinoffBody;
  const traceId = ensureTraceId(body.traceId);

  logAuth({
    component: 'igniteSpinoff',
    stage: 'request_received',
    traceId,
    hasPhone: Boolean(body.phone),
    sourceGroupId: typeof body.sourceGroupId === 'string' ? body.sourceGroupId : JSON.stringify(body.sourceGroupId ?? null)
  });

  const identityA = validateJoinRequest(body.sourceGroupId, body.phone);
  if (!identityA.ok) return { ...identityA.response, jsonBody: { ...(identityA.response.jsonBody as Record<string, unknown>), traceId } };

  const storage = createStorageAdapter();
  let loadedA;
  try {
    loadedA = await storage.load(identityA.groupId);
  } catch (error) {
    if (error instanceof GroupNotFoundError) return errorResponse(404, 'group_not_found', 'Group not found', traceId);
    throw error;
  }

  const caller = findActivePersonByPhone(loadedA.state, identityA.phoneE164);
  logAuth({ component: 'igniteSpinoff', stage: 'caller_lookup', traceId, callerFound: Boolean(caller) });
  if (!caller) return errorResponse(403, 'not_allowed', 'Not allowed', traceId);

  const newGroupId = randomUUID();
  const nowISO = new Date().toISOString();
  const newNameRaw = typeof body.groupName === 'string' ? body.groupName.trim().replace(/\s+/g, ' ') : '';
  const newGroupName = (newNameRaw || 'Breakout').slice(0, 60);

  const stateB = createEmptyAppState(newGroupId, newGroupName);
  stateB.createdAt = nowISO;
  stateB.updatedAt = nowISO;
  stateB.people = [{
    personId: newPersonId(),
    name: caller.name || 'Organizer',
    cellE164: identityA.phoneE164,
    cellDisplay: caller.cellDisplay ?? '',
    status: 'active',
    createdAt: nowISO,
    timezone: process.env.TZ ?? 'America/Los_Angeles',
    notes: ''
  }];

  await storage.initIfMissing(newGroupId, stateB);

  const sessionId = randomUUID();
  const loadedB = await storage.load(newGroupId);
  loadedB.state.ignite = {
    sessionId,
    status: 'OPEN',
    createdAt: nowISO,
    createdByPersonId: loadedB.state.people[0]?.personId ?? stateB.people[0].personId,
    graceSeconds: IGNITE_DEFAULT_GRACE_SECONDS,
    joinedPersonIds: [],
    photoUpdatedAtByPersonId: {}
  };
  await storage.save(newGroupId, loadedB.state, loadedB.etag);

  logAuth({ component: 'igniteSpinoff', stage: 'spinoff_created', traceId, newGroupId, sessionId });

  return {
    status: 200,
    jsonBody: {
      ok: true,
      newGroupId,
      groupName: loadedB.state.groupName,
      sessionId,
      linkPath: `/#/g/${newGroupId}/ignite`,
      traceId
    }
  };
}
