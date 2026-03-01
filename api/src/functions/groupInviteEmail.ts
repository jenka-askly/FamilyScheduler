import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomBytes, randomUUID } from 'node:crypto';
import { sendEmail } from '../lib/email/acsEmail.js';
import { HttpError, requireSessionFromRequest } from '../lib/auth/sessions.js';
import { isPlausibleEmail } from '../lib/auth/requireMembership.js';
import { userKeyFromEmail } from '../lib/identity/userKey.js';
import { errorResponse, logConfigMissing } from '../lib/http/errorResponse.js';
import {
  adjustGroupCounters,
  getGroupEntity,
  getGroupMemberEntity,
  getTableEntity,
  upsertGroupMember,
  upsertTableEntity,
  upsertUserGroup,
  upsertUserProfile,
  type GroupMembersEntity,
  type UserGroupsEntity,
  type UserProfileEntity
} from '../lib/tables/entities.js';
import { ensureTablesReady } from '../lib/tables/withTables.js';
import { requireGroupMembership } from '../lib/tables/membership.js';
import { incrementDailyMetric } from '../lib/tables/metrics.js';
import { resolveOrigin } from './groupJoin.js';

type InviteByEmailBody = {
  groupId?: unknown;
  recipientEmail?: unknown;
  recipientName?: unknown;
  personalMessage?: unknown;
  traceId?: unknown;
};

type InviteTokenEntity = {
  partitionKey: string;
  rowKey: string;
  token: string;
  groupId: string;
  recipientEmail: string;
  createdAt: string;
  expiresAt: string;
  createdByEmail: string;
  updatedAt: string;
};

type InviteEmailStatus = 'sent' | 'failed' | 'not_sent';

const INVITE_EMAIL_PERSONAL_MESSAGE_MAX = 500;
const INVITE_EMAIL_PROVIDER_MESSAGE_MAX = 200;
const INVITE_TOKEN_TTL_DAYS = 14;

const inviteFailureReasonToLabel: Record<string, string> = {
  invalid_address: 'Invalid recipient address',
  suppressed: 'Recipient address is suppressed',
  provider_rejected: 'Email provider rejected the send request',
  rate_limited: 'Too many invite emails sent recently',
  config_missing: 'Email is not configured on the server',
  transient: 'Temporary provider issue',
  unknown: 'Unknown delivery failure'
};

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const normalizeDisplayName = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed || undefined;
};

const normalizePersonalMessage = (value: unknown): { ok: true; message?: string } | { ok: false } => {
  if (typeof value !== 'string') return { ok: true };
  const trimmed = value.trim();
  if (!trimmed) return { ok: true };
  if (trimmed.length > INVITE_EMAIL_PERSONAL_MESSAGE_MAX) return { ok: false };
  return { ok: true, message: trimmed };
};

const htmlEscape = (value: string): string => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const truncate = (value: string | undefined, max: number): string | undefined => {
  if (!value) return undefined;
  return value.length > max ? value.slice(0, max) : value;
};

const mapProviderFailureReason = (error: unknown): { reason: string; providerMessage?: string } => {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid') && normalized.includes('address')) return { reason: 'invalid_address', providerMessage: message };
  if (normalized.includes('suppressed')) return { reason: 'suppressed', providerMessage: message };
  if (normalized.includes('rate') || normalized.includes('thrott')) return { reason: 'rate_limited', providerMessage: message };
  if (normalized.includes('reject') || normalized.includes('denied') || normalized.includes('blocked')) return { reason: 'provider_rejected', providerMessage: message };
  if (normalized.includes('timeout') || normalized.includes('temporar') || normalized.includes('unavailable')) return { reason: 'transient', providerMessage: message };
  if (normalized.includes('missing_email_env') || normalized.includes('config')) return { reason: 'config_missing', providerMessage: message };
  return { reason: 'unknown', providerMessage: message };
};

const resolveInviterName = (profile: UserProfileEntity | null, inviterEmail: string): string => {
  const display = normalizeDisplayName(profile?.displayName);
  return display ?? inviterEmail;
};

const getOrCreateInviteToken = async ({
  groupId,
  recipientEmail,
  inviterEmail,
  now
}: {
  groupId: string;
  recipientEmail: string;
  inviterEmail: string;
  now: string;
}): Promise<InviteTokenEntity> => {
  const existing = await getTableEntity<InviteTokenEntity>('GroupInviteTokens', groupId, recipientEmail);
  const token = existing?.token ?? randomBytes(24).toString('base64url');
  const entity: InviteTokenEntity = {
    partitionKey: groupId,
    rowKey: recipientEmail,
    token,
    groupId,
    recipientEmail,
    createdAt: existing?.createdAt ?? now,
    expiresAt: new Date(Date.parse(now) + INVITE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    createdByEmail: existing?.createdByEmail ?? inviterEmail,
    updatedAt: now
  };
  await upsertTableEntity('GroupInviteTokens', entity);
  return entity;
};

const applyInviteEmailState = async (
  groupMember: GroupMembersEntity,
  userGroup: UserGroupsEntity,
  state: {
    status: InviteEmailStatus;
    lastAttemptAtUtc: string;
    failedReason?: string;
    providerMessage?: string;
  }
): Promise<void> => {
  const nextMember: GroupMembersEntity = {
    ...groupMember,
    inviteEmailStatus: state.status,
    inviteEmailLastAttemptAtUtc: state.lastAttemptAtUtc,
    inviteEmailFailedReason: state.failedReason,
    inviteEmailProviderMessage: truncate(state.providerMessage, INVITE_EMAIL_PROVIDER_MESSAGE_MAX),
    updatedAt: state.lastAttemptAtUtc
  };

  const nextUserGroup: UserGroupsEntity = {
    ...userGroup,
    inviteEmailStatus: state.status,
    inviteEmailLastAttemptAtUtc: state.lastAttemptAtUtc,
    inviteEmailFailedReason: state.failedReason,
    inviteEmailProviderMessage: truncate(state.providerMessage, INVITE_EMAIL_PROVIDER_MESSAGE_MAX),
    updatedAt: state.lastAttemptAtUtc
  };

  await Promise.all([
    upsertGroupMember(nextMember),
    upsertUserGroup(nextUserGroup)
  ]);
};

export async function groupInviteEmail(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  let body: InviteByEmailBody;
  try {
    body = await request.json() as InviteByEmailBody;
  } catch {
    return errorResponse(400, 'bad_json', 'Request body must be valid JSON', randomUUID());
  }

  const traceId = typeof body.traceId === 'string' && body.traceId.trim() ? body.traceId.trim() : randomUUID();
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  if (!groupId) return errorResponse(400, 'invalid_group_id', 'groupId is required', traceId);

  const recipientEmailRaw = typeof body.recipientEmail === 'string' ? body.recipientEmail : '';
  const recipientEmail = normalizeEmail(recipientEmailRaw);
  if (!isPlausibleEmail(recipientEmail)) return errorResponse(400, 'invalid_email', 'recipientEmail is invalid', traceId);

  const messageNormalized = normalizePersonalMessage(body.personalMessage);
  if (!messageNormalized.ok) return errorResponse(400, 'invalid_personal_message', `personalMessage must be ${INVITE_EMAIL_PERSONAL_MESSAGE_MAX} characters or less`, traceId);
  const personalMessage = messageNormalized.message;
  const received = {
    groupId,
    recipientEmail,
    recipientNamePresent: typeof body.recipientName === 'string' && body.recipientName.trim().length > 0,
    personalMessageLen: personalMessage?.length ?? 0
  };

  let session;
  try {
    session = await requireSessionFromRequest(request, traceId, { groupId });
  } catch (error) {
    if (error instanceof HttpError) return error.response;
    throw error;
  }

  await ensureTablesReady();
  const requesterMembership = await requireGroupMembership({ groupId, email: session.email, traceId, allowStatuses: ['active'], endpoint: 'groupInviteEmail' });
  if (!requesterMembership.ok) return requesterMembership.response;

  const group = await getGroupEntity(groupId);
  if (!group || group.isDeleted) return errorResponse(404, 'group_not_found', 'Group not found', traceId);

  const inviterEmail = normalizeEmail(session.email);
  console.log(JSON.stringify({
    event: 'group_invite_email_received',
    traceId,
    groupId,
    inviterEmail,
    recipientEmail
  }));

  const inviterUserKey = userKeyFromEmail(inviterEmail);
  const inviterProfile = await getTableEntity<UserProfileEntity>('UserProfiles', inviterUserKey, 'profile');
  const inviterName = resolveInviterName(inviterProfile, inviterEmail);
  const recipientName = normalizeDisplayName(body.recipientName);

  const recipientUserKey = userKeyFromEmail(recipientEmail);
  const now = new Date().toISOString();
  const existing = await getGroupMemberEntity(groupId, recipientUserKey);
  if (existing?.status === 'active') {
    return {
      status: 200,
      jsonBody: {
        ok: true,
        membershipStatus: 'active',
        emailSent: false,
        inviteEmailStatus: existing.inviteEmailStatus ?? 'not_sent',
        reason: 'already_member',
        traceId,
        received
      }
    };
  }

  const invitedAt = existing?.invitedAt ?? now;
  const nextGroupMember: GroupMembersEntity = {
    ...(existing ?? { partitionKey: groupId, rowKey: recipientUserKey, userKey: recipientUserKey, email: recipientEmail, memberKind: undefined, emailVerified: undefined, lastSeenAtUtc: undefined }),
    partitionKey: groupId,
    rowKey: recipientUserKey,
    userKey: recipientUserKey,
    email: recipientEmail,
    status: 'invited',
    invitedAt,
    joinedAt: undefined,
    removedAt: undefined,
    updatedAt: now,
    inviteEmailStatus: existing?.inviteEmailStatus ?? 'not_sent',
    inviteEmailLastAttemptAtUtc: existing?.inviteEmailLastAttemptAtUtc,
    inviteEmailFailedReason: existing?.inviteEmailFailedReason,
    inviteEmailProviderMessage: existing?.inviteEmailProviderMessage
  };

  const existingUserGroup = await getTableEntity<UserGroupsEntity>('UserGroups', recipientUserKey, groupId);
  const nextUserGroup: UserGroupsEntity = {
    ...(existingUserGroup ?? { partitionKey: recipientUserKey, rowKey: groupId, groupId, memberKind: undefined, emailVerified: undefined, lastSeenAtUtc: undefined }),
    partitionKey: recipientUserKey,
    rowKey: groupId,
    groupId,
    status: 'invited',
    invitedAt,
    joinedAt: undefined,
    removedAt: undefined,
    updatedAt: now,
    inviteEmailStatus: existingUserGroup?.inviteEmailStatus ?? existing?.inviteEmailStatus ?? 'not_sent',
    inviteEmailLastAttemptAtUtc: existingUserGroup?.inviteEmailLastAttemptAtUtc ?? existing?.inviteEmailLastAttemptAtUtc,
    inviteEmailFailedReason: existingUserGroup?.inviteEmailFailedReason ?? existing?.inviteEmailFailedReason,
    inviteEmailProviderMessage: existingUserGroup?.inviteEmailProviderMessage ?? existing?.inviteEmailProviderMessage
  };

  await Promise.all([
    upsertGroupMember(nextGroupMember),
    upsertUserGroup(nextUserGroup)
  ]);

  if (!existing || existing.status === 'removed') {
    await adjustGroupCounters(groupId, { memberCountInvited: 1 });
  }

  await incrementDailyMetric('invitesSent', 1);
  await upsertUserProfile({ userKey: recipientUserKey, email: recipientEmail, updatedAt: now, createdAt: now });

  const tokenEntity = await getOrCreateInviteToken({ groupId, recipientEmail, inviterEmail, now });
  const baseUrl = resolveOrigin(request);
  if (!baseUrl) {
    return errorResponse(500, 'config_missing', 'WEB_BASE_URL could not be resolved', traceId, { missing: ['WEB_BASE_URL'] });
  }
  const inviteUrl = `${baseUrl}/#/join?groupId=${encodeURIComponent(groupId)}&token=${encodeURIComponent(tokenEntity.token)}`;

  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi,';
  const personalHtml = personalMessage
    ? `<p style="margin:0 0 6px"><strong>Message from ${htmlEscape(inviterName)}:</strong></p><blockquote style="margin:0 0 16px;padding:10px 12px;border-left:3px solid #ddd;white-space:pre-wrap">${htmlEscape(personalMessage)}</blockquote>`
    : '';
  const personalText = personalMessage
    ? `\n\nMessage from ${inviterName}:\n${personalMessage}\n`
    : '';

  const subject = `${inviterName} invited you to ${group.groupName}`;
  const plainText = `${greeting}\n\n${inviterName} (${inviterEmail}) invited you to join the group "${group.groupName}" on FamilyScheduler.${personalText}\nJoin with this link:\n${inviteUrl}\n\nIf the link does not open, copy and paste it into your browser.\n\nYou are receiving this email because someone invited this address to a FamilyScheduler group. If this was unexpected, you can ignore it.\n\nNeed help? Contact support: support@familyscheduler.app`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5"><p style="margin:0 0 12px">${htmlEscape(greeting)}</p><p style="margin:0 0 12px"><strong>${htmlEscape(inviterName)}</strong> (${htmlEscape(inviterEmail)}) invited you to join the group <strong>${htmlEscape(group.groupName)}</strong> on FamilyScheduler.</p>${personalHtml}<p style="margin:0 0 16px"><a href="${inviteUrl}" style="display:inline-block;background:#1f6feb;color:#fff;text-decoration:none;padding:10px 14px;border-radius:6px;font-weight:600">Join group</a></p><p style="margin:0 0 8px;font-size:13px;color:#444">If the button does not work, use this link:</p><p style="margin:0 0 14px;word-break:break-all;font-size:13px"><a href="${inviteUrl}">${inviteUrl}</a></p><p style="margin:0 0 8px;font-size:12px;color:#666">You are receiving this email because someone invited this address to a FamilyScheduler group. If this was unexpected, you can ignore this message.</p><p style="margin:0;font-size:12px;color:#666">Need help? support@familyscheduler.app</p></div>`;

  const missingConfig = ['AZURE_COMMUNICATION_CONNECTION_STRING', 'EMAIL_SENDER_ADDRESS'].filter((key) => !process.env[key]?.trim());
  if (missingConfig.length > 0) {
    logConfigMissing('group/invite-email', traceId, missingConfig);
    await applyInviteEmailState(nextGroupMember, nextUserGroup, {
      status: 'failed',
      lastAttemptAtUtc: now,
      failedReason: 'config_missing',
      providerMessage: `missing: ${missingConfig.join(',')}`
    });
    return {
      status: 200,
      jsonBody: {
        ok: true,
        membershipStatus: 'invited',
        emailSent: false,
        inviteEmailStatus: 'failed',
        inviteEmailFailedReason: 'config_missing',
        inviteUrl,
        traceId,
        received
      }
    };
  }

  try {
    const providerResponse = await sendEmail({
      to: recipientEmail,
      replyTo: inviterEmail,
      subject,
      plainText,
      html
    });

    const attemptedAt = new Date().toISOString();
    await applyInviteEmailState(nextGroupMember, nextUserGroup, {
      status: 'sent',
      lastAttemptAtUtc: attemptedAt
    });

    console.log(JSON.stringify({
      event: 'group_invite_email_attempt',
      traceId,
      groupId,
      inviterEmail,
      recipientEmail,
      result: 'sent',
      providerMessageId: providerResponse.id
    }));

    return {
      status: 200,
      jsonBody: {
        ok: true,
        membershipStatus: 'invited',
        emailSent: true,
        inviteEmailStatus: 'sent',
        inviteUrl,
        traceId,
        received
      }
    };
  } catch (error) {
    const attemptedAt = new Date().toISOString();
    const mapped = mapProviderFailureReason(error);
    await applyInviteEmailState(nextGroupMember, nextUserGroup, {
      status: 'failed',
      lastAttemptAtUtc: attemptedAt,
      failedReason: mapped.reason,
      providerMessage: mapped.providerMessage
    });

    console.warn(JSON.stringify({
      event: 'group_invite_email_attempt',
      traceId,
      groupId,
      inviterEmail,
      recipientEmail,
      result: 'failed',
      reason: mapped.reason,
      providerMessage: truncate(mapped.providerMessage, INVITE_EMAIL_PROVIDER_MESSAGE_MAX)
    }));

    return {
      status: 200,
      jsonBody: {
        ok: true,
        membershipStatus: 'invited',
        emailSent: false,
        inviteEmailStatus: 'failed',
        inviteEmailFailedReason: mapped.reason,
        inviteEmailFailedReasonLabel: inviteFailureReasonToLabel[mapped.reason] ?? inviteFailureReasonToLabel.unknown,
        inviteUrl,
        traceId,
        received
      }
    };
  }
}
