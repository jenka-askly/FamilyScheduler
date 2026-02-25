import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { requireSessionEmail } from '../lib/auth/requireSession.js';
import { requireActiveMember } from '../lib/auth/requireMembership.js';
import { toResponseSnapshot } from './direct.js';

export async function appointmentScanDelete(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = `scan-del-${Date.now()}`;
  const body = await request.json() as { groupId?: unknown; appointmentId?: unknown };
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  if (!groupId) return errorResponse(400, 'invalid_group_id', 'groupId is required', traceId);
  const session = await requireSessionEmail(request, traceId, { groupId });
  if (!session.ok) return session.response;
  const appointmentId = typeof body.appointmentId === 'string' ? body.appointmentId.trim() : '';
  if (!appointmentId) return errorResponse(400, 'appointment_required', 'appointmentId is required', traceId);
  const storage = createStorageAdapter();
  const loaded = await storage.load(groupId);
  const member = requireActiveMember(loaded.state, session.email, traceId);
  if (!member.ok) return member.response;
  const appt = loaded.state.appointments.find((item) => item.id === appointmentId || item.code === appointmentId);
  if (!appt) return errorResponse(404, 'not_found', 'Appointment not found', traceId);
  if (appt.scanImageKey && storage.deleteBlob) await storage.deleteBlob(appt.scanImageKey).catch(() => undefined);
  appt.scanStatus = 'deleted'; appt.scanImageKey = null; appt.scanImageMime = null; appt.scanCapturedAt = null;
  const saved = await storage.save(groupId, loaded.state, loaded.etag);
  return { status: 200, jsonBody: { ok: true, snapshot: toResponseSnapshot(saved.state) } };
}
