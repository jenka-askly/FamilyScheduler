import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { findActivePersonByPhone, validateJoinRequest } from '../lib/groupAuth.js';
import { ensureTraceId, logAuth } from '../lib/logging/authLogs.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';

type JoinBody = { groupId?: unknown; phone?: unknown; traceId?: unknown };

const storage = createStorageAdapter();

export async function groupJoin(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as JoinBody;
  const traceId = ensureTraceId(body.traceId);
  const validated = validateJoinRequest(body.groupId, body.phone);
  if (!validated.ok) {
    logAuth({ traceId, stage: 'join_out', ok: false, error: 'invalid_request' });
    return validated.response;
  }

  logAuth({ traceId, stage: 'join_in', groupId: validated.groupId, phoneProvided: true });

  try {
    const loaded = await storage.load(validated.groupId);
    const person = findActivePersonByPhone(loaded.state, validated.phoneE164);
    logAuth({ traceId, stage: 'join_check', groupId: validated.groupId, matchedPeopleCount: person ? 1 : 0, ok: !!person });
    if (!person) {
      logAuth({ traceId, stage: 'join_out', ok: false, error: 'not_allowed' });
      return { status: 403, jsonBody: { ok: false, error: 'not_allowed' } };
    }

    logAuth({ traceId, stage: 'join_out', ok: true, error: null });
    return { status: 200, jsonBody: { ok: true, personId: person.personId, groupName: loaded.state.groupName } };
  } catch (error) {
    if (error instanceof GroupNotFoundError) {
      logAuth({ traceId, stage: 'join_out', ok: false, error: 'group_not_found' });
      return { status: 404, jsonBody: { ok: false, error: 'group_not_found' } };
    }
    throw error;
  }
}
