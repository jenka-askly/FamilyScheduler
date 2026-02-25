import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { HttpError, requireSessionFromRequest } from '../lib/auth/sessions.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { requireActiveMember } from '../lib/auth/requireMembership.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';
import { userProfilePhotoBlobKey } from '../lib/userProfilePhoto.js';

export async function userProfilePhotoGet(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const url = new URL(request.url);
  const traceId = ensureTraceId(url.searchParams.get('traceId'));
  const groupId = url.searchParams.get('groupId')?.trim() ?? '';
  if (!groupId) return errorResponse(400, 'invalid_group_id', 'groupId is required', traceId);

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

  const membership = requireActiveMember(loaded.state, session.email, traceId);
  if (!membership.ok) return membership.response;

  try {
    const blob = await storage.getBinary(userProfilePhotoBlobKey(groupId, membership.member.memberId));
    return { status: 200, headers: { 'Content-Type': blob.contentType, 'Cache-Control': 'private, max-age=300' }, body: blob.stream as any };
  } catch (error) {
    const details = error as { statusCode?: number; code?: string };
    if (details?.statusCode === 404 || details?.code === 'BlobNotFound') {
      return errorResponse(404, 'profile_photo_not_found', 'Profile photo not found', traceId);
    }
    throw error;
  }
}
