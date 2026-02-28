import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { uuidV4Pattern } from '../lib/groupAuth.js';
import { HttpError } from '../lib/auth/sessions.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { ignitePhotoBlobKey } from '../lib/ignite.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';
import { requireGroupMembership } from '../lib/tables/membership.js';
import { requireSessionFromRequest } from '../lib/auth/sessions.js';

export async function ignitePhotoGet(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const url = new URL(request.url);
  const traceId = ensureTraceId(url.searchParams.get('traceId'));
  const groupId = url.searchParams.get('groupId')?.trim() ?? '';
  const sessionId = url.searchParams.get('sessionId')?.trim() ?? '';
  const personId = url.searchParams.get('personId')?.trim() ?? '';

  if (!uuidV4Pattern.test(groupId)) return errorResponse(400, 'invalid_group_id', 'Invalid groupId', traceId);
  if (!sessionId) return errorResponse(400, 'sessionId_required', 'sessionId is required', traceId);
  if (!personId) return errorResponse(400, 'personId_required', 'personId is required', traceId);

  let session;
  try {
    session = await requireSessionFromRequest(request, traceId, { groupId });
  } catch (error) {
    if (error instanceof HttpError) return error.response;
    throw error;
  }

  const storage = createStorageAdapter();
  if (!storage.getBinary) return errorResponse(500, 'storage_missing_binary', 'Storage adapter missing getBinary', traceId);

  let loaded;
  try {
    loaded = await storage.load(groupId);
  } catch (error) {
    if (error instanceof GroupNotFoundError) return errorResponse(404, 'group_not_found', 'Group not found', traceId);
    throw error;
  }

  const membership = await requireGroupMembership({ groupId, email: session.email, traceId, allowStatuses: ['active'] });
  if (!membership.ok) return membership.response;
  if (!loaded.state.ignite || loaded.state.ignite.sessionId !== sessionId) return errorResponse(404, 'ignite_not_found', 'Ignite session not found', traceId);

  const blob = await storage.getBinary(ignitePhotoBlobKey(groupId, sessionId, personId));
  return { status: 200, headers: { 'Content-Type': blob.contentType, 'Cache-Control': 'private, max-age=300' }, body: blob.stream as any };
}
