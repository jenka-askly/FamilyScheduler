import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { errorResponse } from '../lib/http/errorResponse.js';
import { IGNITE_DEFAULT_GRACE_SECONDS, igniteIsJoinable, ignitePhotoBlobKey } from '../lib/ignite.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { decodeImageBase64 } from '../lib/scan/appointmentScan.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';
import { requireSessionEmail } from '../lib/auth/requireSession.js';
import { requireActiveMember } from '../lib/auth/requireMembership.js';

type IgnitePhotoBody = { groupId?: unknown; sessionId?: unknown; imageBase64?: unknown; imageMime?: unknown; traceId?: unknown };

export async function ignitePhoto(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as IgnitePhotoBody;
  const traceId = ensureTraceId(body.traceId);
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  if (!groupId) return errorResponse(400, 'invalid_group_id', 'groupId is required', traceId);
  const session = await requireSessionEmail(request, traceId);
  if (!session.ok) return session.response;

  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  if (!sessionId) return errorResponse(400, 'sessionId_required', 'sessionId is required', traceId);
  if (typeof body.imageMime !== 'string' || !body.imageMime.startsWith('image/')) return errorResponse(400, 'invalid_image_mime', 'imageMime must be an image mime type', traceId);
  if (typeof body.imageBase64 !== 'string' || !body.imageBase64.trim()) return errorResponse(400, 'invalid_scan_payload', 'imageBase64 is required', traceId);

  const storage = createStorageAdapter();
  if (!storage.putBinary) return errorResponse(500, 'storage_missing_binary', 'Storage adapter missing putBinary', traceId);

  let loaded;
  try { loaded = await storage.load(groupId); } catch (error) { if (error instanceof GroupNotFoundError) return errorResponse(404, 'group_not_found', 'Group not found', traceId); throw error; }
  if (!loaded.state.ignite || loaded.state.ignite.sessionId !== sessionId) return errorResponse(410, 'ignite_closed', 'Session closed', traceId);
  if (!igniteIsJoinable(loaded.state.ignite)) return errorResponse(410, 'ignite_closed', 'Session closed', traceId);

  const membership = requireActiveMember(loaded.state, session.email, traceId);
  if (!membership.ok) return membership.response;
  const caller = membership.member;

  const nowISO = new Date().toISOString();
  await storage.putBinary(ignitePhotoBlobKey(groupId, sessionId, caller.memberId), decodeImageBase64(body.imageBase64), body.imageMime, { groupId, sessionId, personId: caller.memberId, kind: 'ignite-photo', uploadedAt: nowISO });
  loaded.state.ignite.graceSeconds = loaded.state.ignite.graceSeconds ?? IGNITE_DEFAULT_GRACE_SECONDS;
  loaded.state.ignite.photoUpdatedAtByPersonId = loaded.state.ignite.photoUpdatedAtByPersonId ?? {};
  loaded.state.ignite.photoUpdatedAtByPersonId[caller.memberId] = nowISO;
  await storage.save(groupId, loaded.state, loaded.etag);
  return { status: 200, jsonBody: { ok: true, personId: caller.memberId, updatedAt: nowISO, traceId } };
}
