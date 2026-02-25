import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { decodeImageBase64 } from '../lib/scan/appointmentScan.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { requireSessionEmail } from '../lib/auth/requireSession.js';
import { requireActiveMember, resolveActivePersonIdForEmail } from '../lib/auth/requireMembership.js';
import { userProfilePhotoBlobKey, userProfilePhotoMetaBlobKey } from '../lib/userProfilePhoto.js';

type SetProfilePhotoBody = { groupId?: unknown; imageBase64?: unknown; imageMime?: unknown; traceId?: unknown };

export async function userProfilePhotoSet(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as SetProfilePhotoBody;
  const traceId = ensureTraceId(body.traceId);
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  if (!groupId) return errorResponse(400, 'invalid_group_id', 'groupId is required', traceId);
  if (typeof body.imageMime !== 'string' || !body.imageMime.startsWith('image/')) return errorResponse(400, 'invalid_image_mime', 'imageMime must be an image mime type', traceId);
  if (typeof body.imageBase64 !== 'string' || !body.imageBase64.trim()) return errorResponse(400, 'invalid_image_payload', 'imageBase64 is required', traceId);

  const session = await requireSessionEmail(request, traceId, { groupId });
  if (!session.ok) return session.response;

  const storage = createStorageAdapter();
  if (!storage.putBinary || !storage.getBinary) return errorResponse(500, 'storage_missing_binary', 'Storage adapter missing binary methods', traceId);

  let loaded;
  try {
    loaded = await storage.load(groupId);
  } catch (error) {
    if (error instanceof GroupNotFoundError) return errorResponse(404, 'group_not_found', 'Group not found', traceId);
    throw error;
  }

  const membership = requireActiveMember(loaded.state, session.email, traceId);
  if (!membership.ok) return membership.response;

  const nowISO = new Date().toISOString();
  const legacyMemberId = membership.member.memberId;
  const personId = resolveActivePersonIdForEmail(loaded.state, session.email) ?? legacyMemberId;
  const imageBytes = decodeImageBase64(body.imageBase64);

  await storage.putBinary(userProfilePhotoBlobKey(groupId, personId), imageBytes, body.imageMime, {
    groupId,
    personId,
    kind: 'user-profile-photo',
    updatedAt: nowISO
  });
  await storage.putBinary(userProfilePhotoMetaBlobKey(groupId, personId), Buffer.from(JSON.stringify({ contentType: body.imageMime, updatedAt: nowISO }), 'utf8'), 'application/json', {
    groupId,
    personId,
    kind: 'user-profile-photo-meta',
    updatedAt: nowISO
  });

  if (legacyMemberId !== personId) {
    await storage.putBinary(userProfilePhotoBlobKey(groupId, legacyMemberId), imageBytes, body.imageMime, {
      groupId,
      personId: legacyMemberId,
      kind: 'user-profile-photo-legacy',
      updatedAt: nowISO
    });
    await storage.putBinary(userProfilePhotoMetaBlobKey(groupId, legacyMemberId), Buffer.from(JSON.stringify({ contentType: body.imageMime, updatedAt: nowISO }), 'utf8'), 'application/json', {
      groupId,
      personId: legacyMemberId,
      kind: 'user-profile-photo-meta-legacy',
      updatedAt: nowISO
    });
  }

  return { status: 200, jsonBody: { ok: true, personId, updatedAt: nowISO, traceId } };
}
