import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { findActivePersonByPhone, uuidV4Pattern } from '../lib/groupAuth.js';
import { HttpError, requireSessionFromRequest } from '../lib/auth/sessions.js';
import { normalizeEmail, requireActiveMember } from '../lib/auth/requireMembership.js';
import { PhoneValidationError, validateAndNormalizePhone } from '../lib/validation/phone.js';
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

  const groupId = ((typeof body.groupId === 'string' ? body.groupId : undefined) ?? url.searchParams.get('groupId') ?? '').trim();
  if (!uuidV4Pattern.test(groupId)) return errorResponse(400, 'invalid_group_id', 'groupId must be a valid UUID', traceId);

  const sessionId = ((typeof body.sessionId === 'string' ? body.sessionId : undefined) ?? url.searchParams.get('sessionId') ?? '').trim();
  if (!sessionId) return errorResponse(400, 'sessionId_required', 'sessionId is required', traceId);

  const phoneRaw = ((typeof body.phone === 'string' ? body.phone : undefined) ?? url.searchParams.get('phone') ?? '').trim();
  const email = ((typeof body.email === 'string' ? body.email : undefined) ?? url.searchParams.get('email') ?? '').trim();

  let authedEmail: string | null = null;
  try {
    const session = await requireSessionFromRequest(request, traceId, { groupId });
    authedEmail = session.email;
  } catch (error) {
    if (!(error instanceof HttpError)) throw error;
  }

  let phoneE164: string | null = null;
  if (!authedEmail && !email) {
    if (!phoneRaw) return errorResponse(400, 'identity_required', 'phone or email is required', traceId);
    try {
      phoneE164 = validateAndNormalizePhone(phoneRaw).e164;
    } catch (error) {
      if (error instanceof PhoneValidationError) return errorResponse(400, 'invalid_phone', error.message, traceId);
      throw error;
    }
  }

  const storage = createStorageAdapter();
  let loaded;
  try {
    loaded = await storage.load(groupId);
  } catch (error) {
    if (error instanceof GroupNotFoundError) return errorResponse(404, 'group_not_found', 'Group not found', traceId);
    throw error;
  }

  if (authedEmail) {
    const membership = requireActiveMember(loaded.state, authedEmail, traceId);
    if (!membership.ok) return membership.response;
  } else if (email) {
    const membership = requireActiveMember(loaded.state, normalizeEmail(email), traceId);
    if (!membership.ok) return membership.response;
  } else if (!phoneE164 || !findActivePersonByPhone(loaded.state, phoneE164)) {
    return errorResponse(403, 'not_allowed', 'Not allowed', traceId);
  }

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
  return {
    status: 200,
    jsonBody: {
      ok: true,
      status,
      graceSeconds: ignite.graceSeconds,
      closeRequestedAt: ignite.closeRequestedAt,
      joinedCount: ignite.joinedPersonIds.length,
      joinedPersonIds: ignite.joinedPersonIds,
      photoUpdatedAtByPersonId: ignite.photoUpdatedAtByPersonId ?? {},
      createdByPersonId: ignite.createdByPersonId,
      peopleByPersonId,
      serverTime: new Date().toISOString(),
      traceId
    }
  };
}
