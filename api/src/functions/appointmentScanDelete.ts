import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { validateJoinRequest, findActivePersonByPhone } from '../lib/groupAuth.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { toResponseSnapshot } from './direct.js';

export async function appointmentScanDelete(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = `scan-del-${Date.now()}`;
  const body = await request.json() as { groupId?: unknown; phone?: unknown; appointmentId?: unknown };
  const identity = validateJoinRequest(body.groupId, body.phone);
  if (!identity.ok) return identity.response;
  const appointmentId = typeof body.appointmentId === 'string' ? body.appointmentId.trim() : '';
  if (!appointmentId) return errorResponse(400, 'appointment_required', 'appointmentId is required', traceId);
  const storage = createStorageAdapter();
  const loaded = await storage.load(identity.groupId);
  if (!findActivePersonByPhone(loaded.state, identity.phoneE164)) return errorResponse(403, 'not_allowed', 'Not allowed', traceId);
  const appt = loaded.state.appointments.find((item) => item.id === appointmentId || item.code === appointmentId);
  if (!appt) return errorResponse(404, 'not_found', 'Appointment not found', traceId);
  if (appt.scanImageKey && storage.deleteBlob) await storage.deleteBlob(appt.scanImageKey).catch(() => undefined);
  appt.scanStatus = 'deleted'; appt.scanImageKey = null; appt.scanImageMime = null; appt.scanCapturedAt = null;
  const saved = await storage.save(identity.groupId, loaded.state, loaded.etag);
  return { status: 200, jsonBody: { ok: true, snapshot: toResponseSnapshot(saved.state) } };
}
