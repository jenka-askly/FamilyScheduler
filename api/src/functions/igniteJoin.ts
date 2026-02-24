import { randomUUID } from 'node:crypto';
import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { errorResponse } from '../lib/http/errorResponse.js';
import { IGNITE_DEFAULT_GRACE_SECONDS, igniteIsJoinable } from '../lib/ignite.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';
import { isPlausibleEmail, normalizeEmail, findActiveMemberByEmail } from '../lib/auth/requireMembership.js';

type IgniteJoinBody = { groupId?: unknown; name?: unknown; email?: unknown; sessionId?: unknown; traceId?: unknown };
const normalizeName = (value: unknown): string => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');

export async function igniteJoin(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as IgniteJoinBody;
  const traceId = ensureTraceId(body.traceId);
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  if (!sessionId) return errorResponse(400, 'sessionId_required', 'sessionId is required', traceId);
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  if (!groupId) return errorResponse(400, 'invalid_group_id', 'groupId is required', traceId);
  const name = normalizeName(body.name);
  if (!name) return errorResponse(400, 'name_required', 'name is required', traceId);
  const emailRaw = typeof body.email === 'string' ? body.email : '';
  if (!isPlausibleEmail(emailRaw)) return errorResponse(400, 'invalid_email', 'email is invalid', traceId);
  const email = normalizeEmail(emailRaw);

  const storage = createStorageAdapter();
  let loaded;
  try { loaded = await storage.load(groupId); } catch (error) { if (error instanceof GroupNotFoundError) return errorResponse(404, 'group_not_found', 'Group not found', traceId); throw error; }

  if (!loaded.state.ignite || loaded.state.ignite.sessionId !== sessionId) return errorResponse(410, 'ignite_closed', 'Session closed', traceId);
  const ignite = loaded.state.ignite;
  if (!igniteIsJoinable(ignite)) { ignite.status = 'CLOSED'; await storage.save(groupId, loaded.state, loaded.etag); return errorResponse(410, 'ignite_closed', 'Session closed', traceId); }

  const nowISO = new Date().toISOString();
  const existingMember = findActiveMemberByEmail(loaded.state, email);
  const personId = existingMember?.memberId ?? randomUUID();
  if (!existingMember) {
    loaded.state.members.push({ memberId: personId, email, status: 'active', joinedAt: nowISO });
    loaded.state.people.push({ personId, name, status: 'active', createdAt: nowISO, lastSeen: nowISO, timezone: process.env.TZ ?? 'America/Los_Angeles', notes: '', cellE164: '', cellDisplay: '' });
  }

  if (!ignite.joinedPersonIds.includes(personId)) ignite.joinedPersonIds.push(personId);
  ignite.graceSeconds = ignite.graceSeconds ?? IGNITE_DEFAULT_GRACE_SECONDS;

  await storage.save(groupId, loaded.state, loaded.etag);
  return { status: 200, jsonBody: { ok: true, personId, groupName: loaded.state.groupName, traceId } };
}
