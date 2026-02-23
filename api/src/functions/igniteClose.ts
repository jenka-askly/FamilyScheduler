import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { findActivePersonByPhone, validateJoinRequest } from '../lib/groupAuth.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { IGNITE_DEFAULT_GRACE_SECONDS } from '../lib/ignite.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';

type IgniteCloseBody = { groupId?: unknown; phone?: unknown; sessionId?: unknown; traceId?: unknown };

export async function igniteClose(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as IgniteCloseBody;
  const traceId = ensureTraceId(body.traceId);
  const identity = validateJoinRequest(body.groupId, body.phone);
  if (!identity.ok) return { ...identity.response, jsonBody: { ...(identity.response.jsonBody as Record<string, unknown>), traceId } };
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  if (!sessionId) return errorResponse(400, 'sessionId_required', 'sessionId is required', traceId);

  const storage = createStorageAdapter();
  let loaded;
  try {
    loaded = await storage.load(identity.groupId);
  } catch (error) {
    if (error instanceof GroupNotFoundError) return errorResponse(404, 'group_not_found', 'Group not found', traceId);
    throw error;
  }

  const caller = findActivePersonByPhone(loaded.state, identity.phoneE164);
  if (!caller) return errorResponse(403, 'not_allowed', 'Not allowed', traceId);
  if (!loaded.state.ignite || loaded.state.ignite.sessionId !== sessionId) return errorResponse(404, 'ignite_not_found', 'Ignite session not found', traceId);
  if (loaded.state.ignite.createdByPersonId !== caller.personId) return errorResponse(403, 'not_allowed', 'Not allowed', traceId);

  const closeRequestedAt = new Date().toISOString();
  loaded.state.ignite.status = 'CLOSING';
  loaded.state.ignite.closeRequestedAt = closeRequestedAt;
  loaded.state.ignite.graceSeconds = loaded.state.ignite.graceSeconds ?? IGNITE_DEFAULT_GRACE_SECONDS;
  await storage.save(identity.groupId, loaded.state, loaded.etag);

  return { status: 200, jsonBody: { ok: true, status: 'CLOSING', closeRequestedAt, graceSeconds: loaded.state.ignite.graceSeconds, traceId } };
}
