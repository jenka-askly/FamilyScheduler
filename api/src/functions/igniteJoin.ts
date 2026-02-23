import { randomUUID } from 'node:crypto';
import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { findActivePersonByPhone, validateJoinRequest } from '../lib/groupAuth.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { IGNITE_DEFAULT_GRACE_SECONDS, igniteIsJoinable } from '../lib/ignite.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';
import { PhoneValidationError, validateAndNormalizePhone } from '../lib/validation/phone.js';

type IgniteJoinBody = { groupId?: unknown; phone?: unknown; name?: unknown; sessionId?: unknown; traceId?: unknown };

const normalizeName = (value: unknown): string => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');

export async function igniteJoin(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as IgniteJoinBody;
  const traceId = ensureTraceId(body.traceId);
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  if (!sessionId) return errorResponse(400, 'sessionId_required', 'sessionId is required', traceId);
  const name = normalizeName(body.name);
  if (!name) return errorResponse(400, 'name_required', 'name is required', traceId);

  const validated = validateJoinRequest(body.groupId, body.phone);
  if (!validated.ok) return { ...validated.response, jsonBody: { ...(validated.response.jsonBody as Record<string, unknown>), traceId } };

  let normalizedPhone;
  try {
    normalizedPhone = validateAndNormalizePhone(body.phone as string);
  } catch (error) {
    if (error instanceof PhoneValidationError) return errorResponse(400, 'invalid_phone', error.message, traceId);
    throw error;
  }

  const storage = createStorageAdapter();
  let loaded;
  try {
    loaded = await storage.load(validated.groupId);
  } catch (error) {
    if (error instanceof GroupNotFoundError) return errorResponse(404, 'group_not_found', 'Group not found', traceId);
    throw error;
  }

  if (!loaded.state.ignite || loaded.state.ignite.sessionId !== sessionId) return errorResponse(410, 'ignite_closed', 'Session closed', traceId);
  const ignite = loaded.state.ignite;
  if (!igniteIsJoinable(ignite)) {
    ignite.status = 'CLOSED';
    await storage.save(validated.groupId, loaded.state, loaded.etag);
    return errorResponse(410, 'ignite_closed', 'Session closed', traceId);
  }

  const nowISO = new Date().toISOString();
  const existing = findActivePersonByPhone(loaded.state, validated.phoneE164);
  const personId = existing?.personId ?? randomUUID();
  if (!existing) {
    loaded.state.people.push({
      personId,
      name,
      cellE164: normalizedPhone.e164,
      cellDisplay: normalizedPhone.display,
      status: 'active',
      createdAt: nowISO,
      lastSeen: nowISO,
      timezone: process.env.TZ ?? 'America/Los_Angeles',
      notes: ''
    });
  }

  if (!ignite.joinedPersonIds.includes(personId)) ignite.joinedPersonIds.push(personId);
  ignite.graceSeconds = ignite.graceSeconds ?? IGNITE_DEFAULT_GRACE_SECONDS;

  await storage.save(validated.groupId, loaded.state, loaded.etag);
  return { status: 200, jsonBody: { ok: true, personId, groupName: loaded.state.groupName, phoneE164: normalizedPhone.e164, phoneDisplay: normalizedPhone.display, traceId } };
}
