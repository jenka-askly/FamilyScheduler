import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { errorResponse } from '../lib/http/errorResponse.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';
import { requireSessionEmail } from '../lib/auth/requireSession.js';
import { requireActiveMember } from '../lib/auth/requireMembership.js';

type IgniteCloseBody = { groupId?: unknown; sessionId?: unknown; traceId?: unknown };

export async function igniteClose(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as IgniteCloseBody;
  const traceId = ensureTraceId(body.traceId);
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  if (!groupId) return errorResponse(400, 'invalid_group_id', 'groupId is required', traceId);
  const session = await requireSessionEmail(request, traceId);
  if (!session.ok) return session.response;

  const storage = createStorageAdapter();
  let loaded;
  try { loaded = await storage.load(groupId); } catch (error) { if (error instanceof GroupNotFoundError) return errorResponse(404, 'group_not_found', 'Group not found', traceId); throw error; }
  const membership = requireActiveMember(loaded.state, session.email, traceId);
  if (!membership.ok) return membership.response;

  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  if (!loaded.state.ignite || loaded.state.ignite.sessionId !== sessionId) return errorResponse(410, 'ignite_closed', 'Session closed', traceId);
  loaded.state.ignite.status = 'CLOSED';
  await storage.save(groupId, loaded.state, loaded.etag);
  return { status: 200, jsonBody: { ok: true, status: 'CLOSED', traceId } };
}
