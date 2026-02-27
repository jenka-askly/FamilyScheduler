import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { requireSessionEmail } from '../lib/auth/requireSession.js';
import { decodeImageBase64, scanBlobKey, applyParsedFields, hasMeaningfulParsedContent } from '../lib/scan/appointmentScan.js';
import { ensureTablesReady } from '../lib/tables/withTables.js';
import { requireGroupMembership } from '../lib/tables/membership.js';
import { findAppointmentIndexById, upsertAppointmentIndex } from '../lib/tables/entities.js';
import { getAppointmentJson, putAppointmentJson } from '../lib/tables/appointments.js';
import { parseAppointmentFromImage } from '../lib/ai/parseAppointmentFromImage.js';
import type { Appointment } from '../lib/state.js';

export async function appointmentScanRescan(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = `scan-rescan-${Date.now()}`;
  const body = await request.json() as { groupId?: unknown; appointmentId?: unknown; imageBase64?: unknown; imageMime?: unknown; timezone?: unknown };
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  if (!groupId) return errorResponse(400, 'invalid_group_id', 'groupId is required', traceId);
  const session = await requireSessionEmail(request, traceId, { groupId });
  if (!session.ok) return session.response;
  const appointmentId = typeof body.appointmentId === 'string' ? body.appointmentId.trim() : '';
  const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : null;
  const imageMime = body.imageMime === 'image/jpeg' || body.imageMime === 'image/png' || body.imageMime === 'image/webp' ? body.imageMime : null;
  if (!appointmentId || !imageMime || !imageBase64) return errorResponse(400, 'invalid_scan_payload', 'appointmentId, imageBase64, imageMime required', traceId);

  await ensureTablesReady();
  const member = await requireGroupMembership({ groupId, email: session.email, traceId, allowStatuses: ['active'] });
  if (!member.ok) return member.response;

  const index = await findAppointmentIndexById(groupId, appointmentId);
  if (!index) return errorResponse(404, 'not_found', 'Appointment not found', traceId);

  const doc = await getAppointmentJson(groupId, appointmentId);
  if (!doc) return errorResponse(404, 'not_found', 'Appointment not found', traceId);

  const storage = createStorageAdapter();
  if (!storage.putBinary) return errorResponse(500, 'storage_missing_binary', 'Storage adapter missing putBinary', traceId);

  const now = new Date().toISOString();
  const key = scanBlobKey(groupId, appointmentId, imageMime);
  await storage.putBinary(key, decodeImageBase64(imageBase64), imageMime, { groupId, appointmentId, kind: 'scan-image', uploadedAt: now });

  const appt: Appointment = { ...(doc as unknown as Appointment), id: appointmentId };
  appt.scanImageKey = key;
  appt.scanImageMime = imageMime;
  appt.scanCapturedAt = now;
  appt.scanStatus = 'pending';
  appt.updatedAt = now;
  await putAppointmentJson(groupId, appointmentId, appt as unknown as Record<string, unknown>);
  await upsertAppointmentIndex({ ...index, startTime: appt.start, hasScan: true, scanCapturedAt: now, status: 'pending', updatedAt: appt.updatedAt, isDeleted: false });

  void (async () => {
    try {
      const parsed = await parseAppointmentFromImage({ imageBase64, imageMime, timezone: typeof body.timezone === 'string' ? body.timezone : undefined, traceId });
      if (hasMeaningfulParsedContent(parsed.parsed)) {
        applyParsedFields(appt, parsed.parsed, 'rescan');
        appt.scanStatus = 'parsed';
      } else {
        appt.scanStatus = 'failed';
        appt.title = 'Appointment';
      }
    } catch {
      appt.scanStatus = 'failed';
    }

    appt.updatedAt = new Date().toISOString();
    await putAppointmentJson(groupId, appointmentId, appt as unknown as Record<string, unknown>);
    await upsertAppointmentIndex({ ...index, startTime: appt.start, hasScan: true, scanCapturedAt: now, status: appt.scanStatus ?? 'pending', updatedAt: appt.updatedAt, isDeleted: false });
  })();

  return { status: 200, jsonBody: { ok: true, traceId } };
}
