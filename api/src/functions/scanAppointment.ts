import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { requireSessionEmail } from '../lib/auth/requireSession.js';
import { requireActiveMember } from '../lib/auth/requireMembership.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';
import { createScannedAppointment, decodeImageBase64, parseAndApplyScan, scanBlobKey } from '../lib/scan/appointmentScan.js';
import { toResponseSnapshot } from './direct.js';

export async function scanAppointment(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  let opId: string | undefined;
  const traceId = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const body = await request.json() as { groupId?: unknown; imageBase64?: unknown; imageMime?: unknown; timezone?: unknown };
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  if (!groupId) return errorResponse(400, 'invalid_group_id', 'groupId is required', traceId);
  const session = await requireSessionEmail(request, traceId);
  if ('status' in session) return session;
  const imageMime = body.imageMime === 'image/jpeg' || body.imageMime === 'image/png' || body.imageMime === 'image/webp' ? body.imageMime : null;
  if (!imageMime || typeof body.imageBase64 !== 'string' || !body.imageBase64.trim()) return errorResponse(400, 'invalid_scan_payload', 'imageBase64 and valid imageMime are required', traceId);

  const storage = createStorageAdapter();
  if (!storage.putBinary) return errorResponse(500, 'storage_missing_binary', 'Storage adapter missing putBinary', traceId);
  let loaded;
  try { loaded = await storage.load(groupId); } catch (error) { if (error instanceof GroupNotFoundError) return errorResponse(404, 'group_not_found', 'Group not found', traceId); throw error; }
  const member = requireActiveMember(loaded.state, session.email, traceId);
  if ('status' in member) return member;

  const appointment = createScannedAppointment(loaded.state, typeof body.timezone === 'string' ? body.timezone : 'America/Los_Angeles');
  loaded.state.appointments.push(appointment);
  const key = scanBlobKey(groupId, appointment.id, imageMime);
  const bytes = decodeImageBase64(body.imageBase64);
  const now = new Date();
  const deleteAfter = new Date(now.getTime() + (180 * 24 * 60 * 60 * 1000)).toISOString();
  await storage.putBinary(key, bytes, imageMime, { groupId: groupId, appointmentId: appointment.id, kind: 'scan-image', uploadedAt: now.toISOString(), deleteAfter });
  appointment.scanImageKey = key;
  appointment.scanImageMime = imageMime;
  const saved = await storage.save(groupId, loaded.state, loaded.etag);

  void (async () => {
    const fresh = await storage.load(groupId);
    const target = fresh.state.appointments.find((item) => item.id === appointment.id);
    if (!target) return;
    const scanResult = await parseAndApplyScan(storage, fresh.state, groupId, target, body.imageBase64 as string, imageMime, typeof body.timezone === 'string' ? body.timezone : undefined, 'initial', traceId);
    opId = scanResult.opId;
    await storage.save(groupId, fresh.state, fresh.etag);
  })().catch((error) => console.warn(JSON.stringify({ traceId, stage: 'scan_async_failed', appointmentId: appointment.id, message: error instanceof Error ? error.message : String(error) })));

  return { status: 200, jsonBody: { ok: true, appointmentId: appointment.id, snapshot: toResponseSnapshot(saved.state), traceId, opId: opId ?? null } };
}
