import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { findActivePersonByPhone, uuidV4Pattern, validateIdentityRequest } from '../lib/groupAuth.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { ignitePhotoBlobKey } from '../lib/ignite.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';
import { findActiveMemberByEmail } from '../lib/auth/requireMembership.js';
import { requireSessionFromRequest } from '../lib/auth/sessions.js';

export async function ignitePhotoGet(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const url = new URL(request.url);
  const traceId = ensureTraceId(url.searchParams.get('traceId'));
  const groupId = url.searchParams.get('groupId');
  const email = url.searchParams.get('email');
  const phone = url.searchParams.get('phone');
  const sessionId = url.searchParams.get('sessionId')?.trim() ?? '';
  const personId = url.searchParams.get('personId')?.trim() ?? '';

  const hasSessionHeader = Boolean(request.headers.get('x-session-id')?.trim());
  let caller: { kind: 'email'; email: string } | { kind: 'phone'; phoneE164: string };
  let validatedGroupId = '';
  if (hasSessionHeader) {
    const gid = typeof groupId === 'string' ? groupId.trim() : '';
    if (!uuidV4Pattern.test(gid)) return errorResponse(400, 'invalid_group_id', 'Invalid groupId', traceId);
    const session = await requireSessionFromRequest(request, traceId, { groupId: gid });
    validatedGroupId = gid;
    caller = { kind: 'email', email: session.email };
  } else {
    const identity = validateIdentityRequest(groupId, email, phone);
    if (!identity.ok) return { ...identity.response, jsonBody: { ...(identity.response.jsonBody as Record<string, unknown>), traceId } };
    if (!uuidV4Pattern.test(identity.groupId)) return errorResponse(400, 'invalid_group_id', 'Invalid groupId', traceId);
    validatedGroupId = identity.groupId;
    caller = identity.identity;
  }

  if (!sessionId) return errorResponse(400, 'sessionId_required', 'sessionId is required', traceId);
  if (!personId) return errorResponse(400, 'personId_required', 'personId is required', traceId);

  const storage = createStorageAdapter();
  if (!storage.getBinary) return errorResponse(500, 'storage_missing_binary', 'Storage adapter missing getBinary', traceId);

  let loaded;
  try {
    loaded = await storage.load(validatedGroupId);
  } catch (error) {
    if (error instanceof GroupNotFoundError) return errorResponse(404, 'group_not_found', 'Group not found', traceId);
    throw error;
  }

  if (caller.kind === 'email') {
    if (!findActiveMemberByEmail(loaded.state, caller.email)) return errorResponse(403, 'not_allowed', 'Not allowed', traceId);
  } else if (!findActivePersonByPhone(loaded.state, caller.phoneE164)) {
    return errorResponse(403, 'not_allowed', 'Not allowed', traceId);
  }
  if (!loaded.state.ignite || loaded.state.ignite.sessionId !== sessionId) return errorResponse(404, 'ignite_not_found', 'Ignite session not found', traceId);

  const blob = await storage.getBinary(ignitePhotoBlobKey(validatedGroupId, sessionId, personId));
  return { status: 200, headers: { 'Content-Type': blob.contentType, 'Cache-Control': 'private, max-age=300' }, body: blob.stream as any };
}
