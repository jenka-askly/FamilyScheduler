import { randomUUID } from 'node:crypto';
import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { createStorageAdapter, MissingConfigError } from '../lib/storage/storageFactory.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { requireSessionEmail } from '../lib/auth/requireSession.js';
import { parseAppointmentFromImage } from '../lib/ai/parseAppointmentFromImage.js';
import { applyParsedFields, decodeImageBase64, hasMeaningfulParsedContent, scanBlobKey } from '../lib/scan/appointmentScan.js';
import type { Appointment } from '../lib/state.js';
import { ensureTablesReady } from '../lib/tables/withTables.js';
import { requireGroupMembership } from '../lib/tables/membership.js';
import { adjustGroupCounters, rowKeyFromIso, upsertAppointmentIndex } from '../lib/tables/entities.js';
import { putAppointmentJson } from '../lib/tables/appointments.js';
import { incrementDailyMetric } from '../lib/tables/metrics.js';


const isUpcomingStart = (startTime: string | undefined, nowIso: string): boolean => {
  if (!startTime) return false;
  const startMs = Date.parse(startTime);
  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(startMs) || !Number.isFinite(nowMs)) return false;
  return startMs >= nowMs;
};

type ScanCaptureError = { status: number; error: string; message: string; extra?: Record<string, unknown> };

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function fieldMeta(name: string, v: unknown): Record<string, unknown> {
  return {
    name,
    type: typeof v,
    isNull: v === null,
    isUndef: v === undefined,
    len: typeof v === 'string' ? v.length : undefined
  };
}

function logStepFail(step: string, traceId: string, groupId: string, extra: Record<string, unknown>, err: unknown): void {
  console.error(JSON.stringify({
    level: 'error',
    event: 'scanAppointment_step_failed',
    step,
    traceId,
    groupId,
    message: errMessage(err),
    ...extra
  }));
}

const mapScanCaptureError = (err: unknown): ScanCaptureError => {
  const message = errMessage(err);
  if (message.includes('invalid_image_base64')) {
    return { status: 400, error: 'invalid_image_base64', message: 'Image payload is not valid base64' };
  }
  if (message.includes('image_too_large')) {
    return { status: 413, error: 'image_too_large', message: 'Image exceeds maximum size' };
  }
  if (err instanceof MissingConfigError) {
    return { status: 500, error: 'config_missing', message: 'Storage is not configured' };
  }
  return { status: 500, error: 'scan_capture_failed', message: 'Failed to capture scan image' };
};

export async function scanAppointment(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let body: { groupId?: unknown; email?: unknown; imageBase64?: unknown; imageMime?: unknown; timezone?: unknown };
  try {
    body = await request.json() as { groupId?: unknown; email?: unknown; imageBase64?: unknown; imageMime?: unknown; timezone?: unknown };
  } catch {
    return errorResponse(400, 'invalid_json', 'Request body must be valid JSON', traceId);
  }
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  if (!groupId) return errorResponse(400, 'invalid_group_id', 'groupId is required', traceId);
  const session = await requireSessionEmail(request, traceId, { groupId });
  if (!session.ok) return session.response;
  const imageMime = body.imageMime === 'image/jpeg' || body.imageMime === 'image/png' || body.imageMime === 'image/webp' ? body.imageMime : null;
  if (!imageMime || typeof body.imageBase64 !== 'string' || !body.imageBase64.trim()) return errorResponse(400, 'invalid_scan_payload', 'imageBase64 and valid imageMime are required', traceId);

  await ensureTablesReady();
  const member = await requireGroupMembership({ groupId, email: session.email, traceId, allowStatuses: ['active'] });
  if (!member.ok) return member.response;

  try {
    const storage = createStorageAdapter();
    if (!storage.putBinary) return errorResponse(500, 'storage_missing_binary', 'Storage adapter missing putBinary', traceId);

    const now = new Date().toISOString();
    const appointmentId = `${Date.now()}-${randomUUID()}`;
    const appointment: Appointment = {
      id: appointmentId,
      code: `APPT-${new Date().getUTCSeconds()}`,
      title: 'Scanning…',
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
    try {
      await storage.putBinary(key, bytes, imageMime, { groupId, appointmentId: appointment.id, kind: 'scan-image', uploadedAt: now });
    } catch (e) {
      logStepFail('putBinary', traceId, groupId, { appointmentId }, e);
      return errorResponse(500, 'scan_putBinary_failed', 'Failed to store scan image', traceId);
    }
    appointment.scanImageKey = key;
    appointment.scanImageMime = imageMime;

    try {
      await putAppointmentJson(groupId, appointment.id, appointment as unknown as Record<string, unknown>);
    } catch (e) {
      logStepFail('putAppointmentJson', traceId, groupId, { appointmentId }, e);
      return errorResponse(500, 'scan_putAppointmentJson_failed', 'Failed to write appointment record', traceId);
    }
    const rowKey = rowKeyFromIso(now, appointment.id);
    const indexArgs = {
      partitionKey: groupId,
      rowKey,
      appointmentId: appointment.id,
      startTime: appointment.start,
      status: 'pending' as const,
      hasScan: true,
      scanCapturedAt: now,
      createdAt: now,
      updatedAt: now,
      isDeleted: false
    };
    try {
      await upsertAppointmentIndex(indexArgs);
    } catch (e) {
      logStepFail(
        'upsertAppointmentIndex_initial',
        traceId,
        groupId,
        {
          appointmentId,
          rowKeyLen: rowKey.length,
          meta: [
            fieldMeta('partitionKey', indexArgs.partitionKey),
            fieldMeta('rowKey', indexArgs.rowKey),
            fieldMeta('appointmentId', indexArgs.appointmentId),
            fieldMeta('startTime', indexArgs.startTime),
            fieldMeta('status', indexArgs.status),
            fieldMeta('scanCapturedAt', indexArgs.scanCapturedAt),
            fieldMeta('createdAt', indexArgs.createdAt),
            fieldMeta('updatedAt', indexArgs.updatedAt),
            fieldMeta('isDeleted', indexArgs.isDeleted),
            fieldMeta('hasScan', indexArgs.hasScan)
          ]
        },
        e
      );
      return errorResponse(500, 'scan_upsertIndex_failed', 'Failed to write appointment index', traceId);
    }
    if (isUpcomingStart(appointment.start, now)) {
      try {
        await adjustGroupCounters(groupId, { appointmentCountUpcoming: 1 });
      } catch (e) {
        logStepFail('adjustGroupCounters', traceId, groupId, { appointmentId }, e);
        return errorResponse(500, 'scan_adjustGroupCounters_failed', 'Failed to update group counters', traceId);
      }
    }
    try {
      await incrementDailyMetric('newAppointments', 1);
    } catch (e) {
      logStepFail('incrementDailyMetric', traceId, groupId, { appointmentId }, e);
      return errorResponse(500, 'scan_incrementDailyMetric_failed', 'Failed to update daily metric', traceId);
    }

    void (async () => {
      try {
        const parsed = await parseAppointmentFromImage({ imageBase64: body.imageBase64 as string, imageMime, timezone: typeof body.timezone === 'string' ? body.timezone : undefined, traceId });
        if (hasMeaningfulParsedContent(parsed.parsed)) {
          applyParsedFields(appointment, parsed.parsed, 'initial');
          appointment.scanStatus = 'parsed';
        } else {
          appointment.scanStatus = 'failed';
          appointment.title = 'Appointment';
        }
        appointment.updatedAt = new Date().toISOString();
        await putAppointmentJson(groupId, appointment.id, appointment as unknown as Record<string, unknown>);
        await upsertAppointmentIndex({ partitionKey: groupId, rowKey, appointmentId: appointment.id, startTime: appointment.start, status: appointment.scanStatus ?? 'parsed', hasScan: true, scanCapturedAt: appointment.scanCapturedAt ?? now, createdAt: now, updatedAt: appointment.updatedAt, isDeleted: false });
        if (isUpcomingStart(appointment.start, appointment.updatedAt)) {
          await adjustGroupCounters(groupId, { appointmentCountUpcoming: 1 });
        }
      } catch {
        appointment.scanStatus = 'failed';
        appointment.updatedAt = new Date().toISOString();
        await putAppointmentJson(groupId, appointment.id, appointment as unknown as Record<string, unknown>);
        await upsertAppointmentIndex({ partitionKey: groupId, rowKey, appointmentId: appointment.id, startTime: appointment.start, status: 'failed', hasScan: true, scanCapturedAt: appointment.scanCapturedAt ?? now, createdAt: now, updatedAt: appointment.updatedAt, isDeleted: false });
      }
    })();

    return { status: 200, jsonBody: { ok: true, appointmentId: appointment.id, traceId } };
  } catch (err) {
    const mapped = mapScanCaptureError(err);
    console.error(JSON.stringify({
      level: 'error',
      event: 'scanAppointment_failed',
      step: 'unknown',
      traceId,
      code: mapped.error,
      message: errMessage(err),
      groupId
    }));
    return errorResponse(mapped.status, mapped.error, mapped.message, traceId, mapped.extra ?? {});
  }
}
