import { randomBytes } from 'node:crypto';
import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { sendEmail } from '../lib/email/acsEmail.js';
import { isPlausibleEmail, normalizeEmail } from '../lib/auth/requireMembership.js';
import { HttpError, requireSessionFromRequest } from '../lib/auth/sessions.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { normalizeIdentityEmail, userKeyFromEmail } from '../lib/identity/userKey.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import {
  getGroupEntity,
  getGroupMemberEntity,
  getInviteRateLimitEntity,
  getInviteTokenEntity,
  getUserProfileEntity,
  upsertGroupMember,
  upsertInviteRateLimitEntity,
  upsertInviteTokenEntity,
  upsertUserGroup,
  type GroupMembersEntity,
  type InviteEmailStatus,
  type InviteRateLimitEntity,
  type UserGroupsEntity
} from '../lib/tables/entities.js';
import { requireGroupMembership } from '../lib/tables/membership.js';
import { ensureTablesReady } from '../lib/tables/withTables.js';
import { resolveOrigin } from './groupJoin.js';

type InviteBody = {
  groupId?: unknown;
  recipientEmail?: unknown;
  recipientName?: unknown;
  personalMessage?: unknown;
  traceId?: unknown;
};

type FailureCode = 'invalid_address' | 'suppressed' | 'provider_rejected' | 'rate_limited' | 'config_missing' | 'transient' | 'unknown';

const MAX_PERSONAL_MESSAGE = 500;
const MAX_PROVIDER_MESSAGE = 200;
const INVITES_PER_MINUTE = 10;
const INVITES_PER_DAY = 100;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const getWebBaseUrl = (request: HttpRequest): string | null => {
  const explicit = process.env.WEB_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  return resolveOrigin(request);
};

const truncate = (value: string, max: number): string => value.length <= max ? value : value.slice(0, max);

const mapProviderFailure = (error: unknown): { code: FailureCode; message: string } => {
  const message = error instanceof Error ? error.message : String(error);
  const lowered = message.toLowerCase();
  if (lowered.includes('missing_email_env')) return { code: 'config_missing', message };
  if (lowered.includes('invalid') && lowered.includes('address')) return { code: 'invalid_address', message };
  if (lowered.includes('suppressed')) return { code: 'suppressed', message };
  if (lowered.includes('rate') || lowered.includes('429')) return { code: 'rate_limited', message };
  if (lowered.includes('reject')) return { code: 'provider_rejected', message };
  if (lowered.includes('timeout') || lowered.includes('temporar')) return { code: 'transient', message };
  return { code: 'unknown', message };
};

const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const withBreaks = (value: string): string => escapeHtml(value).replace(/\n/g, '<br/>');

const upsertRateLimitCounter = async (inviterEmail: string, scope: 'minute' | 'day', now: Date): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> => {
  const windowStartIso = scope === 'minute'
    ? new Date(Math.floor(now.getTime() / MINUTE_MS) * MINUTE_MS).toISOString()
    : `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;
  const rowKey = `${scope}:${windowStartIso}`;
  const limit = scope === 'minute' ? INVITES_PER_MINUTE : INVITES_PER_DAY;
  const expiresAt = new Date(now.getTime() + (scope === 'minute' ? MINUTE_MS : DAY_MS)).toISOString();
  const existing = await getInviteRateLimitEntity(inviterEmail, rowKey);
  const nextCount = (existing?.count ?? 0) + 1;
  const entity: InviteRateLimitEntity = {
    partitionKey: inviterEmail,
    rowKey,
    count: nextCount,
    updatedAt: now.toISOString(),
    expiresAt
  };
  await upsertInviteRateLimitEntity(entity);
  if (nextCount > limit) {
    const retryAfterSec = scope === 'minute'
      ? Math.max(1, Math.ceil((Date.parse(windowStartIso) + MINUTE_MS - now.getTime()) / 1000))
      : Math.max(1, Math.ceil((Date.parse(windowStartIso) + DAY_MS - now.getTime()) / 1000));
    return { ok: false, retryAfterSec };
  }
  return { ok: true };
};

const ensureInviteRateLimit = async (inviterEmail: string, now: Date): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> => {
  const minuteWindow = await upsertRateLimitCounter(inviterEmail, 'minute', now);
  if (!minuteWindow.ok) return minuteWindow;
  return upsertRateLimitCounter(inviterEmail, 'day', now);
};

const computeInviteToken = async (groupId: string, recipientEmail: string, inviterEmail: string, nowIso: string): Promise<string> => {
  const existing = await getInviteTokenEntity(groupId, recipientEmail);
  const token = existing?.token ?? randomBytes(24).toString('base64url');
  await upsertInviteTokenEntity({
    partitionKey: groupId,
    rowKey: recipientEmail,
    groupId,
    recipientEmail,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
    expiresAt: new Date(Date.parse(nowIso) + 14 * DAY_MS).toISOString(),
    createdByEmail: inviterEmail,
    token
  });
  return token;
};

const buildMembershipEntities = (params: {
  groupId: string;
  recipientUserKey: string;
  recipientEmail: string;
  nowIso: string;
  invitedAt?: string;
  inviterEmail: string;
  inviterName: string;
  inviteStatus?: InviteEmailStatus;
  inviteFailedReason?: string;
  inviteProviderMessage?: string;
  inviteLastAttemptAtUtc?: string;
  existingGroupMember?: GroupMembersEntity | null;
}): { groupMember: GroupMembersEntity; userGroup: UserGroupsEntity } => {
  const invitedAt = params.existingGroupMember?.invitedAt ?? params.invitedAt ?? params.nowIso;
  const groupMember: GroupMembersEntity = {
    partitionKey: params.groupId,
    rowKey: params.recipientUserKey,
    userKey: params.recipientUserKey,
    email: params.recipientEmail,
    status: 'invited',
    invitedAt,
    joinedAt: undefined,
    removedAt: undefined,
    updatedAt: params.nowIso,
    memberKind: params.existingGroupMember?.memberKind,
    emailVerified: params.existingGroupMember?.emailVerified,
    lastSeenAtUtc: params.existingGroupMember?.lastSeenAtUtc,
    invitedByEmail: params.inviterEmail,
    invitedByName: params.inviterName,
    inviteEmailStatus: params.inviteStatus ?? 'not_sent',
    inviteEmailLastAttemptAtUtc: params.inviteLastAttemptAtUtc,
    inviteEmailFailedReason: params.inviteFailedReason,
    inviteEmailProviderMessage: params.inviteProviderMessage
  };
  const userGroup: UserGroupsEntity = {
    partitionKey: params.recipientUserKey,
    rowKey: params.groupId,
    groupId: params.groupId,
    status: 'invited',
    invitedAt,
    joinedAt: undefined,
    removedAt: undefined,
    updatedAt: params.nowIso,
    memberKind: params.existingGroupMember?.memberKind,
    emailVerified: params.existingGroupMember?.emailVerified,
    lastSeenAtUtc: params.existingGroupMember?.lastSeenAtUtc,
    invitedByEmail: params.inviterEmail,
    invitedByName: params.inviterName,
    inviteEmailStatus: params.inviteStatus ?? 'not_sent',
    inviteEmailLastAttemptAtUtc: params.inviteLastAttemptAtUtc,
    inviteEmailFailedReason: params.inviteFailedReason,
    inviteEmailProviderMessage: params.inviteProviderMessage
  };
  return { groupMember, userGroup };
};

export async function groupInviteEmail(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as InviteBody;
  const traceId = ensureTraceId(body.traceId);
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  if (!groupId) return errorResponse(400, 'invalid_group_id', 'groupId is required', traceId);

  const recipientEmailRaw = typeof body.recipientEmail === 'string' ? body.recipientEmail.trim() : '';
  if (!isPlausibleEmail(recipientEmailRaw)) return errorResponse(400, 'invalid_email', 'recipientEmail is invalid', traceId);
  const recipientEmail = normalizeIdentityEmail(recipientEmailRaw);
  const recipientName = typeof body.recipientName === 'string' ? body.recipientName.trim() : '';
  const personalMessage = typeof body.personalMessage === 'string' ? body.personalMessage.trim().slice(0, MAX_PERSONAL_MESSAGE) : '';

  let session;
  try {
    session = await requireSessionFromRequest(request, traceId, { groupId });
  } catch (error) {
    if (error instanceof HttpError) return error.response;
    throw error;
  }

  await ensureTablesReady();
  const inviter = await requireGroupMembership({ groupId, email: session.email, traceId, allowStatuses: ['active'], endpoint: 'groupInviteEmail' });
  if (!inviter.ok) return inviter.response;

  const group = await getGroupEntity(groupId);
  if (!group || group.isDeleted) return errorResponse(404, 'group_not_found', 'Group not found', traceId);

  const inviterEmail = normalizeEmail(session.email);
  const rateLimit = await ensureInviteRateLimit(inviterEmail, new Date());
  if (!rateLimit.ok) return {
    status: 429,
    headers: { 'retry-after': `${rateLimit.retryAfterSec}` },
    jsonBody: { ok: false, error: 'rate_limited', message: 'Invite rate limit reached. Please try again later.', traceId }
  };

  const inviterProfile = await getUserProfileEntity(userKeyFromEmail(inviterEmail));
  const inviterName = inviterProfile?.displayName?.trim() || inviterEmail;
  const recipientUserKey = userKeyFromEmail(recipientEmail);
  const existingInvitee = await getGroupMemberEntity(groupId, recipientUserKey);
  if (existingInvitee?.status === 'active') {
    return {
      status: 200,
      jsonBody: {
        ok: true,
        membershipStatus: 'active',
        emailSent: false,
        inviteEmailStatus: existingInvitee.inviteEmailStatus ?? 'not_sent',
        reason: 'already_member',
        traceId
      }
    };
  }

  const nowIso = new Date().toISOString();
  const initial = buildMembershipEntities({
    groupId,
    recipientUserKey,
    recipientEmail,
    nowIso,
    invitedAt: nowIso,
    inviterEmail,
    inviterName,
    existingGroupMember: existingInvitee,
    inviteStatus: existingInvitee?.inviteEmailStatus ?? 'not_sent',
    inviteFailedReason: existingInvitee?.inviteEmailFailedReason,
    inviteProviderMessage: existingInvitee?.inviteEmailProviderMessage,
    inviteLastAttemptAtUtc: existingInvitee?.inviteEmailLastAttemptAtUtc
  });
  await upsertGroupMember(initial.groupMember);
  await upsertUserGroup(initial.userGroup);

  const baseUrl = getWebBaseUrl(request);
  if (!baseUrl) return errorResponse(500, 'origin_unresolved', 'Unable to resolve web origin', traceId);

  const inviteToken = await computeInviteToken(groupId, recipientEmail, inviterEmail, nowIso);
  const inviteUrl = `${baseUrl}/#/join?groupId=${encodeURIComponent(groupId)}&token=${encodeURIComponent(inviteToken)}`;
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi,';
  const safeMessage = personalMessage ? personalMessage : '';
  const escapedMessage = safeMessage ? withBreaks(safeMessage) : '';
  const plainPersonalMessage = safeMessage ? `\n\nMessage from ${inviterName}:\n${safeMessage}` : '';

  const subject = `${inviterName} invited you to ${group.groupName}`;
  const plainText = `${greeting}\n\n${inviterName} (${inviterEmail}) invited you to join the group \"${group.groupName}\" in FamilyScheduler.${plainPersonalMessage}\n\nJoin group: ${inviteUrl}\n\nIf you were not expecting this email, you can ignore it.`;
  const html = `<p>${escapeHtml(greeting)}</p>
<p><strong>${escapeHtml(inviterName)}</strong> (${escapeHtml(inviterEmail)}) invited you to join the group <strong>${escapeHtml(group.groupName)}</strong> in FamilyScheduler.</p>
${escapedMessage ? `<p><strong>Message from ${escapeHtml(inviterName)}:</strong><br/>${escapedMessage}</p>` : ''}
<p><a href="${escapeHtml(inviteUrl)}">Join group</a></p>
<p>If the button does not work, copy and paste this link into your browser:<br/>${escapeHtml(inviteUrl)}</p>
<p>If you were not expecting this email, you can ignore it.</p>`;

  try {
    await sendEmail({
      to: recipientEmail,
      subject,
      plainText,
      html,
      replyTo: inviterEmail
    });
    const sentAt = new Date().toISOString();
    const sentState = buildMembershipEntities({
      groupId,
      recipientUserKey,
      recipientEmail,
      nowIso: sentAt,
      invitedAt: initial.groupMember.invitedAt,
      inviterEmail,
      inviterName,
      existingGroupMember: initial.groupMember,
      inviteStatus: 'sent',
      inviteLastAttemptAtUtc: sentAt,
      inviteFailedReason: undefined,
      inviteProviderMessage: undefined
    });
    await upsertGroupMember(sentState.groupMember);
    await upsertUserGroup(sentState.userGroup);
    console.info(JSON.stringify({ event: 'invite_email_attempt', traceId, groupId, inviterEmail, recipientEmail, result: 'sent' }));
    return { status: 200, jsonBody: { ok: true, membershipStatus: 'invited', emailSent: true, inviteEmailStatus: 'sent', inviteUrl, traceId } };
  } catch (error) {
    const mapped = mapProviderFailure(error);
    const failedAt = new Date().toISOString();
    const failedState = buildMembershipEntities({
      groupId,
      recipientUserKey,
      recipientEmail,
      nowIso: failedAt,
      invitedAt: initial.groupMember.invitedAt,
      inviterEmail,
      inviterName,
      existingGroupMember: initial.groupMember,
      inviteStatus: 'failed',
      inviteLastAttemptAtUtc: failedAt,
      inviteFailedReason: mapped.code,
      inviteProviderMessage: truncate(mapped.message, MAX_PROVIDER_MESSAGE)
    });
    await upsertGroupMember(failedState.groupMember);
    await upsertUserGroup(failedState.userGroup);
    console.warn(JSON.stringify({ event: 'invite_email_attempt', traceId, groupId, inviterEmail, recipientEmail, result: 'failed', reason: mapped.code }));
    return {
      status: 200,
      jsonBody: {
        ok: true,
        membershipStatus: 'invited',
        emailSent: false,
        inviteEmailStatus: 'failed',
        inviteEmailFailedReason: mapped.code,
        inviteUrl,
        traceId
      }
    };
  }
}
