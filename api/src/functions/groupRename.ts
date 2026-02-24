import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { findActivePersonByPhone, validateJoinRequest } from '../lib/groupAuth.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';

type GroupRenameBody = {
  groupId?: unknown;
  phone?: unknown;
  groupName?: unknown;
  traceId?: unknown;
};

const normalizeGroupName = (value: unknown): string => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');

export async function groupRename(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as GroupRenameBody;
  const traceId = ensureTraceId(body.traceId);

  const identity = validateJoinRequest(body.groupId, body.phone);
  if (!identity.ok) {
    return {
      ...identity.response,
      jsonBody: { ...(identity.response.jsonBody as Record<string, unknown>), traceId }
    };
  }

  const nextName = normalizeGroupName(body.groupName);
  if (!nextName) return errorResponse(400, 'bad_request', 'groupName is required', traceId);
  if (nextName.length > 60) return errorResponse(400, 'bad_request', 'groupName must be 60 characters or less', traceId);

  const storage = createStorageAdapter();
  let loaded;
  try {
    loaded = await storage.load(identity.groupId);
  } catch (error) {
    if (error instanceof GroupNotFoundError) return errorResponse(404, 'group_not_found', 'Group not found', traceId);
    throw error;
  }

  const caller = findActivePersonByPhone(loaded.state, identity.phoneE164);
  if (!caller) return errorResponse(403, 'not_allowed', 'Not allowed', traceId);

  loaded.state.groupName = nextName;
  loaded.state.updatedAt = new Date().toISOString();
  await storage.save(identity.groupId, loaded.state, loaded.etag);

  return {
    status: 200,
    jsonBody: { ok: true, groupName: nextName, traceId }
  };
}
