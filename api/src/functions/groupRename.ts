import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { errorResponse } from '../lib/http/errorResponse.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';
import { requireSessionEmail } from '../lib/auth/requireSession.js';
import { requireActiveMember } from '../lib/auth/requireMembership.js';

type GroupRenameBody = {
  groupId?: unknown;
  groupName?: unknown;
  traceId?: unknown;
};

const normalizeGroupName = (value: unknown): string => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');

export async function groupRename(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as GroupRenameBody;
  const traceId = ensureTraceId(body.traceId);
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  if (!groupId) return errorResponse(400, 'invalid_group_id', 'groupId is required', traceId);
  const session = await requireSessionEmail(request, traceId, { groupId });
  if (!session.ok) return session.response;

  const nextName = normalizeGroupName(body.groupName);
  if (!nextName) return errorResponse(400, 'bad_request', 'groupName is required', traceId);
  if (nextName.length > 60) return errorResponse(400, 'bad_request', 'groupName must be 60 characters or less', traceId);

  const storage = createStorageAdapter();
  let loaded;
  try {
    loaded = await storage.load(groupId);
  } catch (error) {
    if (error instanceof GroupNotFoundError) return errorResponse(404, 'group_not_found', 'Group not found', traceId);
    throw error;
  }

  const caller = requireActiveMember(loaded.state, session.email, traceId);
  if (!caller.ok) return caller.response;

  loaded.state.groupName = nextName;
  loaded.state.updatedAt = new Date().toISOString();
  await storage.save(groupId, loaded.state, loaded.etag);

  return {
    status: 200,
    jsonBody: { ok: true, groupName: nextName, traceId }
  };
}
