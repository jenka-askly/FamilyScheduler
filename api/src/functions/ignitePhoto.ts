import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { findActivePersonByPhone, validateJoinRequest } from '../lib/groupAuth.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { igniteIsJoinable, ignitePhotoBlobKey } from '../lib/ignite.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { decodeImageBase64 } from '../lib/scan/appointmentScan.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';

type IgnitePhotoBody = { groupId?: unknown; phone?: unknown; sessionId?: unknown; imageBase64?: unknown; imageMime?: unknown; traceId?: unknown };
type PrincipalClaim = { typ?: string; val?: string };
type ClientPrincipal = { userDetails?: string; claims?: PrincipalClaim[] };

const phoneFromPrincipal = (request: HttpRequest): string | null => {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    const decoded = Buffer.from(header, 'base64').toString('utf8');
    const principal = JSON.parse(decoded) as ClientPrincipal;
    if (typeof principal.userDetails === 'string' && principal.userDetails.trim()) return principal.userDetails;
    const phoneClaim = principal.claims?.find((claim) => claim.typ === 'phone_number' || claim.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/mobilephone');
    return phoneClaim?.val?.trim() ? phoneClaim.val : null;
  } catch {
    return null;
  }
};

export async function ignitePhoto(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as IgnitePhotoBody;
  const traceId = ensureTraceId(body.traceId);
  const normalizedPhone = typeof body.phone === 'string' && body.phone.trim() ? body.phone : (phoneFromPrincipal(request) ?? undefined);
  const identity = validateJoinRequest(body.groupId, normalizedPhone);
  if (!identity.ok) return { ...identity.response, jsonBody: { ...(identity.response.jsonBody as Record<string, unknown>), traceId } };
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  if (!sessionId) return errorResponse(400, 'sessionId_required', 'sessionId is required', traceId);
  if (typeof body.imageMime !== 'string' || !body.imageMime.startsWith('image/')) return errorResponse(400, 'invalid_image_mime', 'imageMime must be an image mime type', traceId);
  if (typeof body.imageBase64 !== 'string' || !body.imageBase64.trim()) return errorResponse(400, 'invalid_scan_payload', 'imageBase64 is required', traceId);

  const storage = createStorageAdapter();
  if (!storage.putBinary) return errorResponse(500, 'storage_missing_binary', 'Storage adapter missing putBinary', traceId);

  let loaded;
  try {
    loaded = await storage.load(identity.groupId);
  } catch (error) {
    if (error instanceof GroupNotFoundError) return errorResponse(404, 'group_not_found', 'Group not found', traceId);
    throw error;
  }

  if (!loaded.state.ignite || loaded.state.ignite.sessionId !== sessionId) return errorResponse(410, 'ignite_closed', 'Session closed', traceId);
  const ignite = loaded.state.ignite;
  if (!igniteIsJoinable(ignite)) return errorResponse(410, 'ignite_closed', 'Session closed', traceId);

  const caller = findActivePersonByPhone(loaded.state, identity.phoneE164);
  if (!caller) return errorResponse(403, 'not_allowed', 'Not allowed', traceId);

  const bytes = decodeImageBase64(body.imageBase64);
  const nowISO = new Date().toISOString();
  const key = ignitePhotoBlobKey(identity.groupId, sessionId, caller.personId);
  await storage.putBinary(key, bytes, body.imageMime, { groupId: identity.groupId, sessionId, personId: caller.personId, kind: 'ignite-photo', uploadedAt: nowISO });

  ignite.photoUpdatedAtByPersonId = ignite.photoUpdatedAtByPersonId ?? {};
  ignite.photoUpdatedAtByPersonId[caller.personId] = nowISO;
  await storage.save(identity.groupId, loaded.state, loaded.etag);

  return { status: 200, jsonBody: { ok: true, personId: caller.personId, updatedAt: nowISO, traceId } };
}
