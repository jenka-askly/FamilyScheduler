import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { HttpError, requireSessionFromRequest } from '../lib/auth/sessions.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { requireActiveMember } from '../lib/auth/requireMembership.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';
import { userProfilePhotoMetaBlobKey } from '../lib/userProfilePhoto.js';

const streamToString = async (stream: NodeJS.ReadableStream): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
};

export async function userProfilePhotoMeta(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
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

  const personId = membership.member.memberId;
  try {
    const metaBlob = await storage.getBinary(userProfilePhotoMetaBlobKey(groupId, personId));
    const raw = await streamToString(metaBlob.stream);
    const parsed = JSON.parse(raw) as { updatedAt?: string; contentType?: string };
    return { status: 200, jsonBody: { ok: true, hasPhoto: true, updatedAt: parsed.updatedAt ?? '', contentType: parsed.contentType ?? '' } };
  } catch (error) {
    const details = error as { statusCode?: number; code?: string };
    if (details?.statusCode === 404 || details?.code === 'BlobNotFound') {
      return { status: 200, jsonBody: { ok: true, hasPhoto: false } };
    }
    throw error;
  }
}
