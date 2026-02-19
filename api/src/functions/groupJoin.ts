import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { findActivePersonByPhone, validateJoinRequest } from '../lib/groupAuth.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';

type JoinBody = { groupId?: unknown; phone?: unknown };

const storage = createStorageAdapter();

export async function groupJoin(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as JoinBody;
  const validated = validateJoinRequest(body.groupId, body.phone);
  if (!validated.ok) return validated.response;

  try {
    const loaded = await storage.load(validated.groupId);
    const person = findActivePersonByPhone(loaded.state, validated.phoneE164);
    if (!person) return { status: 403, jsonBody: { ok: false, error: 'not_allowed' } };

    return { status: 200, jsonBody: { ok: true, personId: person.personId, groupName: loaded.state.groupName } };
  } catch (error) {
    if (error instanceof GroupNotFoundError) return { status: 404, jsonBody: { ok: false, error: 'group_not_found' } };
    throw error;
  }
}
