import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { uuidV4Pattern } from '../lib/groupAuth.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { requireSessionEmail } from '../lib/auth/requireSession.js';
import { requireActiveMember } from '../lib/auth/requireMembership.js';

export async function appointmentScanImage(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = `scan-img-${Date.now()}`;
  const url = new URL(request.url);
  const groupId = url.searchParams.get('groupId')?.trim() ?? '';
  const appointmentId = url.searchParams.get('appointmentId')?.trim() ?? '';
  if (!uuidV4Pattern.test(groupId)) return errorResponse(400, 'invalid_group_id', 'groupId must be a valid UUID', traceId);

  const session = await requireSessionEmail(request, traceId, { groupId });
  if (!session.ok) return session.response;
  if (!appointmentId) return errorResponse(400, 'appointment_required', 'appointmentId is required', traceId);

  const storage = createStorageAdapter();
  if (!storage.getBinary) return errorResponse(500, 'storage_missing_binary', 'Storage adapter missing getBinary', traceId);
  const loaded = await storage.load(groupId);
  const membership = requireActiveMember(loaded.state, session.email, traceId);
  if (!membership.ok) return membership.response;
  const appointment = loaded.state.appointments.find((item) => item.id === appointmentId || item.code === appointmentId);
  if (!appointment?.scanImageKey) return errorResponse(404, 'not_found', 'Scan image not found', traceId);
  const blob = await storage.getBinary(appointment.scanImageKey);
  return { status: 200, headers: { 'Content-Type': appointment.scanImageMime ?? blob.contentType, 'Cache-Control': 'private, max-age=300' }, body: blob.stream as any };
}
