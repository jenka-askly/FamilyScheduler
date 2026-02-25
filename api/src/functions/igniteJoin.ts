import { randomUUID } from 'node:crypto';
import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { authRequestLink } from './authRequestLink.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { IGNITE_DEFAULT_GRACE_SECONDS } from '../lib/ignite.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';
import { isPlausibleEmail, normalizeEmail, findActiveMemberByEmail } from '../lib/auth/requireMembership.js';
import { createIgniteGraceSession, requireSessionFromRequest } from '../lib/auth/sessions.js';

type IgniteJoinBody = { groupId?: unknown; name?: unknown; email?: unknown; sessionId?: unknown; traceId?: unknown };
const normalizeName = (value: unknown): string => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');

export async function igniteJoin(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as IgniteJoinBody;
  const traceId = ensureTraceId(body.traceId);
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  if (!sessionId) return errorResponse(400, 'sessionId_required', 'sessionId is required', traceId);
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  if (!groupId) return errorResponse(400, 'invalid_group_id', 'groupId is required', traceId);

  let authedEmail: string | null = null;
  try {
    const session = await requireSessionFromRequest(request, traceId, { groupId });
    authedEmail = session.email;
  } catch {
    authedEmail = null;
  }

  const name = normalizeName(body.name);
  const emailRaw = typeof body.email === 'string' ? body.email : '';
  const unauthed = !authedEmail;
  if (unauthed) {
    if (!name) return errorResponse(400, 'name_required', 'name is required', traceId);
    if (!isPlausibleEmail(emailRaw)) return errorResponse(400, 'invalid_email', 'email is invalid', traceId);
  }
  const email = authedEmail ?? normalizeEmail(emailRaw);

  const storage = createStorageAdapter();
  let loaded;
  try { loaded = await storage.load(groupId); } catch (error) { if (error instanceof GroupNotFoundError) return errorResponse(404, 'group_not_found', 'Group not found', traceId); throw error; }

  if (!loaded.state.ignite || loaded.state.ignite.sessionId !== sessionId || loaded.state.ignite.status !== 'OPEN') {
    return errorResponse(403, 'IGNITE_CLOSED', 'Session closed', traceId);
  }

  const nowISO = new Date().toISOString();
  const existingMember = findActiveMemberByEmail(loaded.state, email);
  const personId = existingMember?.memberId ?? randomUUID();
  if (!existingMember) {
    loaded.state.members.push({ memberId: personId, email, status: 'active', joinedAt: nowISO });
    loaded.state.people.push({ personId, name: name || (email.split('@')[0] || 'Guest'), email, status: 'active', createdAt: nowISO, lastSeen: nowISO, timezone: process.env.TZ ?? 'America/Los_Angeles', notes: '', cellE164: '', cellDisplay: '' });
  }

  if (!loaded.state.ignite.joinedPersonIds.includes(personId)) loaded.state.ignite.joinedPersonIds.push(personId);
  loaded.state.ignite.graceSeconds = loaded.state.ignite.graceSeconds ?? IGNITE_DEFAULT_GRACE_SECONDS;

  await storage.save(groupId, loaded.state, loaded.etag);

  if (!unauthed) {
    return { status: 200, jsonBody: { ok: true, breakoutGroupId: groupId, traceId } };
  }

  try {
    await authRequestLink({ ...request, json: async () => ({ email, traceId, returnTo: `/g/${groupId}/app` }) } as HttpRequest, context);
  } catch (error) {
    console.log(JSON.stringify({ event: 'ignite_join_auth_link_failed', traceId, message: (error as Error)?.message ?? 'unknown' }));
  }

  const graceTtlSeconds = 30;
  const grace = await createIgniteGraceSession(email, groupId, graceTtlSeconds, { scopeIgniteSessionId: sessionId });
  console.log(JSON.stringify({ event: 'ignite_grace_session_issued', traceId, groupId, igniteSessionId: sessionId, sessionIdPrefix: grace.sessionId.slice(0, 8), expiresAtUtc: grace.expiresAtISO }));

  return {
    status: 200,
    jsonBody: {
      ok: true,
      breakoutGroupId: groupId,
      sessionId: grace.sessionId,
      graceExpiresAtUtc: grace.expiresAtISO,
      requiresVerification: true,
      traceId
    }
  };
}
