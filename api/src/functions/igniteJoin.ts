import { randomUUID } from 'node:crypto';
import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { authRequestLink } from './authRequestLink.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { IGNITE_DEFAULT_GRACE_SECONDS } from '../lib/ignite.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';
import { ignitePhotoBlobKey } from '../lib/ignite.js';
import { decodeImageBase64 } from '../lib/scan/appointmentScan.js';
import { isPlausibleEmail, normalizeEmail, findActiveMemberByEmail } from '../lib/auth/requireMembership.js';
import { createIgniteGraceSession, requireSessionFromRequest } from '../lib/auth/sessions.js';

type IgniteJoinBody = { groupId?: unknown; name?: unknown; email?: unknown; sessionId?: unknown; photoBase64?: unknown; traceId?: unknown };
const normalizeName = (value: unknown): string => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');
const sessionPrefix = (value: string): string => value.slice(0, 8);

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

  const storage = createStorageAdapter();
  let loaded;
  try { loaded = await storage.load(groupId); } catch (error) { if (error instanceof GroupNotFoundError) return errorResponse(404, 'group_not_found', 'Group not found', traceId); throw error; }

  if (!loaded.state.ignite || loaded.state.ignite.sessionId !== sessionId || loaded.state.ignite.status !== 'OPEN') {
    const tokenKind = loaded.state.ignite?.tokenKind === 'invite-member' ? 'invite-member' : 'breakout';
    return errorResponse(403, 'IGNITE_CLOSED', 'Session closed', traceId, { tokenKind });
  }

  const tokenKind = loaded.state.ignite.tokenKind === 'invite-member' ? 'invite-member' : 'breakout';
  const unauthed = !authedEmail;
  if (tokenKind === 'invite-member' && unauthed) {
    console.log(JSON.stringify({ event: 'ignite_join_decision', joinMode: 'invite_requires_auth', tokenKind, traceId, groupId, igniteSessionPrefix: sessionPrefix(sessionId) }));
    return {
      status: 200,
      jsonBody: {
        ok: false,
        requiresAuth: true,
        reason: 'INVITE_REQUIRES_AUTH',
        tokenKind,
        traceId
      }
    };
  }

  const name = normalizeName(body.name);
  const emailRaw = typeof body.email === 'string' ? body.email : '';
  const photoBase64 = typeof body.photoBase64 === 'string' ? body.photoBase64.trim() : '';
  if (unauthed) {
    if (!name) return errorResponse(400, 'name_required', 'name is required', traceId);
    if (!isPlausibleEmail(emailRaw)) return errorResponse(400, 'invalid_email', 'email is invalid', traceId);
  }
  const email = authedEmail ?? normalizeEmail(emailRaw);

  const nowISO = new Date().toISOString();
  const existingMember = findActiveMemberByEmail(loaded.state, email);
  const personId = existingMember?.memberId ?? randomUUID();
  if (!existingMember) {
    loaded.state.members.push({ memberId: personId, email, status: 'active', joinedAt: nowISO });
    loaded.state.people.push({ personId, name: name || (email.split('@')[0] || 'Guest'), email, status: 'active', createdAt: nowISO, lastSeen: nowISO, timezone: process.env.TZ ?? 'America/Los_Angeles', notes: '', cellE164: '', cellDisplay: '' });
  }

  if (!loaded.state.ignite.joinedPersonIds.includes(personId)) loaded.state.ignite.joinedPersonIds.push(personId);
  loaded.state.ignite.graceSeconds = loaded.state.ignite.graceSeconds ?? IGNITE_DEFAULT_GRACE_SECONDS;
  loaded.state.ignite.photoUpdatedAtByPersonId = loaded.state.ignite.photoUpdatedAtByPersonId ?? {};

  if (photoBase64) {
    if (!storage.putBinary) return errorResponse(500, 'storage_missing_binary', 'Storage adapter missing putBinary', traceId);
    let imageBytes: Buffer;
    try {
      imageBytes = decodeImageBase64(photoBase64);
    } catch (error) {
      const code = (error as Error).message;
      if (code === 'image_too_large') {
        console.log(JSON.stringify({ event: 'ignite_join_photo_rejected', reason: 'image_too_large', traceId, groupId, igniteSessionPrefix: sessionPrefix(sessionId) }));
        return errorResponse(413, 'ignite_photo_too_large', 'Photo is too large', traceId);
      }
      console.log(JSON.stringify({ event: 'ignite_join_photo_rejected', reason: 'invalid_image_base64', traceId, groupId, igniteSessionPrefix: sessionPrefix(sessionId) }));
      return errorResponse(400, 'invalid_photo', 'photoBase64 is invalid', traceId);
    }

    await storage.putBinary(ignitePhotoBlobKey(groupId, sessionId, personId), imageBytes, 'image/jpeg', { groupId, sessionId, personId, kind: 'ignite-photo', uploadedAt: nowISO });
    loaded.state.ignite.photoUpdatedAtByPersonId[personId] = nowISO;
    console.log(JSON.stringify({ event: 'ignite_join_photo_accepted', traceId, groupId, igniteSessionPrefix: sessionPrefix(sessionId), personId }));
  }

  await storage.save(groupId, loaded.state, loaded.etag);

  if (!unauthed) {
    const joinMode = tokenKind === 'invite-member' ? 'invite_authed_join' : 'authed';
    console.log(JSON.stringify({ event: 'ignite_join_decision', joinMode, tokenKind, traceId, groupId, igniteSessionPrefix: sessionPrefix(sessionId) }));
    return { status: 200, jsonBody: { ok: true, breakoutGroupId: groupId, tokenKind, traceId } };
  }

  const missingAuthLinkConfig = ['MAGIC_LINK_SECRET', 'AZURE_COMMUNICATION_CONNECTION_STRING', 'EMAIL_SENDER_ADDRESS']
    .filter((key) => !process.env[key]?.trim());
  const hasRequestHeaders = typeof (request as { headers?: { get?: unknown } }).headers?.get === 'function';

  if (missingAuthLinkConfig.length > 0) {
    console.log(JSON.stringify({ event: 'ignite_join_auth_link_skipped', traceId, reason: 'missing_config', missing: missingAuthLinkConfig }));
  } else if (!hasRequestHeaders) {
    console.log(JSON.stringify({ event: 'ignite_join_auth_link_skipped', traceId, reason: 'missing_request_headers' }));
  } else {
    try {
      await authRequestLink({ ...request, headers: request.headers, json: async () => ({ email, traceId, returnTo: `/g/${groupId}/app` }) } as HttpRequest, context);
    } catch (error) {
      console.log(JSON.stringify({ event: 'ignite_join_auth_link_failed', traceId, message: (error as Error)?.message ?? 'unknown' }));
    }
  }

  const graceTtlSecondsRaw = process.env.IGNITE_GRACE_TTL_SECONDS ?? '1800';
  const graceTtlSeconds = Math.max(60, Number.parseInt(graceTtlSecondsRaw, 10) || 1800);
  let grace: Awaited<ReturnType<typeof createIgniteGraceSession>>;
  try {
    grace = await createIgniteGraceSession(email, groupId, graceTtlSeconds, { scopeIgniteSessionId: sessionId, scopeBreakoutGroupId: groupId });
  } catch (error) {
    console.log(JSON.stringify({
      event: 'ignite_join_grace_session_issue_failed',
      traceId,
      breakoutGroupId: groupId,
      igniteSessionPrefix: sessionPrefix(sessionId),
      message: (error as Error)?.message ?? 'unknown'
    }));
    return errorResponse(500, 'ignite_grace_session_create_failed', 'Unable to create ignite grace session', traceId);
  }

  console.log(JSON.stringify({ event: 'ignite_join_decision', joinMode: 'grace_issued', tokenKind, traceId, groupId, igniteSessionPrefix: sessionPrefix(sessionId) }));
  return {
    status: 200,
    jsonBody: {
      ok: true,
      breakoutGroupId: groupId,
      tokenKind,
      sessionId: grace.sessionId,
      graceExpiresAtUtc: grace.expiresAtISO,
      requiresVerification: true,
      traceId
    }
  };
}
