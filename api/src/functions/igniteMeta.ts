import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireIdentityFromRequest } from '../lib/groupAuth.js';
import { requireActiveMember } from '../lib/auth/requireMembership.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { igniteEffectiveStatus } from '../lib/ignite.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';

export async function igniteMeta(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const url = new URL(request.url);
  const body = request.method === 'POST' ? await request.json() as Record<string, unknown> : {};

  const traceId = ensureTraceId(
    (typeof body.traceId === 'string' ? body.traceId : undefined)
    ?? url.searchParams.get('traceId')
  );

  const groupId = (typeof body.groupId === 'string' ? body.groupId : undefined) ?? url.searchParams.get('groupId') ?? '';
  const identity = await requireIdentityFromRequest(request, traceId, {
    groupId,
    allowUnauthEmail: true,
    body,
    query: url.searchParams
  });
  if (!identity.ok) return identity.response;

  const sessionId = ((typeof body.sessionId === 'string' ? body.sessionId : undefined) ?? url.searchParams.get('sessionId') ?? '').trim();
  if (!sessionId) return errorResponse(400, 'sessionId_required', 'sessionId is required', traceId);

  const storage = createStorageAdapter();
  let loaded;
  try {
    loaded = await storage.load(identity.groupId);
  } catch (error) {
    if (error instanceof GroupNotFoundError) return errorResponse(404, 'group_not_found', 'Group not found', traceId);
    throw error;
  }

  const membership = requireActiveMember(loaded.state, identity.email, traceId);
  if (!membership.ok) return membership.response;
  if (!loaded.state.ignite || loaded.state.ignite.sessionId !== sessionId) return errorResponse(404, 'ignite_not_found', 'Ignite session not found', traceId);

  const ignite = loaded.state.ignite;
  const relevantPersonIds = new Set<string>([
    ignite.createdByPersonId,
    ...ignite.joinedPersonIds
  ]);
  const peopleByPersonId: Record<string, { name: string }> = {};
  relevantPersonIds.forEach((personId) => {
    const person = loaded.state.people.find((candidate) => candidate.personId === personId);
    if (person?.name) {
      peopleByPersonId[personId] = { name: person.name };
      return;
    }
    peopleByPersonId[personId] = { name: personId };
  });
  const status = igniteEffectiveStatus(ignite);
  const joinedCount = new Set<string>([
    ...ignite.joinedPersonIds,
    ...(ignite.createdByPersonId ? [ignite.createdByPersonId] : [])
  ]).size;
  return {
    status: 200,
    jsonBody: {
      ok: true,
      status,
      graceSeconds: ignite.graceSeconds,
      closeRequestedAt: ignite.closeRequestedAt,
      joinedCount,
      joinedPersonIds: ignite.joinedPersonIds,
      photoUpdatedAtByPersonId: ignite.photoUpdatedAtByPersonId ?? {},
      createdByPersonId: ignite.createdByPersonId,
      peopleByPersonId,
      serverTime: new Date().toISOString(),
      traceId
    }
  };
}
