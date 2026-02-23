import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { findActivePersonByPhone, validateJoinRequest } from '../lib/groupAuth.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { igniteEffectiveStatus } from '../lib/ignite.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';

export async function igniteMeta(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const url = new URL(request.url);
  const traceId = ensureTraceId(url.searchParams.get('traceId'));
  const identity = validateJoinRequest(url.searchParams.get('groupId'), url.searchParams.get('phone'));
  if (!identity.ok) return { ...identity.response, jsonBody: { ...(identity.response.jsonBody as Record<string, unknown>), traceId } };
  const sessionId = url.searchParams.get('sessionId')?.trim() ?? '';
  if (!sessionId) return errorResponse(400, 'sessionId_required', 'sessionId is required', traceId);

  const storage = createStorageAdapter();
  let loaded;
  try {
    loaded = await storage.load(identity.groupId);
  } catch (error) {
    if (error instanceof GroupNotFoundError) return errorResponse(404, 'group_not_found', 'Group not found', traceId);
    throw error;
  }

  if (!findActivePersonByPhone(loaded.state, identity.phoneE164)) return errorResponse(403, 'not_allowed', 'Not allowed', traceId);
  if (!loaded.state.ignite || loaded.state.ignite.sessionId !== sessionId) return errorResponse(404, 'ignite_not_found', 'Ignite session not found', traceId);

  const ignite = loaded.state.ignite;
  const status = igniteEffectiveStatus(ignite);
  return {
    status: 200,
    jsonBody: {
      ok: true,
      status,
      graceSeconds: ignite.graceSeconds,
      closeRequestedAt: ignite.closeRequestedAt,
      joinedCount: ignite.joinedPersonIds.length,
      joinedPersonIds: ignite.joinedPersonIds,
      photoUpdatedAtByPersonId: ignite.photoUpdatedAtByPersonId ?? {},
      serverTime: new Date().toISOString(),
      traceId
    }
  };
}
