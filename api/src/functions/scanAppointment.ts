import { randomUUID } from 'node:crypto';
import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { createStorageAdapter, MissingConfigError } from '../lib/storage/storageFactory.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { requireSessionEmail } from '../lib/auth/requireSession.js';
import { parseAppointmentFromImage, type ParsedAppointmentFromImage } from '../lib/ai/parseAppointmentFromImage.js';
import { applyParsedFields, createScannedAppointment, decodeImageBase64, validateParsedAppointment, scanBlobKey } from '../lib/scan/appointmentScan.js';
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
type ScanCreateError = { index: number; reason: string };

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function logStepFail(step: string, traceId: string, groupId: string, extra: Record<string, unknown>, err: unknown): void {
  console.error(JSON.stringify({ level: 'error', event: 'scanAppointment_step_failed', step, traceId, groupId, message: errMessage(err), ...extra }));
}

const mapScanCaptureError = (err: unknown): ScanCaptureError => {
  const message = errMessage(err);
  if (message.includes('invalid_image_base64')) return { status: 400, error: 'invalid_image_base64', message: 'Image payload is not valid base64' };
  if (message.includes('image_too_large')) return { status: 413, error: 'image_too_large', message: 'Image exceeds maximum size' };
  if (err instanceof MissingConfigError) return { status: 500, error: 'config_missing', message: 'Storage is not configured' };
  return { status: 500, error: 'scan_capture_failed', message: 'Failed to capture scan image' };
};

const createAndPersistAppointment = async (args: {
  groupId: string;
  timezone: string;
  imageMime: 'image/jpeg' | 'image/png' | 'image/webp';
  imageKey: string;
  parsed: ParsedAppointmentFromImage;
  nowIso: string;
}): Promise<Appointment> => {
  const appointment = createScannedAppointment({ appointments: [] } as any, args.timezone);
  appointment.id = `${Date.now()}-${randomUUID()}`;
  appointment.updatedAt = args.nowIso;
  appointment.scanCapturedAt = args.nowIso;
  appointment.scanImageKey = args.imageKey;
  appointment.scanImageMime = args.imageMime;
  appointment.scanStatus = 'pending';
  applyParsedFields(appointment, args.parsed, 'initial');
  appointment.scanStatus = 'parsed';
  await putAppointmentJson(args.groupId, appointment.id, appointment as unknown as Record<string, unknown>);
  const rowKey = rowKeyFromIso(args.nowIso, appointment.id);
  await upsertAppointmentIndex({ partitionKey: args.groupId, rowKey, appointmentId: appointment.id, startTime: appointment.start, status: 'parsed', hasScan: true, scanCapturedAt: args.nowIso, createdAt: args.nowIso, updatedAt: appointment.updatedAt, isDeleted: false });
  if (isUpcomingStart(appointment.start, args.nowIso)) await adjustGroupCounters(args.groupId, { appointmentCountUpcoming: 1 });
  await incrementDailyMetric('newAppointments', 1);
  return appointment;
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
    const imageRefId = `${Date.now()}-${randomUUID()}`;
    const key = scanBlobKey(groupId, imageRefId, imageMime);
    const bytes = decodeImageBase64(body.imageBase64);
    try {
      await storage.putBinary(key, bytes, imageMime, { groupId, imageRefId, kind: 'scan-image', uploadedAt: now, traceId });
    } catch (e) {
      logStepFail('putBinary', traceId, groupId, { imageRefId }, e);
      return errorResponse(500, 'scan_putBinary_failed', 'Failed to store scan image', traceId);
    }

    let parsed;
    try {
      parsed = await parseAppointmentFromImage({ imageBase64: body.imageBase64, imageMime, timezone: typeof body.timezone === 'string' ? body.timezone : undefined, traceId });
    } catch (error) {
      logStepFail('openai_parse', traceId, groupId, {}, error);
      return errorResponse(502, 'scan_parse_failed', 'Failed to parse appointments from image', traceId);
    }

    const extractedCount = parsed.appointments.length;
    if (extractedCount === 0) {
      console.info(JSON.stringify({ traceId, event: 'scanAppointment_result', groupId, extractedCount, createdCount: 0, errorCount: 0, opId: parsed.opId ?? null }));
      return errorResponse(422, 'no_appointments_found', 'No appointments were found in the image', traceId, { appointmentIds: [], extractedCount, errors: [] });
    }

    const appointmentIds: string[] = [];
    const errors: ScanCreateError[] = [];
    for (const [index, item] of parsed.appointments.entries()) {
      const validation = validateParsedAppointment(item);
      if (!validation.ok) {
        errors.push({ index, reason: validation.reason ?? 'invalid_parsed_item' });
        continue;
      }
      try {
        const created = await createAndPersistAppointment({
          groupId,
          timezone: typeof body.timezone === 'string' ? body.timezone : 'America/Los_Angeles',
          imageMime,
          imageKey: key,
          parsed: item,
          nowIso: new Date().toISOString()
        });
        appointmentIds.push(created.id);
      } catch (error) {
        logStepFail('create_appointment', traceId, groupId, { index }, error);
        errors.push({ index, reason: 'persist_failed' });
      }
    }

    const createdCount = appointmentIds.length;
    console.info(JSON.stringify({ traceId, event: 'scanAppointment_result', groupId, extractedCount, createdCount, errorCount: errors.length, opId: parsed.opId ?? null }));

    if (createdCount === 0) {
      return errorResponse(422, 'no_valid_appointments_found', 'No valid appointments could be created from this image', traceId, { appointmentIds, extractedCount, errors });
    }

    return { status: 200, jsonBody: { ok: true, appointmentIds, appointmentId: appointmentIds[0], extractedCount, errors: errors.length ? errors : undefined, traceId } };
  } catch (err) {
    const mapped = mapScanCaptureError(err);
    console.error(JSON.stringify({ level: 'error', event: 'scanAppointment_failed', step: 'unknown', traceId, code: mapped.error, message: errMessage(err), groupId }));
    return errorResponse(mapped.status, mapped.error, mapped.message, traceId, mapped.extra ?? {});
  }
}
