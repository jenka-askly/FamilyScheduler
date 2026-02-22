import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { validateJoinRequest, findActivePersonByPhone } from '../lib/groupAuth.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { decodeImageBase64, parseAndApplyScan, scanBlobKey } from '../lib/scan/appointmentScan.js';
import { toResponseSnapshot } from './direct.js';

export async function appointmentScanRescan(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = `scan-rescan-${Date.now()}`;
  const body = await request.json() as { groupId?: unknown; phone?: unknown; appointmentId?: unknown; imageBase64?: unknown; imageMime?: unknown; timezone?: unknown };
  const identity = validateJoinRequest(body.groupId, body.phone);
  if (!identity.ok) return identity.response;
  const appointmentId = typeof body.appointmentId === 'string' ? body.appointmentId.trim() : '';
  const imageMime = body.imageMime === 'image/jpeg' || body.imageMime === 'image/png' || body.imageMime === 'image/webp' ? body.imageMime : null;
  if (!appointmentId || !imageMime || typeof body.imageBase64 !== 'string') return errorResponse(400, 'invalid_scan_payload', 'appointmentId, imageBase64, imageMime required', traceId);
  const storage = createStorageAdapter();
  if (!storage.putBinary) return errorResponse(500, 'storage_missing_binary', 'Storage adapter missing putBinary', traceId);
  const loaded = await storage.load(identity.groupId);
  if (!findActivePersonByPhone(loaded.state, identity.phoneE164)) return errorResponse(403, 'not_allowed', 'Not allowed', traceId);
  const appt = loaded.state.appointments.find((item) => item.id === appointmentId || item.code === appointmentId);
  if (!appt) return errorResponse(404, 'not_found', 'Appointment not found', traceId);

  const key = scanBlobKey(identity.groupId, appt.id, imageMime);
  await storage.putBinary(key, decodeImageBase64(body.imageBase64), imageMime, { groupId: identity.groupId, appointmentId: appt.id, kind: 'scan-image', uploadedAt: new Date().toISOString() });
  appt.scanImageKey = key; appt.scanImageMime = imageMime; appt.scanCapturedAt = new Date().toISOString(); appt.scanStatus = 'pending';
  appt.title = ''; appt.date = ''; appt.startTime = undefined; appt.durationMins = undefined; appt.isAllDay = false; appt.location = ''; appt.locationRaw = ''; appt.locationDisplay = ''; appt.locationMapQuery = ''; appt.locationName = ''; appt.locationAddress = ''; appt.locationDirections = ''; appt.notes = ''; appt.scanAutoDate = true;
  await parseAndApplyScan(storage, loaded.state, identity.groupId, appt, body.imageBase64, imageMime, typeof body.timezone === 'string' ? body.timezone : undefined, 'rescan', traceId);
  const saved = await storage.save(identity.groupId, loaded.state, loaded.etag);
  return { status: 200, jsonBody: { ok: true, snapshot: toResponseSnapshot(saved.state) } };
}
