import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { uuidV4Pattern } from '../lib/groupAuth.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { requireSessionEmail } from '../lib/auth/requireSession.js';
import { ensureTablesReady } from '../lib/tables/withTables.js';
import { requireGroupMembership } from '../lib/tables/membership.js';
import { getAppointmentJson } from '../lib/tables/appointments.js';

export async function appointmentScanImage(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = `scan-img-${Date.now()}`;
  const url = new URL(request.url);
  const groupId = url.searchParams.get('groupId')?.trim() ?? '';
  const appointmentId = url.searchParams.get('appointmentId')?.trim() ?? '';
  if (!uuidV4Pattern.test(groupId)) return errorResponse(400, 'invalid_group_id', 'groupId must be a valid UUID', traceId);

  const session = await requireSessionEmail(request, traceId, { groupId });
  if (!session.ok) return session.response;
  if (!appointmentId) return errorResponse(400, 'appointment_required', 'appointmentId is required', traceId);

  await ensureTablesReady();
  const membership = await requireGroupMembership({ groupId, email: session.email, traceId, allowStatuses: ['active'] });
  if (!membership.ok) return membership.response;

  const appointment = await getAppointmentJson(groupId, appointmentId);
  const scanImageKey = typeof appointment?.scanImageKey === 'string' ? appointment.scanImageKey : '';
  const scanImageMime = typeof appointment?.scanImageMime === 'string' ? appointment.scanImageMime : '';
  if (!scanImageKey) return errorResponse(404, 'not_found', 'Scan image not found', traceId);

  const storage = createStorageAdapter();
  if (!storage.getBinary) return errorResponse(500, 'storage_missing_binary', 'Storage adapter missing getBinary', traceId);
  const blob = await storage.getBinary(scanImageKey);
  return { status: 200, headers: { 'Content-Type': scanImageMime || blob.contentType, 'Cache-Control': 'private, max-age=300' }, body: blob.stream as any };
}
