import { randomUUID } from 'node:crypto';
import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { validateJoinRequest, findActivePersonByPhone } from '../lib/groupAuth.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';
import { createScannedAppointment, decodeImageBase64, parseAndApplyScan, scanBlobKey } from '../lib/scan/appointmentScan.js';
import { toResponseSnapshot } from './direct.js';

export async function scanAppointment(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const body = await request.json() as { groupId?: unknown; phone?: unknown; imageBase64?: unknown; imageMime?: unknown; timezone?: unknown };
  const identity = validateJoinRequest(body.groupId, body.phone);
  if (!identity.ok) return identity.response;
  const imageMime = body.imageMime === 'image/jpeg' || body.imageMime === 'image/png' || body.imageMime === 'image/webp' ? body.imageMime : null;
  if (!imageMime || typeof body.imageBase64 !== 'string' || !body.imageBase64.trim()) return errorResponse(400, 'invalid_scan_payload', 'imageBase64 and valid imageMime are required', traceId);

  const storage = createStorageAdapter();
  if (!storage.putBinary) return errorResponse(500, 'storage_missing_binary', 'Storage adapter missing putBinary', traceId);
  let loaded;
  try { loaded = await storage.load(identity.groupId); } catch (error) { if (error instanceof GroupNotFoundError) return errorResponse(404, 'group_not_found', 'Group not found', traceId); throw error; }
  if (!findActivePersonByPhone(loaded.state, identity.phoneE164)) return errorResponse(403, 'not_allowed', 'Not allowed', traceId);

  const appointment = createScannedAppointment(loaded.state, typeof body.timezone === 'string' ? body.timezone : 'America/Los_Angeles');
  loaded.state.appointments.push(appointment);
  const key = scanBlobKey(identity.groupId, appointment.id, imageMime);
  const bytes = decodeImageBase64(body.imageBase64);
  const now = new Date();
  const deleteAfter = new Date(now.getTime() + (180 * 24 * 60 * 60 * 1000)).toISOString();
  await storage.putBinary(key, bytes, imageMime, { groupId: identity.groupId, appointmentId: appointment.id, kind: 'scan-image', uploadedAt: now.toISOString(), deleteAfter });
  appointment.scanImageKey = key;
  appointment.scanImageMime = imageMime;
  const saved = await storage.save(identity.groupId, loaded.state, loaded.etag);

  void (async () => {
    const fresh = await storage.load(identity.groupId);
    const target = fresh.state.appointments.find((item) => item.id === appointment.id);
    if (!target) return;
    await parseAndApplyScan(storage, fresh.state, identity.groupId, target, body.imageBase64 as string, imageMime, typeof body.timezone === 'string' ? body.timezone : undefined, 'initial', traceId);
    await storage.save(identity.groupId, fresh.state, fresh.etag);
  })().catch((error) => console.warn(JSON.stringify({ traceId, stage: 'scan_async_failed', appointmentId: appointment.id, message: error instanceof Error ? error.message : String(error) })));

  return { status: 200, jsonBody: { ok: true, appointmentId: appointment.id, snapshot: toResponseSnapshot(saved.state), traceId: randomUUID() } };
}
