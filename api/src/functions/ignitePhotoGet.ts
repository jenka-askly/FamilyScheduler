import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { findActivePersonByPhone, uuidV4Pattern, validateJoinRequest } from '../lib/groupAuth.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { ignitePhotoBlobKey } from '../lib/ignite.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';

export async function ignitePhotoGet(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const url = new URL(request.url);
  const traceId = ensureTraceId(url.searchParams.get('traceId'));
  const groupId = url.searchParams.get('groupId');
  const phone = url.searchParams.get('phone');
  const sessionId = url.searchParams.get('sessionId')?.trim() ?? '';
  const personId = url.searchParams.get('personId')?.trim() ?? '';

  const identity = validateJoinRequest(groupId, phone);
  if (!identity.ok) return { ...identity.response, jsonBody: { ...(identity.response.jsonBody as Record<string, unknown>), traceId } };
  if (!uuidV4Pattern.test(identity.groupId)) return errorResponse(400, 'invalid_group_id', 'Invalid groupId', traceId);
  if (!sessionId) return errorResponse(400, 'sessionId_required', 'sessionId is required', traceId);
  if (!personId) return errorResponse(400, 'personId_required', 'personId is required', traceId);

  const storage = createStorageAdapter();
  if (!storage.getBinary) return errorResponse(500, 'storage_missing_binary', 'Storage adapter missing getBinary', traceId);

  let loaded;
  try {
    loaded = await storage.load(identity.groupId);
  } catch (error) {
    if (error instanceof GroupNotFoundError) return errorResponse(404, 'group_not_found', 'Group not found', traceId);
    throw error;
  }

  if (!findActivePersonByPhone(loaded.state, identity.phoneE164)) return errorResponse(403, 'not_allowed', 'Not allowed', traceId);
  if (!loaded.state.ignite || loaded.state.ignite.sessionId !== sessionId) return errorResponse(404, 'ignite_not_found', 'Ignite session not found', traceId);

  const blob = await storage.getBinary(ignitePhotoBlobKey(identity.groupId, sessionId, personId));
  return { status: 200, headers: { 'Content-Type': blob.contentType, 'Cache-Control': 'private, max-age=300' }, body: blob.stream as any };
}
