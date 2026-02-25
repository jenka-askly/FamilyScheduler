import { randomUUID } from 'node:crypto';
import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { errorResponse } from '../lib/http/errorResponse.js';
import { requireSessionEmail } from '../lib/auth/requireSession.js';
import { requireActiveMember, resolveActivePersonIdForEmail } from '../lib/auth/requireMembership.js';
import { ensureTraceId, logAuth } from '../lib/logging/authLogs.js';
import { IGNITE_DEFAULT_GRACE_SECONDS } from '../lib/ignite.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';

type IgniteStartBody = { groupId?: unknown; traceId?: unknown };

export async function igniteStart(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as IgniteStartBody;
  const traceId = ensureTraceId(body.traceId);
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  if (!groupId) return errorResponse(400, 'invalid_group_id', 'groupId is required', traceId);
  const session = await requireSessionEmail(request, traceId, { groupId });
  if (!session.ok) return session.response;

  const storage = createStorageAdapter();
  let loaded;
  try { loaded = await storage.load(groupId); } catch (error) { if (error instanceof GroupNotFoundError) return errorResponse(404, 'group_not_found', 'Group not found', traceId); throw error; }
  const membership = requireActiveMember(loaded.state, session.email, traceId);
  if (!membership.ok) return membership.response;
  const caller = membership.member;
  const personId = resolveActivePersonIdForEmail(loaded.state, session.email) ?? caller.memberId;

  const nowISO = new Date().toISOString();
  loaded.state.ignite = {
    sessionId: randomUUID(),
    status: 'OPEN',
    createdAt: nowISO,
    createdByPersonId: personId,
    graceSeconds: IGNITE_DEFAULT_GRACE_SECONDS,
    joinedPersonIds: [],
    photoUpdatedAtByPersonId: {}
  };
  loaded.state.updatedAt = nowISO;
  await storage.save(groupId, loaded.state, loaded.etag);
  logAuth({ component: 'igniteStart', stage: 'started', traceId, groupId });
  return { status: 200, jsonBody: { ok: true, sessionId: loaded.state.ignite.sessionId, status: loaded.state.ignite.status, traceId } };
}
