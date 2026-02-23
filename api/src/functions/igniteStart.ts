import { randomUUID } from 'node:crypto';
import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { findActivePersonByPhone, validateJoinRequest } from '../lib/groupAuth.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { ensureTraceId, logAuth } from '../lib/logging/authLogs.js';
import { IGNITE_DEFAULT_GRACE_SECONDS } from '../lib/ignite.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';

type IgniteStartBody = { groupId?: unknown; phone?: unknown; traceId?: unknown };

export async function igniteStart(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as IgniteStartBody;
  const traceId = ensureTraceId(body.traceId);
  logAuth({ component: 'igniteStart', stage: 'request_received', traceId, hasPhone: Boolean(body.phone), rawGroupId: typeof body.groupId === 'string' ? body.groupId : JSON.stringify(body.groupId ?? null) });

  const identity = validateJoinRequest(body.groupId, body.phone);
  if (!identity.ok) return { ...identity.response, jsonBody: { ...(identity.response.jsonBody as Record<string, unknown>), traceId } };

  logAuth({ component: 'igniteStart', stage: 'identity_validated', traceId, groupId: identity.groupId, phoneE164: identity.phoneE164 });

  const storage = createStorageAdapter();
  let loaded;
  try {
    loaded = await storage.load(identity.groupId);
  } catch (error) {
    if (error instanceof GroupNotFoundError) return errorResponse(404, 'group_not_found', 'Group not found', traceId);
    throw error;
  }

  const caller = findActivePersonByPhone(loaded.state, identity.phoneE164);
  logAuth({ component: 'igniteStart', stage: 'caller_lookup', traceId, callerFound: Boolean(caller), callerPersonId: caller?.personId ?? null });
  if (!caller) return errorResponse(403, 'not_allowed', 'Not allowed', traceId);

  const activeIgnite = loaded.state.ignite;
  if (activeIgnite && (activeIgnite.status === 'OPEN' || activeIgnite.status === 'CLOSING') && activeIgnite.createdByPersonId !== caller.personId) {
    return errorResponse(403, 'not_allowed', 'Not allowed', traceId);
  }

  const nowISO = new Date().toISOString();
  const sessionId = randomUUID();
  loaded.state.ignite = {
    sessionId,
    status: 'OPEN',
    createdAt: nowISO,
    createdByPersonId: caller.personId,
    graceSeconds: IGNITE_DEFAULT_GRACE_SECONDS,
    joinedPersonIds: [],
    photoUpdatedAtByPersonId: {}
  };

  await storage.save(identity.groupId, loaded.state, loaded.etag);
  return { status: 200, jsonBody: { ok: true, sessionId, status: 'OPEN', graceSeconds: IGNITE_DEFAULT_GRACE_SECONDS, traceId } };
}
