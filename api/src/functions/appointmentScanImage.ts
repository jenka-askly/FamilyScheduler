import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { validateJoinRequest, findActivePersonByPhone } from '../lib/groupAuth.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { errorResponse } from '../lib/http/errorResponse.js';

export async function appointmentScanImage(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = `scan-img-${Date.now()}`;
  const url = new URL(request.url);
  const groupId = url.searchParams.get('groupId');
  const phone = url.searchParams.get('phone');
  const appointmentId = url.searchParams.get('appointmentId')?.trim() ?? '';
  const identity = validateJoinRequest(groupId, phone);
  if (!identity.ok) return identity.response;
  if (!appointmentId) return errorResponse(400, 'appointment_required', 'appointmentId is required', traceId);

  const storage = createStorageAdapter();
  if (!storage.getBinary) return errorResponse(500, 'storage_missing_binary', 'Storage adapter missing getBinary', traceId);
  const loaded = await storage.load(identity.groupId);
  if (!findActivePersonByPhone(loaded.state, identity.phoneE164)) return errorResponse(403, 'not_allowed', 'Not allowed', traceId);
  const appointment = loaded.state.appointments.find((item) => item.id === appointmentId || item.code === appointmentId);
  if (!appointment?.scanImageKey) return errorResponse(404, 'not_found', 'Scan image not found', traceId);
  const blob = await storage.getBinary(appointment.scanImageKey);
  return { status: 200, headers: { 'Content-Type': appointment.scanImageMime ?? blob.contentType, 'Cache-Control': 'private, max-age=300' }, body: blob.stream as any };
}
