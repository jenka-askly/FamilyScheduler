import { randomUUID } from 'node:crypto';
import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { requireSessionEmail } from '../lib/auth/requireSession.js';
import { parseAppointmentFromImage } from '../lib/ai/parseAppointmentFromImage.js';
import { applyParsedFields, decodeImageBase64, scanBlobKey } from '../lib/scan/appointmentScan.js';
import type { Appointment } from '../lib/state.js';
import { ensureTablesReady } from '../lib/tables/withTables.js';
import { requireGroupMembership } from '../lib/tables/membership.js';
import { rowKeyFromIso, upsertAppointmentIndex } from '../lib/tables/entities.js';
import { putAppointmentJson } from '../lib/tables/appointments.js';
import { incrementDailyMetric } from '../lib/tables/metrics.js';

export async function scanAppointment(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const body = await request.json() as { groupId?: unknown; imageBase64?: unknown; imageMime?: unknown; timezone?: unknown };
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  if (!groupId) return errorResponse(400, 'invalid_group_id', 'groupId is required', traceId);
  const session = await requireSessionEmail(request, traceId, { groupId });
  if (!session.ok) return session.response;
  const imageMime = body.imageMime === 'image/jpeg' || body.imageMime === 'image/png' || body.imageMime === 'image/webp' ? body.imageMime : null;
  if (!imageMime || typeof body.imageBase64 !== 'string' || !body.imageBase64.trim()) return errorResponse(400, 'invalid_scan_payload', 'imageBase64 and valid imageMime are required', traceId);

  await ensureTablesReady();
  const member = await requireGroupMembership({ groupId, email: session.email, traceId, allowStatuses: ['active'] });
  if (!member.ok) return member.response;

  const storage = createStorageAdapter();
  if (!storage.putBinary) return errorResponse(500, 'storage_missing_binary', 'Storage adapter missing putBinary', traceId);

  const now = new Date().toISOString();
  const appointmentId = `${Date.now()}-${randomUUID()}`;
  const appointment: Appointment = {
    id: appointmentId,
    code: `APPT-${new Date().getUTCSeconds()}`,
    title: '',
    schemaVersion: 2,
    updatedAt: now,
    assigned: [],
    people: [],
    location: '', locationRaw: '', locationDisplay: '', locationMapQuery: '', locationName: '', locationAddress: '', locationDirections: '',
    notes: '',
    timezone: typeof body.timezone === 'string' ? body.timezone : 'America/Los_Angeles',
    date: '',
    isAllDay: false,
    scanStatus: 'pending',
    scanImageKey: null,
    scanImageMime: null,
    scanCapturedAt: now,
    scanAutoDate: true
  };

  const key = scanBlobKey(groupId, appointment.id, imageMime);
  const bytes = decodeImageBase64(body.imageBase64);
  await storage.putBinary(key, bytes, imageMime, { groupId, appointmentId: appointment.id, kind: 'scan-image', uploadedAt: now });
  appointment.scanImageKey = key;
  appointment.scanImageMime = imageMime;

  await putAppointmentJson(groupId, appointment.id, appointment as unknown as Record<string, unknown>);
  const rowKey = rowKeyFromIso(now, appointment.id);
  await upsertAppointmentIndex({ partitionKey: groupId, rowKey, appointmentId: appointment.id, startTime: appointment.start, status: 'pending', hasScan: true, scanCapturedAt: now, createdAt: now, updatedAt: now, isDeleted: false });
  await incrementDailyMetric('newAppointments', 1);

  void (async () => {
    try {
      const parsed = await parseAppointmentFromImage({ imageBase64: body.imageBase64 as string, imageMime, timezone: typeof body.timezone === 'string' ? body.timezone : undefined, traceId });
      applyParsedFields(appointment, parsed.parsed, 'initial');
      appointment.scanStatus = 'parsed';
      appointment.updatedAt = new Date().toISOString();
      await putAppointmentJson(groupId, appointment.id, appointment as unknown as Record<string, unknown>);
      await upsertAppointmentIndex({ partitionKey: groupId, rowKey, appointmentId: appointment.id, startTime: appointment.start, status: appointment.scanStatus ?? 'parsed', hasScan: true, scanCapturedAt: appointment.scanCapturedAt ?? now, createdAt: now, updatedAt: appointment.updatedAt, isDeleted: false });
    } catch {
      appointment.scanStatus = 'failed';
      appointment.updatedAt = new Date().toISOString();
      await putAppointmentJson(groupId, appointment.id, appointment as unknown as Record<string, unknown>);
      await upsertAppointmentIndex({ partitionKey: groupId, rowKey, appointmentId: appointment.id, startTime: appointment.start, status: 'failed', hasScan: true, scanCapturedAt: appointment.scanCapturedAt ?? now, createdAt: now, updatedAt: appointment.updatedAt, isDeleted: false });
    }
  })();

  return { status: 200, jsonBody: { ok: true, appointmentId: appointment.id, traceId } };
}
