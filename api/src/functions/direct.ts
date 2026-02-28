import { randomUUID } from 'node:crypto';
import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { executeActions } from '../lib/actions/executor.js';
import type { Action } from '../lib/actions/schema.js';
import { MissingConfigError } from '../lib/errors/configError.js';
import { type AppState } from '../lib/state.js';
import { getTimeSpec } from '../lib/time/timeSpec.js';
import { resolveTimeSpecWithFallback } from '../lib/time/resolveTimeSpecWithFallback.js';
import { buildTimeChoicesForUnresolvedTimeOnly, isTimeOnlyMissingDateIntent } from '../lib/time/timeChoices.js';
import { errorResponse, logConfigMissing } from '../lib/http/errorResponse.js';
import { ConflictError, GroupNotFoundError } from '../lib/storage/storage.js';
import { createStorageAdapter, describeStorageTarget } from '../lib/storage/storageFactory.js';
import type { StorageAdapter } from '../lib/storage/storage.js';
import { requireSessionEmail } from '../lib/auth/requireSession.js';
import { isPlausibleEmail, normalizeEmail, requireActiveMember } from '../lib/auth/requireMembership.js';
import { ensureTraceId, logAuth } from '../lib/logging/authLogs.js';
import type { ResolvedInterval } from '../../../packages/shared/src/types.js';
import { appendEvent, getRecentEvents, hasLatestChunkIdempotencyKey, type AppointmentEvent, type EventCursor } from '../lib/appointments/appointmentEvents.js';
import {
  activeConstraintsForMember,
  activeSuggestionsByField,
  ensureAppointmentDoc,
  evaluateReconciliation,
  expireSuggestions,
  materialEventTypes,
  newSuggestion,
  removeConstraintForMember,
  upsertConstraintForMember
} from '../lib/appointments/appointmentDomain.js';
import { appointmentJsonBlobPath, getAppointmentJsonWithEtag, putAppointmentJson, putAppointmentJsonWithEtag } from '../lib/tables/appointments.js';
import { rowKeyFromIso, upsertAppointmentIndex } from '../lib/tables/entities.js';
import { buildAppointmentsSnapshot } from '../lib/appointments/buildAppointmentsSnapshot.js';
import { restoreAppointmentById, softDeleteAppointmentById } from '../lib/tables/appointmentSoftDelete.js';
import { userKeyFromEmail } from '../lib/identity/userKey.js';
import { sendEmail } from '../lib/email/acsEmail.js';
import { getUserPrefs } from '../lib/prefs/userPrefs.js';
import { buildAppointmentSnapshot, diffAppointmentSnapshots, type AppointmentDiffItem, type AppointmentSnapshot } from '../lib/appointments/appointmentSnapshot.js';

export type ResponseSnapshot = {
  appointments: Array<{ id: string; code: string; desc: string; schemaVersion?: number; updatedAt?: string; time: ReturnType<typeof getTimeSpec>; date: string; startTime?: string; durationMins?: number; isAllDay: boolean; people: string[]; peopleDisplay: string[]; location: string; locationRaw: string; locationDisplay: string; locationMapQuery: string; locationName: string; locationAddress: string; locationDirections: string; notes: string; scanStatus: 'pending' | 'parsed' | 'failed' | 'deleted' | null; scanImageKey: string | null; scanImageMime: string | null; scanCapturedAt: string | null }>;
  people: Array<{ personId: string; name: string; email: string; cellDisplay: string; cellE164: string; status: 'active' | 'removed'; lastSeen?: string; timezone?: string; notes?: string }>;
  rules: Array<{ code: string; schemaVersion?: number; personId: string; kind: 'available' | 'unavailable'; time: ReturnType<typeof getTimeSpec>; date: string; startTime?: string; durationMins?: number; timezone?: string; desc?: string; promptId?: string; originalPrompt?: string; startUtc?: string; endUtc?: string }>;
  historyCount?: number;
};

type DirectBody = { action?: unknown; groupId?: unknown; email?: unknown; traceId?: unknown };

type DirectAction =
  | { type: 'create_blank_appointment' }
  | { type: 'delete_appointment'; appointmentId: string; code?: string }
  | { type: 'delete_appointment'; code: string; appointmentId?: string }
  | { type: 'restore_appointment'; appointmentId: string }
  | { type: 'set_appointment_date'; code: string; date: string }
  | { type: 'set_appointment_start_time'; code: string; startTime?: string }
  | { type: 'set_appointment_location'; code: string; location?: string; locationRaw?: string }
  | { type: 'set_appointment_notes'; code: string; notes: string }
  | { type: 'set_appointment_desc'; code: string; desc: string }
  | { type: 'set_appointment_duration'; code: string; durationMins?: number }
  | { type: 'reschedule_appointment'; code: string; date: string; startTime?: string; durationMins?: number; timezone?: string; timeResolved?: ResolvedInterval; durationAcceptance?: 'auto' | 'user_confirmed' | 'user_edited' }
  | { type: 'resolve_appointment_time'; appointmentId?: string; whenText: string; timezone?: string }
  | { type: 'create_blank_person' }
  | { type: 'update_person'; personId: string; name?: string; email?: string }
  | { type: 'delete_person'; personId: string }
  | { type: 'reactivate_person'; personId: string }
  | { type: 'get_appointment_detail'; appointmentId: string; limit?: number; cursor?: EventCursor }
  | { type: 'list_appointment_notifications'; appointmentId: string; limit?: number; cursor?: EventCursor }
  | { type: 'append_appointment_message'; appointmentId: string; text: string; clientRequestId: string }
  | { type: 'apply_appointment_proposal'; appointmentId: string; proposalId: string; field: 'title'; value: string; clientRequestId: string }
  | { type: 'pause_appointment_proposal'; appointmentId: string; proposalId: string; clientRequestId: string }
  | { type: 'resume_appointment_proposal'; appointmentId: string; proposalId: string; clientRequestId: string }
  | { type: 'edit_appointment_proposal'; appointmentId: string; proposalId: string; field: 'title'; value: string; clientRequestId: string }
  | { type: 'dismiss_appointment_proposal'; appointmentId: string; proposalId: string; clientRequestId: string }
  | { type: 'add_constraint'; appointmentId: string; memberEmail: string; field: 'title' | 'time' | 'location' | 'general'; operator: 'equals' | 'contains' | 'not_contains' | 'required'; value: string; clientRequestId: string }
  | { type: 'edit_constraint'; appointmentId: string; memberEmail: string; constraintId: string; field: 'title' | 'time' | 'location' | 'general'; operator: 'equals' | 'contains' | 'not_contains' | 'required'; value: string; clientRequestId: string }
  | { type: 'remove_constraint'; appointmentId: string; memberEmail: string; constraintId: string; clientRequestId: string }
  | { type: 'create_suggestion'; appointmentId: string; field: 'title' | 'time' | 'location'; value: string; clientRequestId: string }
  | { type: 'dismiss_suggestion'; appointmentId: string; suggestionId: string; field: 'title' | 'time' | 'location'; clientRequestId: string }
  | { type: 'react_suggestion'; appointmentId: string; suggestionId: string; field: 'title' | 'time' | 'location'; reaction: 'up' | 'down'; clientRequestId: string }
  | { type: 'apply_suggestion'; appointmentId: string; suggestionId: string; field: 'title' | 'time' | 'location'; clientRequestId: string }
  | { type: 'preview_appointment_update_email'; appointmentId: string; recipientPersonIds: string[]; userMessage?: string }
  | { type: 'send_appointment_update_email'; appointmentId: string; recipientPersonIds: string[]; userMessage?: string; clientRequestId: string };

type ResolvedNotificationRecipient = { personId?: string; display?: string; email: string; isSelectable?: boolean; disabledReason?: string };
type ExcludedNotificationRecipient = { personId?: string; email?: string; reason: string };

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^\d{2}:\d{2}$/;
const DIRECT_VERSION = process.env.DIRECT_VERSION ?? process.env.VITE_BUILD_SHA ?? process.env.BUILD_SHA ?? 'unknown';
const TIME_RESOLVE_LOG_ENABLED = process.env.TIME_RESOLVE_LOG_ENABLED === '1';
const TITLE_MAX_LENGTH = 160;
const CONSTRAINT_FIELDS = ['title', 'time', 'location', 'general'] as const;
const CONSTRAINT_OPERATORS = ['equals', 'contains', 'not_contains', 'required'] as const;
const SUGGESTION_FIELDS = ['title', 'time', 'location'] as const;

const isConstraintField = (value: string): value is typeof CONSTRAINT_FIELDS[number] => CONSTRAINT_FIELDS.includes(value as typeof CONSTRAINT_FIELDS[number]);
const isConstraintOperator = (value: string): value is typeof CONSTRAINT_OPERATORS[number] => CONSTRAINT_OPERATORS.includes(value as typeof CONSTRAINT_OPERATORS[number]);
const isSuggestionField = (value: string): value is typeof SUGGESTION_FIELDS[number] => SUGGESTION_FIELDS.includes(value as typeof SUGGESTION_FIELDS[number]);

const localDateFromResolvedStart = (startUtc: string, timezone: string): string => new Intl.DateTimeFormat('en-CA', {
  timeZone: timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date(startUtc));

const normalizeRecipientPersonIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);
};

const formatNotificationActor = (member: { name?: string; email?: string } | null, fallbackEmail: string): string => {
  const display = member?.name?.trim();
  return display ? `${display} <${fallbackEmail}>` : fallbackEmail;
};

const resolveWebBaseUrl = (): string => {
  const base = process.env.WEB_BASE_URL?.trim() ?? '';
  return base.replace(/\/$/, '');
};

const buildAppointmentLink = (groupId: string, appointmentId: string): string => {
  const base = resolveWebBaseUrl();
  if (!base) return `/#/g/${encodeURIComponent(groupId)}?appointmentId=${encodeURIComponent(appointmentId)}`;
  return `${base}/#/g/${encodeURIComponent(groupId)}?appointmentId=${encodeURIComponent(appointmentId)}`;
};

const buildAppointmentEmailContent = (
  appointment: ResponseSnapshot['appointments'][number],
  actorLabel: string,
  actorEmail: string,
  userMessage: string,
  appLink: string,
  diffSummary?: { prevSentAt?: string; hadPrevious: boolean; items: AppointmentDiffItem[] }
): { subject: string; plainText: string; html: string } => {
  const title = (appointment.desc || 'Appointment').trim();
  const localDate = appointment.date || 'Date TBD';
  const time = appointment.startTime ? `${appointment.startTime}${appointment.durationMins ? ` · ${appointment.durationMins} min` : ''}` : (appointment.isAllDay ? 'All day' : 'Time TBD');
  const location = appointment.locationDisplay || appointment.location || 'No location provided';
  const senderLabel = actorLabel || actorEmail;
  const messageBlock = userMessage.trim();
  const escHtml = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const formatDiffValue = (value?: string): string => value || '—';
  const formatPrevSentAt = (iso?: string): string | null => {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
  };
  const formatTimeSnapshot = (time?: { startIso?: string; endIso?: string; tz?: string }): string => {
    const start = formatDiffValue(time?.startIso);
    const end = formatDiffValue(time?.endIso);
    const tz = time?.tz ? ` (${time.tz})` : '';
    return `${start} → ${end}${tz}`;
  };
  const diffHeaderLabel = diffSummary?.prevSentAt ? `Changes since last update (${formatPrevSentAt(diffSummary.prevSentAt) ?? diffSummary.prevSentAt}):` : 'Changes since last update:';
  const diffPlainLines = (() => {
    if (!diffSummary) return [];
    if (!diffSummary.hadPrevious) return [diffHeaderLabel, '- (first update)', ''];
    if (diffSummary.items.length === 0) return [diffHeaderLabel, '- No appointment changes since last update.', ''];
    const lines = diffSummary.items.map((item) => {
      if (item.field === 'status') return `- Status: ${formatDiffValue(item.from)} → ${formatDiffValue(item.to)}`;
      if (item.field === 'time') return `- Time: ${formatTimeSnapshot(item.from)} => ${formatTimeSnapshot(item.to)}`;
      if (item.field === 'location') return `- Location: ${formatDiffValue(item.from)} → ${formatDiffValue(item.to)}`;
      if (item.field === 'title') return `- Title: ${formatDiffValue(item.from)} → ${formatDiffValue(item.to)}`;
      return '- Notes updated';
    });
    return [diffHeaderLabel, ...lines, ''];
  })();
  const diffHtmlBlock = (() => {
    if (!diffSummary) return '';
    if (!diffSummary.hadPrevious) return `<p style="margin:0 0 8px"><strong>${escHtml(diffHeaderLabel)}</strong></p><ul style="margin:0 0 16px 18px;padding:0"><li>(first update)</li></ul>`;
    if (diffSummary.items.length === 0) return `<p style="margin:0 0 8px"><strong>${escHtml(diffHeaderLabel)}</strong></p><ul style="margin:0 0 16px 18px;padding:0"><li>No appointment changes since last update.</li></ul>`;
    const items = diffSummary.items.map((item) => {
      if (item.field === 'status') return `<li>Status: ${escHtml(formatDiffValue(item.from))} → ${escHtml(formatDiffValue(item.to))}</li>`;
      if (item.field === 'time') return `<li>Time: ${escHtml(formatTimeSnapshot(item.from))} => ${escHtml(formatTimeSnapshot(item.to))}</li>`;
      if (item.field === 'location') return `<li>Location: ${escHtml(formatDiffValue(item.from))} → ${escHtml(formatDiffValue(item.to))}</li>`;
      if (item.field === 'title') return `<li>Title: ${escHtml(formatDiffValue(item.from))} → ${escHtml(formatDiffValue(item.to))}</li>`;
      return '<li>Notes updated</li>';
    }).join('');
    return `<p style="margin:0 0 8px"><strong>${escHtml(diffHeaderLabel)}</strong></p><ul style="margin:0 0 16px 18px;padding:0">${items}</ul>`;
  })();
  const subject = `[Yapper] Update: ${title} (${localDate})`;
  const plainText = [
    `Yapper appointment update`,
    '',
    `Title: ${title}`,
    `Sent by: ${senderLabel}`,
    `Time: ${localDate} ${time}`,
    `Location: ${location}`,
    '',
    ...diffPlainLines,
    ...(messageBlock ? [`Message from sender:`, messageBlock, ''] : []),
    'Do not reply to this email.',
    `Open in Yapper: ${appLink}`
  ].join('\n');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5"><h2 style="margin:0 0 12px">Yapper appointment update</h2><p style="margin:0 0 8px"><strong>Title:</strong> ${escHtml(title)}</p><p style="margin:0 0 8px"><strong>Sent by:</strong> ${escHtml(senderLabel)}</p><p style="margin:0 0 8px"><strong>Time:</strong> ${escHtml(localDate)} ${escHtml(time)}</p><p style="margin:0 0 16px"><strong>Location:</strong> ${escHtml(location)}</p>${diffHtmlBlock}${messageBlock ? `<p style="margin:0 0 8px"><strong>Message from sender:</strong></p><blockquote style="margin:0 0 16px;padding:8px 12px;border-left:3px solid #ddd;color:#333">${escHtml(messageBlock)}</blockquote>` : ''}<p style="margin:0 0 16px"><a href="${appLink}" style="display:inline-block;background:#1f6feb;color:#fff;text-decoration:none;padding:10px 14px;border-radius:6px;font-weight:600">Open in Yapper</a></p><p style="margin:0;font-size:12px;color:#666">Do not reply to this email. Use the link above to respond in Yapper.</p></div>`;
  return { subject, plainText, html };
};

const latestNotificationSnapshot = (events: AppointmentEvent[]): { snapshot?: AppointmentSnapshot; sentAt?: string } => {
  const latest = events.find((event) => event.type === 'NOTIFICATION_SENT');
  if (!latest) return {};
  const payload = (latest.payload && typeof latest.payload === 'object') ? latest.payload as Record<string, unknown> : {};
  const snapshot = (payload.appointmentSnapshot && typeof payload.appointmentSnapshot === 'object') ? payload.appointmentSnapshot as AppointmentSnapshot : undefined;
  const sentAt = typeof payload.sentAt === 'string' ? payload.sentAt : latest.tsUtc;
  return { snapshot, sentAt };
};

const resolveNotificationRecipients = (
  state: AppState,
  senderEmail: string,
  recipientPersonIds: string[]
): { resolvedRecipients: ResolvedNotificationRecipient[]; excludedRecipients: ExcludedNotificationRecipient[]; excludedSelf: boolean } => {
  const excludedRecipients: ExcludedNotificationRecipient[] = [];
  const resolvedRecipients: ResolvedNotificationRecipient[] = [];
  const dedupe = new Set<string>();
  let excludedSelf = false;

  const pushResolved = (recipient: ResolvedNotificationRecipient) => {
    const normalized = normalizeEmail(recipient.email);
    if (!normalized || !isPlausibleEmail(normalized)) {
      excludedRecipients.push({ personId: recipient.personId, email: recipient.email, reason: 'invalid_email' });
      return;
    }
    if (normalized === senderEmail) {
      excludedSelf = true;
      excludedRecipients.push({ personId: recipient.personId, email: normalized, reason: 'self_excluded' });
      return;
    }
    if (dedupe.has(normalized)) return;
    dedupe.add(normalized);
    resolvedRecipients.push({ ...recipient, email: normalized });
  };

  for (const personId of recipientPersonIds) {
    const person = state.people.find((entry) => entry.personId === personId);
    if (!person) {
      excludedRecipients.push({ personId, reason: 'person_not_found' });
      continue;
    }
    if (person.status !== 'active') {
      excludedRecipients.push({ personId, email: person.email ?? undefined, reason: 'person_inactive' });
      continue;
    }
    if (!person.email) {
      excludedRecipients.push({ personId, reason: 'no_email' });
      continue;
    }
    pushResolved({ personId, display: person.name?.trim() || undefined, email: person.email });
  }

  return { resolvedRecipients, excludedRecipients, excludedSelf };
};



const excludeOptedOutRecipients = async (
  storage: StorageAdapter,
  recipients: { resolvedRecipients: ResolvedNotificationRecipient[]; excludedRecipients: ExcludedNotificationRecipient[]; excludedSelf: boolean },
  traceId: string
): Promise<{ resolvedRecipients: ResolvedNotificationRecipient[]; excludedRecipients: ExcludedNotificationRecipient[]; excludedSelf: boolean }> => {
  const eligible: ResolvedNotificationRecipient[] = [];
  const excluded = [...recipients.excludedRecipients];

  for (const recipient of recipients.resolvedRecipients) {
    const prefs = await getUserPrefs(storage, recipient.email, traceId);
    if (prefs.emailUpdatesEnabled === false) {
      excluded.push({ personId: recipient.personId, email: recipient.email, reason: 'opted_out' });
      continue;
    }
    eligible.push(recipient);
  }

  return {
    resolvedRecipients: eligible,
    excludedRecipients: excluded,
    excludedSelf: recipients.excludedSelf
  };
};

const mapLastNotification = (events: AppointmentEvent[]): Record<string, unknown> | null => {
  const latest = events.find((event) => event.type === 'NOTIFICATION_SENT');
  if (!latest) return null;
  const payload = latest.payload ?? {};
  const sentBy = (payload.sentBy && typeof payload.sentBy === 'object') ? payload.sentBy as Record<string, unknown> : {};
  const failed = Array.isArray(payload.failedRecipients) ? payload.failedRecipients : [];
  return {
    sentAt: typeof payload.sentAt === 'string' ? payload.sentAt : latest.tsUtc,
    sentBy: {
      email: typeof sentBy.email === 'string' ? sentBy.email : '',
      ...(typeof sentBy.display === 'string' && sentBy.display ? { display: sentBy.display } : {})
    },
    deliveryStatus: payload.deliveryStatus === 'partial' ? 'partial' : 'sent',
    recipientCountSent: typeof payload.recipientCountSent === 'number' ? payload.recipientCountSent : 0,
    recipientCountSelected: typeof payload.recipientCountSelected === 'number' ? payload.recipientCountSelected : 0,
    failedRecipients: failed
      .filter((entry) => entry && typeof entry === 'object')
      .map((entry) => {
        const record = entry as Record<string, unknown>;
        return {
          email: typeof record.email === 'string' ? record.email : '',
          ...(typeof record.display === 'string' && record.display ? { display: record.display } : {})
        };
      })
      .filter((entry) => entry.email),
    subject: typeof payload.subject === 'string' ? payload.subject : '[Yapper] Update'
  };
};

const mapNotificationHistoryItem = (event: AppointmentEvent): Record<string, unknown> | null => {
  if (event.type !== 'NOTIFICATION_SENT') return null;
  const payload = event.payload ?? {};
  const sentBy = (payload.sentBy && typeof payload.sentBy === 'object') ? payload.sentBy as Record<string, unknown> : {};
  const failed = Array.isArray(payload.failedRecipients) ? payload.failedRecipients : [];
  const excluded = Array.isArray(payload.excludedRecipients) ? payload.excludedRecipients : [];

  const failedRecipients = failed
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => {
      const record = entry as Record<string, unknown>;
      return {
        email: typeof record.email === 'string' ? record.email : '',
        ...(typeof record.display === 'string' && record.display ? { display: record.display } : {}),
        ...(typeof record.errorMessage === 'string' && record.errorMessage ? { errorMessage: record.errorMessage } : {})
      };
    })
    .filter((entry) => entry.email);

  const excludedRecipients = excluded
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => {
      const record = entry as Record<string, unknown>;
      const reason = record.reason === 'opted_out'
        ? 'opted_out'
        : record.reason === 'no_email'
          ? 'no_email'
          : record.reason === 'self_excluded'
            ? 'self'
            : null;
      if (!reason) return null;
      return {
        ...(typeof record.email === 'string' && record.email ? { email: record.email } : {}),
        ...(typeof record.display === 'string' && record.display ? { display: record.display } : {}),
        reason
      };
    })
    .filter((entry): entry is { email?: string; display?: string; reason: 'opted_out' | 'no_email' | 'self' } => Boolean(entry));

  return {
    ...(typeof payload.notificationId === 'string' && payload.notificationId ? { notificationId: payload.notificationId } : {}),
    sentAt: typeof payload.sentAt === 'string' ? payload.sentAt : event.tsUtc,
    sentBy: {
      email: typeof sentBy.email === 'string' ? sentBy.email : '',
      ...(typeof sentBy.display === 'string' && sentBy.display ? { display: sentBy.display } : {})
    },
    ...(typeof payload.subject === 'string' ? { subject: payload.subject } : {}),
    deliveryStatus: payload.deliveryStatus === 'partial' ? 'partial' : 'sent',
    ...(typeof payload.recipientCountSelected === 'number' ? { recipientCountSelected: payload.recipientCountSelected } : {}),
    ...(typeof payload.recipientCountSent === 'number' ? { recipientCountSent: payload.recipientCountSent } : {}),
    ...(typeof payload.excludedCount === 'number' ? { excludedCount: payload.excludedCount } : {}),
    ...(failedRecipients.length ? { failedRecipients } : {}),
    ...(excludedRecipients.length ? { excludedRecipients } : {}),
    ...(typeof payload.userMessage === 'string' && payload.userMessage.trim() ? { userMessage: payload.userMessage } : {}),
    ...(payload.diffSummary !== undefined ? { diffSummary: payload.diffSummary } : {})
  };
};


const appointmentDocStore = {
  getWithEtag: getAppointmentJsonWithEtag,
  put: putAppointmentJson,
  putWithEtag: putAppointmentJsonWithEtag
};

export const setAppointmentDocStoreForTests = (overrides: Partial<typeof appointmentDocStore> | null): void => {
  if (!overrides) {
    appointmentDocStore.getWithEtag = getAppointmentJsonWithEtag;
    appointmentDocStore.put = putAppointmentJson;
    appointmentDocStore.putWithEtag = putAppointmentJsonWithEtag;
    return;
  }
  appointmentDocStore.getWithEtag = overrides.getWithEtag ?? appointmentDocStore.getWithEtag;
  appointmentDocStore.put = overrides.put ?? appointmentDocStore.put;
  appointmentDocStore.putWithEtag = overrides.putWithEtag ?? appointmentDocStore.putWithEtag;
};

const appointmentEventStore = {
  append: appendEvent,
  recent: getRecentEvents,
  hasLatestIdempotencyKey: hasLatestChunkIdempotencyKey
};

export const setAppointmentEventStoreForTests = (overrides: Partial<typeof appointmentEventStore> | null): void => {
  if (!overrides) {
    appointmentEventStore.append = appendEvent;
    appointmentEventStore.recent = getRecentEvents;
    appointmentEventStore.hasLatestIdempotencyKey = hasLatestChunkIdempotencyKey;
    return;
  }
  appointmentEventStore.append = overrides.append ?? appointmentEventStore.append;
  appointmentEventStore.recent = overrides.recent ?? appointmentEventStore.recent;
  appointmentEventStore.hasLatestIdempotencyKey = overrides.hasLatestIdempotencyKey ?? appointmentEventStore.hasLatestIdempotencyKey;
};

const detectTitleProposal = (textRaw: string): string | null => {
  const text = textRaw.trim();
  const match = text.match(/^update title to (.+)$/i)
    || text.match(/^change title to (.+)$/i)
    || text.match(/^rename to (.+)$/i);
  if (!match?.[1]) return null;
  const proposalTitle = match[1].trim();
  if (!proposalTitle) return null;
  if (proposalTitle.length > TITLE_MAX_LENGTH) throw new Error(`title must be at most ${TITLE_MAX_LENGTH} characters`);
  return proposalTitle;
};

const latestActiveTitleProposal = (events: AppointmentEvent[]): AppointmentEvent | null => {
  const latestProposal = events.find((event) => event.type === 'PROPOSAL_CREATED' && event.payload.field === 'title');
  if (!latestProposal?.proposalId) return null;
  const closed = events.some((event) => event.proposalId === latestProposal.proposalId && (event.type === 'FIELD_CHANGED' || event.type === 'PROPOSAL_CANCELED' || event.type === 'PROPOSAL_APPLIED'));
  return closed ? null : latestProposal;
};

export type PendingProposalResponse = {
  id: string;
  field: 'title';
  fromValue: string | null;
  toValue: string;
  status: 'pending' | 'paused';
  createdTsUtc: string;
  countdownEndsTsUtc: string | null;
  actor: AppointmentEvent['actor'];
};

export const derivePendingProposal = (events: AppointmentEvent[]): PendingProposalResponse | null => {
  const created = events.find((event) => event.type === 'PROPOSAL_CREATED' && event.payload.field === 'title' && !!event.proposalId);
  if (!created?.proposalId) return null;
  const proposalId = created.proposalId;
  const lifecycle = events.filter((event) => event.proposalId === proposalId);
  const isClosed = lifecycle.some((event) => event.type === 'PROPOSAL_CANCELED' || event.type === 'PROPOSAL_APPLIED' || event.type === 'FIELD_CHANGED');
  if (isClosed) return null;

  const edited = lifecycle.find((event) => event.type === 'PROPOSAL_EDITED');
  const paused = lifecycle.find((event) => event.type === 'PROPOSAL_PAUSED');
  const resumed = lifecycle.find((event) => event.type === 'PROPOSAL_RESUMED');
  const pausedAfterResume = paused && (!resumed || Date.parse(paused.tsUtc) > Date.parse(resumed.tsUtc));

  return {
    id: proposalId,
    field: 'title',
    fromValue: typeof created.payload.from === 'string' ? created.payload.from : null,
    toValue: typeof edited?.payload.afterText === 'string' ? edited.payload.afterText : String(created.payload.to ?? ''),
    status: pausedAfterResume ? 'paused' : 'pending',
    createdTsUtc: created.tsUtc,
    countdownEndsTsUtc: null,
    actor: created.actor
  };
};

const logAppointmentAction = (context: InvocationContext, traceId: string, groupId: string, action: DirectAction): void => {
  if (!('appointmentId' in action)) return;
  const clientRequestId = 'clientRequestId' in action && typeof action.clientRequestId === 'string' ? action.clientRequestId : null;
  context.log(JSON.stringify({ event: 'appointment_action', traceId, groupId, appointmentId: action.appointmentId, actionType: action.type, clientRequestId }));
};

const deriveDateTimeParts = (start?: string, end?: string): { date: string; startTime?: string; durationMins?: number; isAllDay: boolean } => {
  if (!start || !end) return { date: start?.slice(0, 10) ?? '', isAllDay: true };
  const startDate = new Date(start); const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return { date: start.slice(0, 10), isAllDay: true };
  const durationMins = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
  return { date: start.slice(0, 10), startTime: start.match(/T(\d{2}:\d{2})/)?.[1], durationMins, isAllDay: false };
};

export const toResponseSnapshot = (state: AppState): ResponseSnapshot => ({
  appointments: state.appointments.filter((appointment) => appointment.isDeleted !== true).map((appointment) => {
    const derived = deriveDateTimeParts(appointment.start, appointment.end);
    return {
      id: appointment.id,
      code: appointment.code,
      schemaVersion: appointment.schemaVersion,
      updatedAt: appointment.updatedAt,
      time: getTimeSpec(appointment, appointment.timezone ?? process.env.TZ ?? 'America/Los_Angeles'),
      desc: appointment.title,
      date: appointment.date ?? derived.date,
      startTime: appointment.startTime ?? derived.startTime,
      durationMins: appointment.durationMins ?? derived.durationMins,
      isAllDay: appointment.isAllDay ?? derived.isAllDay,
      people: appointment.people ?? [],
      peopleDisplay: (appointment.people ?? []).map((personId) => state.people.find((person) => person.personId === personId)?.name ?? personId),
      location: appointment.locationDisplay ?? appointment.location ?? '',
      locationRaw: appointment.locationRaw ?? '',
      locationDisplay: appointment.locationDisplay ?? appointment.location ?? '',
      locationMapQuery: appointment.locationMapQuery ?? appointment.locationAddress ?? appointment.locationDisplay ?? appointment.location ?? '',
      locationName: appointment.locationName ?? '',
      locationAddress: appointment.locationAddress ?? '',
      locationDirections: appointment.locationDirections ?? '',
      notes: appointment.notes ?? '',
      scanStatus: appointment.scanStatus ?? null,
      scanImageKey: appointment.scanImageKey ?? null,
      scanImageMime: appointment.scanImageMime ?? null,
      scanCapturedAt: appointment.scanCapturedAt ?? null
    };
  }),
  people: state.people.map((person) => ({ personId: person.personId, name: person.name, email: person.email ?? '', cellDisplay: person.cellDisplay ?? person.cellE164 ?? '', cellE164: person.cellE164 ?? '', status: person.status === 'active' ? 'active' : 'removed', lastSeen: person.lastSeen ?? person.createdAt, timezone: person.timezone, notes: person.notes ?? '' })),
  rules: state.rules.map((rule) => ({ code: rule.code, schemaVersion: rule.schemaVersion, personId: rule.personId, kind: rule.kind, time: getTimeSpec(rule, rule.timezone ?? process.env.TZ ?? 'America/Los_Angeles'), date: rule.date, startTime: rule.startTime, durationMins: rule.durationMins, timezone: rule.timezone, desc: rule.desc, promptId: rule.promptId, originalPrompt: rule.originalPrompt, startUtc: rule.startUtc, endUtc: rule.endUtc })),
  historyCount: Array.isArray(state.history) ? state.history.length : undefined
});

const badRequest = (message: string, traceId: string): HttpResponseInit => ({ status: 400, jsonBody: { ok: false, message, traceId } });
const withDirectVersion = (response: HttpResponseInit): HttpResponseInit => {
  const jsonBody = response.jsonBody;
  if (!jsonBody || typeof jsonBody !== 'object' || Array.isArray(jsonBody)) return response;
  return { ...response, jsonBody: { ...(jsonBody as Record<string, unknown>), directVersion: DIRECT_VERSION } };
};
const withDirectHeaders = (response: HttpResponseInit, traceId: string, context: InvocationContext): HttpResponseInit => {
  const baseHeaders = response.headers ?? {};
  const headers = new Headers(baseHeaders as HeadersInit);
  const existingExpose = headers.get('access-control-expose-headers');
  const exposeSet = new Set((existingExpose ?? '').split(',').map((item) => item.trim()).filter(Boolean));
  exposeSet.add('x-trace-id');
  exposeSet.add('x-invocation-id');
  exposeSet.add('x-traceparent');

  headers.set('x-trace-id', traceId);
  headers.set('x-invocation-id', context.invocationId);
  headers.set('cache-control', 'no-store');
  headers.set('access-control-expose-headers', Array.from(exposeSet).join(','));
  const traceparent = (context.traceContext as { traceParent?: string } | undefined)?.traceParent;
  if (traceparent) headers.set('x-traceparent', traceparent);

  return { ...response, headers: Object.fromEntries(headers.entries()) };
};
const withDirectMeta = (response: HttpResponseInit, traceId: string, context: InvocationContext, opId: string | null = null, groupId?: string): HttpResponseInit => {
  const withVersion = withDirectVersion(response);
  const jsonBody = withVersion.jsonBody;
  const debugEnabled = process.env.DEBUG_STORAGE_TARGET === '1' && !!groupId;
  const withInvocation = (!jsonBody || typeof jsonBody !== 'object' || Array.isArray(jsonBody))
    ? withVersion
    : {
        ...withVersion,
        jsonBody: {
          ...(jsonBody as Record<string, unknown>),
          ...(debugEnabled ? (() => {
            const storageTarget = describeStorageTarget();
            return {
              debug: {
                storageTarget: {
                  storageMode: storageTarget.storageMode,
                  accountUrl: storageTarget.accountUrl,
                  containerName: storageTarget.containerName,
                  stateBlobPrefix: storageTarget.stateBlobPrefix,
                  blobNameForGroup: storageTarget.blobNameForGroup(groupId as string)
                }
              }
            };
          })() : {}),
          invocationId: context.invocationId,
          opId
        }
      };
  return withDirectHeaders(withInvocation, traceId, context);
};
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const asString = (value: unknown): string | null => typeof value === 'string' ? value.trim() : null;


const loadOrEnsureAppointment = async (
  groupId: string,
  appointmentId: string,
  actorEmail: string
): Promise<{ doc: Record<string, unknown>; etag: string | null; existed: boolean; blobPath: string }> => {
  const blobPath = appointmentJsonBlobPath(groupId, appointmentId);
  const current = await appointmentDocStore.getWithEtag(groupId, appointmentId);
  if (current.doc) {
    return { doc: ensureAppointmentDoc(current.doc, actorEmail), etag: current.etag, existed: true, blobPath };
  }

  const now = new Date().toISOString();
  await appointmentDocStore.put(groupId, appointmentId, ensureAppointmentDoc({ id: appointmentId, createdAt: now, updatedAt: now, title: '' }, actorEmail));
  const created = await appointmentDocStore.getWithEtag(groupId, appointmentId);
  return {
    doc: ensureAppointmentDoc(created.doc ?? { id: appointmentId, createdAt: now, updatedAt: now, title: '' }, actorEmail),
    etag: created.etag,
    existed: false,
    blobPath
  };
};

const nextPersonId = (state: AppState): string => `P-${state.people.reduce((max, person) => {
  const match = person.personId.match(/^P-(\d+)$/i);
  return match ? Math.max(max, Number(match[1])) : max;
}, 0) + 1}`;

const buildDirectSnapshot = async (groupId: string, state: AppState, traceId: string): Promise<ResponseSnapshot> => {
  const appointments = await buildAppointmentsSnapshot(groupId, process.env.TZ ?? 'America/Los_Angeles', state.people, traceId);
  return { ...toResponseSnapshot(state), appointments };
};


const resolveDeleteAppointmentId = (state: AppState, action: Extract<DirectAction, { type: 'delete_appointment' }>): { appointmentId: string } | { error: string } => {
  if (action.appointmentId) return { appointmentId: action.appointmentId };
  const code = action.code?.trim();
  if (!code) return { error: 'appointmentId or code is required' };
  const matches = state.appointments.filter((appointment) => (appointment.code ?? '').trim().toLowerCase() === code.toLowerCase());
  if (matches.length === 0) return { error: `Not found: ${code}` };
  if (matches.length > 1) return { error: `Ambiguous code: ${code}` };
  return { appointmentId: matches[0].id };
};

const persistCreatedAppointmentDocAndIndex = async (groupId: string, beforeState: AppState, writtenState: AppState, actorEmail: string): Promise<void> => {
  const beforeIds = new Set(beforeState.appointments.map((appointment) => appointment.id));
  const created = writtenState.appointments.find((appointment) => !beforeIds.has(appointment.id));
  if (!created?.id) return;

  await appointmentDocStore.put(groupId, created.id, ensureAppointmentDoc(created as unknown as Record<string, unknown>, actorEmail));

  const indexIso = (() => {
    if (created.start) return created.start;
    const date = typeof created.date === 'string' ? created.date : '';
    const startTime = typeof created.startTime === 'string' ? created.startTime : '';
    if (date && startTime) return `${date}T${startTime}:00.000Z`;
    if (date) return `${date}T00:00:00.000Z`;
    return created.updatedAt ?? new Date().toISOString();
  })();
  const now = new Date().toISOString();
  await upsertAppointmentIndex({
    partitionKey: groupId,
    rowKey: rowKeyFromIso(indexIso, created.id),
    appointmentId: created.id,
    startTime: created.start,
    status: 'active',
    hasScan: Boolean(created.scanImageKey),
    scanCapturedAt: created.scanCapturedAt ?? undefined,
    createdAt: created.updatedAt ?? now,
    updatedAt: created.updatedAt ?? now,
    isDeleted: false
  });
};

const parseDirectAction = (value: unknown): DirectAction => {
  if (!isRecord(value)) throw new Error('action must be an object');
  const type = asString(value.type);
  if (!type) throw new Error('action.type is required');

  if (type === 'create_blank_appointment') return { type };
  if (type === 'delete_appointment') {
    const appointmentId = asString(value.appointmentId);
    const code = asString(value.code);
    if (appointmentId) return { type, appointmentId, ...(code ? { code } : {}) };
    if (code) return { type, code };
    throw new Error('appointmentId or code is required');
  }
  if (type === 'restore_appointment') {
    const appointmentId = asString(value.appointmentId);
    if (!appointmentId) throw new Error('appointmentId is required');
    return { type, appointmentId };
  }
  if (type === 'set_appointment_date') {
    const code = asString(value.code);
    const date = asString(value.date);
    if (!code || !date) throw new Error('code and date are required');
    if (!datePattern.test(date)) throw new Error('date must be YYYY-MM-DD');
    return { type, code, date };
  }
  if (type === 'set_appointment_start_time') {
    const code = asString(value.code);
    if (!code) throw new Error('code is required');
    const startTimeRaw = value.startTime;
    const startTime = typeof startTimeRaw === 'string' ? startTimeRaw.trim() : undefined;
    if (startTime !== undefined && startTime !== '' && !timePattern.test(startTime)) throw new Error('startTime must be HH:MM');
    return { type, code, startTime: startTime || undefined };
  }
  if (type === 'set_appointment_location') {
    const code = asString(value.code);
    if (!code) throw new Error('code is required');
    return { type, code, locationRaw: typeof value.locationRaw === 'string' ? value.locationRaw : (typeof value.location === 'string' ? value.location : ''), location: typeof value.location === 'string' ? value.location : undefined };
  }
  if (type === 'set_appointment_notes') {
    const code = asString(value.code);
    if (!code) throw new Error('code is required');
    return { type, code, notes: typeof value.notes === 'string' ? value.notes : '' };
  }
  if (type === 'set_appointment_desc') {
    const code = asString(value.code);
    if (!code) throw new Error('code is required');
    return { type, code, desc: typeof value.desc === 'string' ? value.desc : '' };
  }
  if (type === 'set_appointment_duration') {
    const code = asString(value.code);
    if (!code) throw new Error('code is required');
    if (value.durationMins === undefined || value.durationMins === null || value.durationMins === '') return { type, code, durationMins: undefined };
    if (typeof value.durationMins !== 'number' || !Number.isInteger(value.durationMins) || value.durationMins < 1 || value.durationMins > 24 * 60) throw new Error('durationMins must be an integer between 1 and 1440');
    return { type, code, durationMins: value.durationMins };
  }

  if (type === 'reschedule_appointment') {
    const code = asString(value.code);
    const date = asString(value.date);
    if (!code || !date) throw new Error('code and date are required');
    if (!datePattern.test(date)) throw new Error('date must be YYYY-MM-DD');
    const startTime = typeof value.startTime === 'string' ? value.startTime.trim() : undefined;
    if (startTime !== undefined && startTime !== '' && !timePattern.test(startTime)) throw new Error('startTime must be HH:MM');
    if (value.durationMins !== undefined && value.durationMins !== null && value.durationMins !== '' && (typeof value.durationMins !== 'number' || !Number.isInteger(value.durationMins) || value.durationMins < 1 || value.durationMins > 24 * 60)) throw new Error('durationMins must be an integer between 1 and 1440');
    const timezone = typeof value.timezone === 'string' ? value.timezone.trim() : undefined;
    const durationAcceptance = typeof value.durationAcceptance === 'string' && ['auto', 'user_confirmed', 'user_edited'].includes(value.durationAcceptance) ? value.durationAcceptance as ('auto' | 'user_confirmed' | 'user_edited') : undefined;
    const rawResolved = (value.timeResolved && typeof value.timeResolved === 'object') ? value.timeResolved as Record<string, unknown> : null;
    const durationSource: ResolvedInterval['durationSource'] | undefined = rawResolved?.durationSource === 'explicit' || rawResolved?.durationSource === 'suggested'
      ? rawResolved.durationSource as ResolvedInterval['durationSource']
      : undefined;
    const timeResolved = rawResolved && typeof rawResolved.startUtc === 'string' && typeof rawResolved.endUtc === 'string' && typeof rawResolved.timezone === 'string' && durationSource
      ? {
          startUtc: rawResolved.startUtc,
          endUtc: rawResolved.endUtc,
          timezone: rawResolved.timezone,
          durationSource,
          durationConfidence: typeof rawResolved.durationConfidence === 'number' ? rawResolved.durationConfidence : undefined,
          durationReason: typeof rawResolved.durationReason === 'string' ? rawResolved.durationReason : undefined,
          durationAcceptance: (typeof rawResolved.durationAcceptance === 'string' && ['auto', 'user_confirmed', 'user_edited'].includes(rawResolved.durationAcceptance)) ? rawResolved.durationAcceptance as ('auto' | 'user_confirmed' | 'user_edited') : durationAcceptance,
          inferenceVersion: typeof rawResolved.inferenceVersion === 'string' ? rawResolved.inferenceVersion : undefined
        }
      : undefined;
    return { type, code, date, startTime: startTime || undefined, durationMins: typeof value.durationMins === 'number' ? value.durationMins : undefined, timezone: timezone || undefined, timeResolved, durationAcceptance };
  }
  if (type === 'resolve_appointment_time') {
    const appointmentId = asString(value.appointmentId) || undefined;
    const whenText = asString(value.whenText);
    if (!whenText) throw new Error('whenText is required');
    const timezone = asString(value.timezone) || undefined;
    return { type, appointmentId, whenText, timezone };
  }
  if (type === 'create_blank_person') return { type };
  if (type === 'update_person') {
    const personId = asString(value.personId);
    if (!personId) throw new Error('personId is required');
    const name = typeof value.name === 'string' ? value.name : undefined;
    const email = typeof value.email === 'string' ? value.email : undefined;
    return { type, personId, name, email };
  }
  if (type === 'delete_person' || type === 'reactivate_person') {
    const personId = asString(value.personId);
    if (!personId) throw new Error('personId is required');
    return { type, personId };
  }
  if (type === 'get_appointment_detail') {
    const appointmentId = asString(value.appointmentId);
    if (!appointmentId) throw new Error('appointmentId is required');
    const limitRaw = value.limit;
    const limit = typeof limitRaw === 'number' && Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : undefined;
    const rawCursor = isRecord(value.cursor) ? value.cursor : null;
    const cursor = rawCursor && typeof rawCursor.chunkId === 'number' && typeof rawCursor.index === 'number'
      ? { chunkId: rawCursor.chunkId, index: rawCursor.index }
      : undefined;
    return { type, appointmentId, limit, cursor };
  }
  if (type === 'list_appointment_notifications') {
    const appointmentId = asString(value.appointmentId);
    if (!appointmentId) throw new Error('appointmentId is required');
    const rawLimit = typeof value.limit === 'number' && Number.isFinite(value.limit) ? Math.floor(value.limit) : 10;
    const limit = Math.max(1, Math.min(50, rawLimit));
    const rawCursor = value.cursor;
    const cursor = isRecord(rawCursor) && typeof rawCursor.chunkId === 'number' && typeof rawCursor.index === 'number'
      ? { chunkId: rawCursor.chunkId, index: rawCursor.index }
      : undefined;
    return { type, appointmentId, limit, ...(cursor ? { cursor } : {}) };
  }
  if (type === 'append_appointment_message') {
    const appointmentId = asString(value.appointmentId);
    const text = asString(value.text);
    const clientRequestId = asString(value.clientRequestId);
    if (!appointmentId) throw new Error('appointmentId is required');
    if (!text) throw new Error('text is required');
    if (!clientRequestId) throw new Error('clientRequestId is required');
    return { type, appointmentId, text, clientRequestId };
  }
  if (type === 'apply_appointment_proposal' || type === 'edit_appointment_proposal') {
    const appointmentId = asString(value.appointmentId);
    const proposalId = asString(value.proposalId);
    const field = asString(value.field);
    const valueText = asString(value.value);
    const clientRequestId = asString(value.clientRequestId);
    if (!appointmentId) throw new Error('appointmentId is required');
    if (!proposalId) throw new Error('proposalId is required');
    if (field !== 'title') throw new Error('field must be title');
    if (!valueText) throw new Error('value is required');
    if (!clientRequestId) throw new Error('clientRequestId is required');
    return { type, appointmentId, proposalId, field, value: valueText, clientRequestId };
  }
  if (type === 'dismiss_appointment_proposal' || type === 'pause_appointment_proposal' || type === 'resume_appointment_proposal') {
    const appointmentId = asString(value.appointmentId);
    const proposalId = asString(value.proposalId);
    const clientRequestId = asString(value.clientRequestId);
    if (!appointmentId) throw new Error('appointmentId is required');
    if (!proposalId) throw new Error('proposalId is required');
    if (!clientRequestId) throw new Error('clientRequestId is required');
    return { type, appointmentId, proposalId, clientRequestId };
  }
  if (type === 'add_constraint' || type === 'edit_constraint') {
    const appointmentId = asString(value.appointmentId);
    const memberEmail = asString(value.memberEmail);
    const field = asString(value.field);
    const operator = asString(value.operator);
    const valueText = asString(value.value);
    const clientRequestId = asString(value.clientRequestId);
    if (!appointmentId) throw new Error('appointmentId is required');
    if (!memberEmail || !isPlausibleEmail(memberEmail)) throw new Error('memberEmail is required');
    if (!field || !isConstraintField(field)) throw new Error('field is invalid');
    if (!operator || !isConstraintOperator(operator)) throw new Error('operator is invalid');
    if (!valueText) throw new Error('value is required');
    if (!clientRequestId) throw new Error('clientRequestId is required');
    if (type === 'edit_constraint') {
      const constraintId = asString(value.constraintId);
      if (!constraintId) throw new Error('constraintId is required');
      return { type, appointmentId, memberEmail: normalizeEmail(memberEmail), constraintId, field, operator, value: valueText, clientRequestId };
    }
    return { type, appointmentId, memberEmail: normalizeEmail(memberEmail), field, operator, value: valueText, clientRequestId };
  }
  if (type === 'remove_constraint') {
    const appointmentId = asString(value.appointmentId);
    const memberEmail = asString(value.memberEmail);
    const constraintId = asString(value.constraintId);
    const clientRequestId = asString(value.clientRequestId);
    if (!appointmentId) throw new Error('appointmentId is required');
    if (!memberEmail || !isPlausibleEmail(memberEmail)) throw new Error('memberEmail is required');
    if (!constraintId) throw new Error('constraintId is required');
    if (!clientRequestId) throw new Error('clientRequestId is required');
    return { type, appointmentId, memberEmail: normalizeEmail(memberEmail), constraintId, clientRequestId };
  }
  if (type === 'create_suggestion') {
    const appointmentId = asString(value.appointmentId);
    const field = asString(value.field);
    const valueText = asString(value.value);
    const clientRequestId = asString(value.clientRequestId);
    if (!appointmentId) throw new Error('appointmentId is required');
    if (!field || !isSuggestionField(field)) throw new Error('field is invalid');
    if (!valueText) throw new Error('value is required');
    if (!clientRequestId) throw new Error('clientRequestId is required');
    return { type, appointmentId, field, value: valueText, clientRequestId };
  }
  if (type === 'dismiss_suggestion' || type === 'react_suggestion' || type === 'apply_suggestion') {
    const appointmentId = asString(value.appointmentId);
    const suggestionId = asString(value.suggestionId);
    const field = asString(value.field);
    const clientRequestId = asString(value.clientRequestId);
    if (!appointmentId) throw new Error('appointmentId is required');
    if (!suggestionId) throw new Error('suggestionId is required');
    if (!field || !isSuggestionField(field)) throw new Error('field is invalid');
    if (!clientRequestId) throw new Error('clientRequestId is required');
    if (type === 'react_suggestion') {
      const reaction = asString(value.reaction);
      if (reaction !== 'up' && reaction !== 'down') throw new Error('reaction must be up or down');
      return { type, appointmentId, suggestionId, field, reaction, clientRequestId };
    }
    return { type, appointmentId, suggestionId, field, clientRequestId };
  }
  if (type === 'preview_appointment_update_email') {
    const appointmentId = asString(value.appointmentId);
    if (!appointmentId) throw new Error('appointmentId is required');
    if (!Array.isArray(value.recipientPersonIds)) throw new Error('recipientPersonIds must be an array');
    const recipientPersonIds = normalizeRecipientPersonIds(value.recipientPersonIds);
    const userMessage = typeof value.userMessage === 'string' ? value.userMessage : undefined;
    return { type, appointmentId, recipientPersonIds, ...(userMessage !== undefined ? { userMessage } : {}) };
  }
  if (type === 'send_appointment_update_email') {
    const appointmentId = asString(value.appointmentId);
    const clientRequestId = asString(value.clientRequestId);
    if (!appointmentId) throw new Error('appointmentId is required');
    if (!Array.isArray(value.recipientPersonIds)) throw new Error('recipientPersonIds must be an array');
    if (!clientRequestId) throw new Error('clientRequestId is required');
    const recipientPersonIds = normalizeRecipientPersonIds(value.recipientPersonIds);
    const userMessage = typeof value.userMessage === 'string' ? value.userMessage : undefined;
    return { type, appointmentId, recipientPersonIds, ...(userMessage !== undefined ? { userMessage } : {}), clientRequestId };
  }

  throw new Error(`unsupported action type: ${type}`);
};

export async function direct(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const fallbackTraceId = randomUUID();
  const body = await request.json() as DirectBody;
  const traceId = ensureTraceId(body.traceId) || fallbackTraceId;
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  const withMeta = (response: HttpResponseInit, opId: string | null = null): HttpResponseInit => withDirectMeta(response, traceId, context, opId, groupId || undefined);
  if (!groupId) return withMeta(errorResponse(400, 'invalid_group_id', 'groupId is required', traceId));
  if (process.env.DEBUG_STORAGE_TARGET === '1') {
    const storageTarget = describeStorageTarget();
    context.log(JSON.stringify({
      event: 'storage_target',
      fn: 'direct',
      groupId,
      storageMode: storageTarget.storageMode,
      accountUrl: storageTarget.accountUrl,
      containerName: storageTarget.containerName,
      stateBlobPrefix: storageTarget.stateBlobPrefix,
      blobNameForGroup: storageTarget.blobNameForGroup(groupId)
    }));
  }

  const session = await requireSessionEmail(request, traceId, { groupId });
  if (!session.ok) return withMeta(session.response);
  const bodyEmail = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
  if (bodyEmail && bodyEmail !== normalizeEmail(session.email)) {
    context.log(JSON.stringify({ event: 'direct_identity_body_email_mismatch', traceId, groupId, bodyEmailDomain: bodyEmail.split('@')[1] ?? 'unknown', sessionEmailDomain: session.email.split('@')[1] ?? 'unknown' }));
  }
  logAuth({ traceId, stage: 'gate_in', groupId, emailDomain: session.email.split('@')[1] ?? 'unknown' });

  let directAction: DirectAction;
  try {
    directAction = parseDirectAction(body.action);
  } catch (error) {
    return withMeta(badRequest(error instanceof Error ? error.message : 'invalid action', traceId));
  }

  let storage: StorageAdapter;
  try {
    storage = createStorageAdapter();
  } catch (error) {
    if (error instanceof MissingConfigError) {
      logConfigMissing('direct', traceId, error.missing);
      return withMeta(errorResponse(500, 'CONFIG_MISSING', error.message, traceId, { missing: error.missing }));
    }
    throw error;
  }
  let loaded;
  try {
    loaded = await storage.load(groupId);
  } catch (error) {
    if (error instanceof MissingConfigError) {
      logConfigMissing('direct', traceId, error.missing);
      return withMeta(errorResponse(500, 'CONFIG_MISSING', error.message, traceId, { missing: error.missing }));
    }
    if (error instanceof GroupNotFoundError) return withMeta(errorResponse(404, 'group_not_found', 'Group not found', traceId));
    throw error;
  }
  const membership = requireActiveMember(loaded.state, session.email, traceId);
  if (!membership.ok) {
    logAuth({ traceId, stage: 'gate_denied', reason: 'not_allowed' });
    return withMeta(membership.response);
  }
  const caller = membership.member;
  logAuth({ traceId, stage: 'gate_allowed', memberId: caller.memberId });
  logAppointmentAction(context, traceId, groupId, directAction);

  if (directAction.type === 'get_appointment_detail') {
    const appointment = loaded.state.appointments.find((entry) => entry.id === directAction.appointmentId);
    if (!appointment) return withMeta(errorResponse(404, 'appointment_not_found', 'Appointment not found', traceId));

    try {
      const recent = await appointmentEventStore.recent(groupId, directAction.appointmentId, directAction.cursor ? (directAction.limit ?? 20) : Math.max(directAction.limit ?? 20, 50), directAction.cursor);
      const appointmentDoc = await appointmentDocStore.getWithEtag(groupId, directAction.appointmentId);
      const doc = appointmentDoc.doc ? expireSuggestions(ensureAppointmentDoc(appointmentDoc.doc, session.email)) : null;
      const discussionTypes = new Set(['USER_MESSAGE', 'SYSTEM_CONFIRMATION', 'PROPOSAL_CREATED', 'PROPOSAL_PAUSED', 'PROPOSAL_RESUMED', 'PROPOSAL_EDITED', 'PROPOSAL_APPLIED', 'PROPOSAL_CANCELED', 'SUGGESTION_CREATED', 'SUGGESTION_APPLIED', 'SUGGESTION_DISMISSED', 'SUGGESTION_REACTED', 'SUGGESTION_REACTION', 'CONSTRAINT_ADDED', 'CONSTRAINT_REMOVED']);
      const discussionEvents = recent.events.filter((event) => discussionTypes.has(event.type));
      const changeEvents = recent.events.filter((event) => materialEventTypes.has(event.type));
      const pendingProposal = derivePendingProposal(recent.events);
      const lastNotification = mapLastNotification(recent.events);
      return withMeta({
        status: 200,
        jsonBody: {
          ok: true,
          appointment: toResponseSnapshot({ ...loaded.state, appointments: [appointment] }).appointments[0],
          eventsPage: recent.events,
          nextCursor: recent.nextCursor,
          projections: { discussionEvents, changeEvents },
          pendingProposal,
          ...(lastNotification ? { lastNotification } : {}),
          constraints: doc ? (doc.constraints as Record<string, unknown>) : { byMember: {} },
          suggestions: doc ? (doc.suggestions as Record<string, unknown>) : { byField: {} }
        }
      });
    } catch (error) {
      context.log(JSON.stringify({ event: 'appointment_detail_failed', traceId, groupId, appointmentId: directAction.appointmentId, error: error instanceof Error ? error.message : String(error) }));
      return withMeta(errorResponse(500, 'appointment_detail_failed', 'Failed to load appointment detail', traceId));
    }
  }

  if (directAction.type === 'list_appointment_notifications') {
    const appointment = loaded.state.appointments.find((entry) => entry.id === directAction.appointmentId);
    if (!appointment) return withMeta(errorResponse(404, 'appointment_not_found', 'Appointment not found', traceId));

    try {
      const limit = Math.max(1, Math.min(50, directAction.limit ?? 10));
      const recent = await appointmentEventStore.recent(groupId, directAction.appointmentId, Math.max(limit * 5, 50), directAction.cursor);
      const items = recent.events
        .filter((event) => event.type === 'NOTIFICATION_SENT')
        .map((event) => mapNotificationHistoryItem(event))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .slice(0, limit);
      return withMeta({ status: 200, jsonBody: { ok: true, items, nextCursor: recent.nextCursor } });
    } catch (error) {
      context.log(JSON.stringify({ event: 'list_appointment_notifications_failed', traceId, groupId, appointmentId: directAction.appointmentId, error: error instanceof Error ? error.message : String(error) }));
      return withMeta(errorResponse(500, 'list_appointment_notifications_failed', 'Failed to load appointment notification history', traceId));
    }
  }


  if (directAction.type === 'preview_appointment_update_email') {
    const appointment = loaded.state.appointments.find((entry) => entry.id === directAction.appointmentId);
    if (!appointment) return withMeta(errorResponse(404, 'appointment_not_found', 'Appointment not found', traceId));

    const responseAppointment = toResponseSnapshot({ ...loaded.state, appointments: [appointment] }).appointments[0];
    const recipients = await excludeOptedOutRecipients(
      storage,
      resolveNotificationRecipients(
        loaded.state,
        normalizeEmail(session.email),
        directAction.recipientPersonIds
      ),
      traceId
    );
    if (recipients.resolvedRecipients.length === 0) {
      return withMeta(errorResponse(400, 'no_eligible_recipients', 'No eligible recipients (all opted out or missing email).', traceId, {
        excludedRecipients: recipients.excludedRecipients,
        excludedSelf: recipients.excludedSelf
      }));
    }

    const senderPerson = loaded.state.people.find((person) => normalizeEmail(person.email ?? '') === normalizeEmail(session.email));
    const actorLabel = formatNotificationActor({ name: senderPerson?.name, email: session.email }, session.email);
    const existing = await appointmentEventStore.recent(groupId, directAction.appointmentId, 100);
    const latestSnapshot = latestNotificationSnapshot(existing.events);
    const currentSnapshot = buildAppointmentSnapshot(responseAppointment);
    const diffItems = diffAppointmentSnapshots(latestSnapshot.snapshot, currentSnapshot);
    const content = buildAppointmentEmailContent(
      responseAppointment,
      actorLabel,
      session.email,
      directAction.userMessage ?? '',
      buildAppointmentLink(groupId, directAction.appointmentId),
      { prevSentAt: latestSnapshot.sentAt, hadPrevious: Boolean(latestSnapshot.snapshot), items: diffItems }
    );

    const optedOutByPersonId = new Map(
      recipients.excludedRecipients
        .filter((recipient) => recipient.reason === 'opted_out' && recipient.personId)
        .map((recipient) => [recipient.personId as string, recipient])
    );
    const resolvedForUi = directAction.recipientPersonIds
      .map((personId) => loaded.state.people.find((entry) => entry.personId === personId))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .map((person) => {
        const optedOut = optedOutByPersonId.get(person.personId);
        return {
          personId: person.personId,
          display: person.name?.trim() || undefined,
          email: normalizeEmail(person.email ?? ''),
          isSelectable: !optedOut,
          ...(optedOut ? { disabledReason: 'Opted out of email' } : {})
        };
      });

    return withMeta({
      status: 200,
      jsonBody: {
        ok: true,
        subject: content.subject,
        plainText: content.plainText,
        html: content.html,
        diffSummary: { ...(latestSnapshot.sentAt ? { prevSentAt: latestSnapshot.sentAt } : {}), items: diffItems },
        resolvedRecipients: resolvedForUi,
        excludedRecipients: recipients.excludedRecipients,
        excludedSelf: recipients.excludedSelf
      }
    });
  }

  if (directAction.type === 'send_appointment_update_email') {
    const appointment = loaded.state.appointments.find((entry) => entry.id === directAction.appointmentId);
    if (!appointment) return withMeta(errorResponse(404, 'appointment_not_found', 'Appointment not found', traceId));

    const responseAppointment = toResponseSnapshot({ ...loaded.state, appointments: [appointment] }).appointments[0];
    const recipients = await excludeOptedOutRecipients(
      storage,
      resolveNotificationRecipients(
        loaded.state,
        normalizeEmail(session.email),
        directAction.recipientPersonIds
      ),
      traceId
    );
    if (recipients.resolvedRecipients.length === 0) {
      return withMeta(errorResponse(400, 'no_eligible_recipients', 'No eligible recipients (all opted out or missing email).', traceId, {
        excludedRecipients: recipients.excludedRecipients,
        excludedSelf: recipients.excludedSelf
      }));
    }

    const senderPerson = loaded.state.people.find((person) => normalizeEmail(person.email ?? '') === normalizeEmail(session.email));
    const actorLabel = formatNotificationActor({ name: senderPerson?.name, email: session.email }, session.email);
    const existing = await appointmentEventStore.recent(groupId, directAction.appointmentId, 100);
    const latestSnapshot = latestNotificationSnapshot(existing.events);
    const currentSnapshot = buildAppointmentSnapshot(responseAppointment);
    const diffItems = diffAppointmentSnapshots(latestSnapshot.snapshot, currentSnapshot);
    const content = buildAppointmentEmailContent(
      responseAppointment,
      actorLabel,
      session.email,
      directAction.userMessage ?? '',
      buildAppointmentLink(groupId, directAction.appointmentId),
      { prevSentAt: latestSnapshot.sentAt, hadPrevious: Boolean(latestSnapshot.snapshot), items: diffItems }
    );

    const duplicate = existing.events.find((event) => {
      if (event.type !== 'NOTIFICATION_SENT') return false;
      const payload = event.payload && typeof event.payload === 'object' ? event.payload as Record<string, unknown> : null;
      if (!payload) return false;
      const payloadClientRequestId = typeof payload.clientRequestId === 'string' ? payload.clientRequestId : event.clientRequestId;
      if (payloadClientRequestId !== directAction.clientRequestId) return false;
      const sentBy = (payload.sentBy && typeof payload.sentBy === 'object') ? payload.sentBy as Record<string, unknown> : null;
      return normalizeEmail(typeof sentBy?.email === 'string' ? sentBy.email : '') === normalizeEmail(session.email);
    });
    if (duplicate) {
      const payload = duplicate.payload ?? {};
      return withMeta({
        status: 200,
        jsonBody: {
          ok: true,
          sentAt: typeof payload.sentAt === 'string' ? payload.sentAt : duplicate.tsUtc,
          deliveryStatus: payload.deliveryStatus === 'partial' ? 'partial' : 'sent',
          recipientCountSent: typeof payload.recipientCountSent === 'number' ? payload.recipientCountSent : 0,
          recipientCountSelected: typeof payload.recipientCountSelected === 'number' ? payload.recipientCountSelected : 0,
          failedRecipients: Array.isArray(payload.failedRecipients) ? payload.failedRecipients : [],
          subject: typeof payload.subject === 'string' ? payload.subject : content.subject,
          excludedRecipients: Array.isArray(payload.excludedRecipients) ? payload.excludedRecipients : recipients.excludedRecipients,
          excludedSelf: recipients.excludedSelf
        }
      });
    }

    const sendResults: Array<{ email: string; providerMessageId?: string; errorMessage?: string; personId?: string; display?: string }> = [];
    for (const recipient of recipients.resolvedRecipients) {
      try {
        const provider = await sendEmail({ to: recipient.email, subject: content.subject, plainText: content.plainText, html: content.html });
        sendResults.push({ email: recipient.email, providerMessageId: provider.id, personId: recipient.personId, display: recipient.display });
      } catch (error) {
        sendResults.push({ email: recipient.email, errorMessage: error instanceof Error ? error.message : String(error), personId: recipient.personId, display: recipient.display });
      }
    }

    const successes = sendResults.filter((entry) => !entry.errorMessage);
    const failures = sendResults.filter((entry) => !!entry.errorMessage);
    if (successes.length === 0) {
      const topErrorMessage = failures.find((entry) => entry.errorMessage)?.errorMessage ?? 'unknown_send_error';
      context.log(JSON.stringify({ event: 'appointment_update_email_all_failed', traceId, groupId, appointmentId: directAction.appointmentId, failureCount: failures.length, topErrorMessage }));
      return withMeta(errorResponse(502, 'notification_send_failed', 'Failed to send update email', traceId, {
        recipientCountSelected: recipients.resolvedRecipients.length,
        failedRecipients: failures.map((entry) => ({ email: entry.email, display: entry.display, personId: entry.personId, errorMessage: entry.errorMessage })),
        excludedRecipients: recipients.excludedRecipients
      }));
    }

    const sentAt = new Date().toISOString();
    const deliveryStatus = failures.length > 0 ? 'partial' : 'sent';
    if (deliveryStatus === 'partial') {
      context.log(JSON.stringify({
        event: 'appointment_update_email_partial',
        traceId,
        groupId,
        appointmentId: directAction.appointmentId,
        successCount: successes.length,
        failCount: failures.length,
        failedEmails: failures.slice(0, 20).map((entry) => entry.email)
      }));
    }
    const eventPayload = {
      notificationId: randomUUID(),
      sentAt,
      sentBy: { email: normalizeEmail(session.email), ...(senderPerson?.name?.trim() ? { display: senderPerson.name.trim() } : {}), ...(senderPerson?.personId ? { personId: senderPerson.personId } : {}) },
      recipientCountSelected: recipients.resolvedRecipients.length,
      recipientCountSent: successes.length,
      deliveryStatus,
      failedRecipients: failures.map((entry) => ({ email: entry.email, ...(entry.display ? { display: entry.display } : {}), ...(entry.personId ? { personId: entry.personId } : {}), ...(entry.errorMessage ? { errorMessage: entry.errorMessage } : {}) })),
      subject: content.subject,
      appointmentSnapshot: currentSnapshot,
      ...(directAction.userMessage?.trim() ? { userMessage: directAction.userMessage.trim() } : {}),
      excludedRecipients: recipients.excludedRecipients,
      clientRequestId: directAction.clientRequestId
    };
    await appointmentEventStore.append(groupId, directAction.appointmentId, {
      id: randomUUID(),
      tsUtc: sentAt,
      type: 'NOTIFICATION_SENT',
      actor: { kind: 'HUMAN', email: normalizeEmail(session.email) },
      payload: eventPayload,
      clientRequestId: directAction.clientRequestId
    }, { idempotencyKey: directAction.clientRequestId });

    return withMeta({
      status: 200,
      jsonBody: {
        ok: true,
        sentAt,
        deliveryStatus,
        recipientCountSent: successes.length,
        recipientCountSelected: recipients.resolvedRecipients.length,
        failedRecipients: failures.map((entry) => ({ email: entry.email, ...(entry.display ? { display: entry.display } : {}), ...(entry.personId ? { personId: entry.personId } : {}), ...(entry.errorMessage ? { errorMessage: entry.errorMessage } : {}) })),
        subject: content.subject,
        excludedRecipients: recipients.excludedRecipients,
        excludedSelf: recipients.excludedSelf
      }
    });
  }

  if (directAction.type === 'append_appointment_message') {
    const appointment = loaded.state.appointments.find((entry) => entry.id === directAction.appointmentId);
    if (!appointment) return withMeta(errorResponse(404, 'appointment_not_found', 'Appointment not found', traceId));

    const baseEvent: AppointmentEvent = {
      id: randomUUID(),
      tsUtc: new Date().toISOString(),
      type: 'USER_MESSAGE',
      actor: { kind: 'HUMAN', email: session.email },
      payload: { text: directAction.text },
      sourceTextSnapshot: directAction.text,
      clientRequestId: directAction.clientRequestId
    };

    try {
      const appendedEvents: AppointmentEvent[] = [];
      const messageResult = await appointmentEventStore.append(groupId, directAction.appointmentId, baseEvent, { idempotencyKey: directAction.clientRequestId });
      if (messageResult.appended) appendedEvents.push(messageResult.event);

      let proposal: { proposalId: string; field: 'title'; from: string; to: string } | null = null;
      const proposedTitle = detectTitleProposal(directAction.text);

      if (proposedTitle) {
        const recent = await appointmentEventStore.recent(groupId, directAction.appointmentId, 50);
        const pendingProposal = derivePendingProposal(recent.events);
        if (pendingProposal) {
          return withMeta({
            ...errorResponse(400, 'title_proposal_pending', 'title_proposal_pending', traceId),
            jsonBody: { ...errorResponse(400, 'title_proposal_pending', 'title_proposal_pending', traceId).jsonBody, pendingProposal }
          });
        }
        const proposalId = randomUUID();
        const proposalEvent: AppointmentEvent = {
          id: randomUUID(),
          tsUtc: new Date().toISOString(),
          type: 'PROPOSAL_CREATED',
          actor: { kind: 'SYSTEM' },
          proposalId,
          sourceTextSnapshot: directAction.text,
          payload: { field: 'title', from: appointment.title ?? '', to: proposedTitle, proposalId },
          clientRequestId: `${directAction.clientRequestId}:proposal`
        };
        const proposalResult = await appointmentEventStore.append(groupId, directAction.appointmentId, proposalEvent, { idempotencyKey: `${directAction.clientRequestId}:proposal` });
        if (proposalResult.appended) appendedEvents.push(proposalResult.event);
        proposal = { proposalId, field: 'title', from: appointment.title ?? '', to: proposedTitle };
      }

      return withMeta({ status: 200, jsonBody: { ok: true, appendedEvents, proposal } });
    } catch (error) {
      context.log(JSON.stringify({ event: 'append_appointment_message_failed', traceId, groupId, appointmentId: directAction.appointmentId, error: error instanceof Error ? error.message : String(error) }));
      return withMeta(errorResponse(500, 'append_appointment_message_failed', 'Failed to append appointment message', traceId));
    }
  }

  if (directAction.type === 'apply_appointment_proposal') {
    const appointment = loaded.state.appointments.find((entry) => entry.id === directAction.appointmentId);
    if (!appointment) {
      const blobPath = appointmentJsonBlobPath(groupId, directAction.appointmentId);
      const existing = await appointmentDocStore.getWithEtag(groupId, directAction.appointmentId);
      context.log(JSON.stringify({ event: 'apply_appointment_not_found', traceId, groupId, appointmentId: directAction.appointmentId, blobPath, appointmentJsonExists: !!existing.doc }));
      return withMeta(errorResponse(404, 'appointment_not_found', 'Appointment not found', traceId));
    }

    try {
      const alreadyApplied = await appointmentEventStore.hasLatestIdempotencyKey(groupId, directAction.appointmentId, directAction.clientRequestId);
      if (alreadyApplied) {
        return withMeta({ status: 200, jsonBody: { ok: true, appointment: toResponseSnapshot({ ...loaded.state, appointments: [appointment] }).appointments[0], appendedEvents: [] } });
      }

      if (directAction.value.length > TITLE_MAX_LENGTH) return withMeta(errorResponse(400, 'invalid_title', `title must be at most ${TITLE_MAX_LENGTH} characters`, traceId));
      const recent = await appointmentEventStore.recent(groupId, directAction.appointmentId, 200);
      const activeProposal = latestActiveTitleProposal(recent.events);
      if (!activeProposal) {
        return withMeta(errorResponse(404, 'proposal_not_found', 'Proposal not found', traceId));
      }
      if (activeProposal.proposalId !== directAction.proposalId) {
        return withMeta(errorResponse(400, 'proposal_not_active', 'Proposal is not active', traceId));
      }

      const maxAttempts = 4;
      let updatedAppointmentDoc: Record<string, unknown> | null = null;
      let previousReconciliationStatus = 'unreconciled';
      let nextReconciliationStatus = 'unreconciled';
      for (let i = 0; i < maxAttempts; i += 1) {
        const ensured = await loadOrEnsureAppointment(groupId, directAction.appointmentId, session.email);
        const previousTitle = typeof ensured.doc.title === 'string' ? ensured.doc.title : '';
        previousReconciliationStatus = typeof (ensured.doc.reconciliation as Record<string, unknown> | undefined)?.status === 'string' ? String((ensured.doc.reconciliation as Record<string, unknown>).status) : 'unreconciled';
        const reconciled = evaluateReconciliation({ ...ensured.doc, id: directAction.appointmentId, title: directAction.value, updatedAt: new Date().toISOString() }, session.email);
        nextReconciliationStatus = reconciled.status;
        const nextDoc = reconciled.doc;
        if (!ensured.etag) {
          context.log(JSON.stringify({ event: 'apply_appointment_proposal_missing_etag', traceId, groupId, appointmentId: directAction.appointmentId, blobPath: ensured.blobPath }));
          continue;
        }
        const saved = await appointmentDocStore.putWithEtag(groupId, directAction.appointmentId, nextDoc, ensured.etag);
        if (saved) {
          updatedAppointmentDoc = { ...nextDoc, _previousTitle: previousTitle };
          break;
        }
      }

      if (!updatedAppointmentDoc) return withMeta(errorResponse(409, 'state_changed', 'State changed. Retry.', traceId));

      const maxStateSaveAttempts = 4;
      let persistedState = loaded.state;
      let persistedStateAppointment = loaded.state.appointments.find((entry) => entry.id === directAction.appointmentId) ?? appointment;
      let stateSaveSucceeded = false;
      for (let i = 0; i < maxStateSaveAttempts; i += 1) {
        const baseLoaded = i === 0 ? { state: persistedState, etag: loaded.etag } : await storage.load(groupId);
        const nextState = structuredClone(baseLoaded.state);
        const nextAppointment = nextState.appointments.find((entry) => entry.id === directAction.appointmentId);
        if (!nextAppointment) break;
        nextAppointment.title = directAction.value;
        (nextAppointment as unknown as Record<string, unknown>).desc = directAction.value;
        nextAppointment.updatedAt = new Date().toISOString();
        try {
          const saved = await storage.save(groupId, nextState, baseLoaded.etag);
          persistedState = saved.state;
          persistedStateAppointment = saved.state.appointments.find((entry) => entry.id === directAction.appointmentId) ?? persistedStateAppointment;
          stateSaveSucceeded = true;
          break;
        } catch (error) {
          if (error instanceof ConflictError) continue;
          throw error;
        }
      }
      if (!stateSaveSucceeded) return withMeta(errorResponse(409, 'state_changed', 'State changed. Retry.', traceId));

      const proposalAppliedEvent: AppointmentEvent = {
        id: randomUUID(),
        tsUtc: new Date().toISOString(),
        type: 'PROPOSAL_APPLIED',
        actor: { kind: 'HUMAN', email: session.email },
        proposalId: directAction.proposalId,
        clientRequestId: `${directAction.clientRequestId}:proposal-applied`,
        payload: { proposalId: directAction.proposalId, field: 'title' }
      };
      const changedEvent: AppointmentEvent = {
        id: randomUUID(),
        tsUtc: new Date().toISOString(),
        type: 'FIELD_CHANGED',
        actor: { kind: 'HUMAN', email: session.email },
        proposalId: directAction.proposalId,
        clientRequestId: directAction.clientRequestId,
        payload: { field: 'title', from: (updatedAppointmentDoc as Record<string, unknown>)._previousTitle, to: directAction.value }
      };
      const confirmEvent: AppointmentEvent = {
        id: randomUUID(),
        tsUtc: new Date().toISOString(),
        type: 'SYSTEM_CONFIRMATION',
        actor: { kind: 'SYSTEM' },
        proposalId: directAction.proposalId,
        payload: { message: `Title updated to "${directAction.value}"`, by: session.email },
        clientRequestId: `${directAction.clientRequestId}:confirm`
      };
      await appointmentEventStore.append(groupId, directAction.appointmentId, proposalAppliedEvent, { idempotencyKey: `${directAction.clientRequestId}:proposal-applied` });
      await appointmentEventStore.append(groupId, directAction.appointmentId, changedEvent, { idempotencyKey: directAction.clientRequestId });
      await appointmentEventStore.append(groupId, directAction.appointmentId, confirmEvent, { idempotencyKey: `${directAction.clientRequestId}:confirm` });

      const appendedEvents: AppointmentEvent[] = [proposalAppliedEvent, changedEvent, confirmEvent];
      if (previousReconciliationStatus !== nextReconciliationStatus) {
        const reconciliationChanged: AppointmentEvent = {
          id: randomUUID(),
          tsUtc: new Date().toISOString(),
          type: 'RECONCILIATION_CHANGED',
          actor: { kind: 'SYSTEM' },
          payload: { from: previousReconciliationStatus, to: nextReconciliationStatus },
          clientRequestId: `${directAction.clientRequestId}:reconciliation`
        };
        const reconciliationConfirmation: AppointmentEvent = {
          id: randomUUID(),
          tsUtc: new Date().toISOString(),
          type: 'SYSTEM_CONFIRMATION',
          actor: { kind: 'SYSTEM' },
          payload: { message: `Reconciliation status changed to ${nextReconciliationStatus}` },
          clientRequestId: `${directAction.clientRequestId}:reconciliation-confirm`
        };
        await appointmentEventStore.append(groupId, directAction.appointmentId, reconciliationChanged, { idempotencyKey: `${directAction.clientRequestId}:reconciliation` });
        await appointmentEventStore.append(groupId, directAction.appointmentId, reconciliationConfirmation, { idempotencyKey: `${directAction.clientRequestId}:reconciliation-confirm` });
        appendedEvents.push(reconciliationChanged, reconciliationConfirmation);
      }

      return withMeta({
        status: 200,
        jsonBody: {
          ok: true,
          appointment: toResponseSnapshot({ ...persistedState, appointments: [persistedStateAppointment] }).appointments[0],
          appendedEvents,
          eventsPageHead: appendedEvents
        }
      });
    } catch (error) {
      context.log(JSON.stringify({ event: 'apply_appointment_proposal_failed', traceId, groupId, appointmentId: directAction.appointmentId, error: error instanceof Error ? error.message : String(error) }));
      return withMeta(errorResponse(500, 'apply_appointment_proposal_failed', 'Failed to apply proposal', traceId));
    }
  }

  if (directAction.type === 'pause_appointment_proposal' || directAction.type === 'resume_appointment_proposal') {
    const appointment = loaded.state.appointments.find((entry) => entry.id === directAction.appointmentId);
    if (!appointment) return withMeta(errorResponse(404, 'appointment_not_found', 'Appointment not found', traceId));
    try {
      const eventType = directAction.type === 'pause_appointment_proposal' ? 'PROPOSAL_PAUSED' : 'PROPOSAL_RESUMED';
      const proposalEvent: AppointmentEvent = {
        id: randomUUID(),
        tsUtc: new Date().toISOString(),
        type: eventType,
        actor: { kind: 'HUMAN', email: session.email },
        proposalId: directAction.proposalId,
        payload: { proposalId: directAction.proposalId },
        clientRequestId: directAction.clientRequestId
      };
      await appointmentEventStore.append(groupId, directAction.appointmentId, proposalEvent, { idempotencyKey: directAction.clientRequestId });
      return withMeta({ status: 200, jsonBody: { ok: true, appendedEvents: [proposalEvent] } });
    } catch (error) {
      context.log(JSON.stringify({ event: 'proposal_lifecycle_failed', traceId, groupId, appointmentId: directAction.appointmentId, error: error instanceof Error ? error.message : String(error) }));
      return withMeta(errorResponse(500, 'proposal_lifecycle_failed', 'Failed proposal lifecycle update', traceId));
    }
  }

  if (directAction.type === 'edit_appointment_proposal') {
    const appointment = loaded.state.appointments.find((entry) => entry.id === directAction.appointmentId);
    if (!appointment) {
      const blobPath = appointmentJsonBlobPath(groupId, directAction.appointmentId);
      const existing = await appointmentDocStore.getWithEtag(groupId, directAction.appointmentId);
      context.log(JSON.stringify({ event: 'apply_appointment_not_found', traceId, groupId, appointmentId: directAction.appointmentId, blobPath, appointmentJsonExists: !!existing.doc }));
      return withMeta(errorResponse(404, 'appointment_not_found', 'Appointment not found', traceId));
    }
    try {
      const recent = await appointmentEventStore.recent(groupId, directAction.appointmentId, 200);
      const activeProposal = latestActiveTitleProposal(recent.events);
      if (!activeProposal || activeProposal.proposalId !== directAction.proposalId) return withMeta(errorResponse(400, 'proposal_not_active', 'Proposal is not active', traceId));
      const beforeText = String((activeProposal.payload as Record<string, unknown>).to ?? '');
      const editEvent: AppointmentEvent = {
        id: randomUUID(),
        tsUtc: new Date().toISOString(),
        type: 'PROPOSAL_EDITED',
        actor: { kind: 'HUMAN', email: session.email },
        proposalId: directAction.proposalId,
        payload: { proposalId: directAction.proposalId, beforeText, afterText: directAction.value },
        clientRequestId: directAction.clientRequestId
      };
      await appointmentEventStore.append(groupId, directAction.appointmentId, editEvent, { idempotencyKey: directAction.clientRequestId });
      return withMeta({ status: 200, jsonBody: { ok: true, appendedEvents: [editEvent] } });
    } catch (error) {
      context.log(JSON.stringify({ event: 'edit_appointment_proposal_failed', traceId, groupId, appointmentId: directAction.appointmentId, error: error instanceof Error ? error.message : String(error) }));
      return withMeta(errorResponse(500, 'edit_appointment_proposal_failed', 'Failed to edit proposal', traceId));
    }
  }

  if (directAction.type === 'add_constraint' || directAction.type === 'edit_constraint' || directAction.type === 'remove_constraint') {
    const appointment = loaded.state.appointments.find((entry) => entry.id === directAction.appointmentId);
    if (!appointment) {
      const blobPath = appointmentJsonBlobPath(groupId, directAction.appointmentId);
      const existing = await appointmentDocStore.getWithEtag(groupId, directAction.appointmentId);
      context.log(JSON.stringify({ event: 'apply_appointment_not_found', traceId, groupId, appointmentId: directAction.appointmentId, blobPath, appointmentJsonExists: !!existing.doc }));
      return withMeta(errorResponse(404, 'appointment_not_found', 'Appointment not found', traceId));
    }
    if (normalizeEmail(session.email) !== directAction.memberEmail) return withMeta(errorResponse(403, 'forbidden_constraint_member', 'Members can only edit their own constraints', traceId));
    try {
      const current = await appointmentDocStore.getWithEtag(groupId, directAction.appointmentId);
      if (!current.doc || !current.etag) return withMeta(errorResponse(404, 'appointment_not_found', 'Appointment not found', traceId));
      const beforeReconciliation = String(((current.doc.reconciliation as Record<string, unknown> | undefined)?.status) ?? 'unreconciled');
      let nextDoc = current.doc;
      const eventsToAppend: AppointmentEvent[] = [];
      if (directAction.type === 'remove_constraint') {
        const removed = removeConstraintForMember(current.doc, directAction.memberEmail, directAction.constraintId);
        if (!removed.removed) return withMeta(errorResponse(404, 'constraint_not_found', 'Constraint not found', traceId));
        nextDoc = removed.doc;
        eventsToAppend.push({ id: randomUUID(), tsUtc: new Date().toISOString(), type: 'CONSTRAINT_REMOVED', actor: { kind: 'HUMAN', email: session.email }, payload: { memberEmail: directAction.memberEmail, constraintId: directAction.constraintId }, clientRequestId: directAction.clientRequestId });
      } else {
        const upserted = upsertConstraintForMember(current.doc, directAction.memberEmail, {
          constraintId: directAction.type === 'edit_constraint' ? directAction.constraintId : undefined,
          field: directAction.field,
          operator: directAction.operator,
          value: directAction.value
        });
        nextDoc = upserted.doc;
        if (upserted.removed) eventsToAppend.push({ id: randomUUID(), tsUtc: new Date().toISOString(), type: 'CONSTRAINT_REMOVED', actor: { kind: 'HUMAN', email: session.email }, payload: { memberEmail: directAction.memberEmail, constraintId: upserted.removed.id }, clientRequestId: `${directAction.clientRequestId}:removed` });
        eventsToAppend.push({ id: randomUUID(), tsUtc: new Date().toISOString(), type: 'CONSTRAINT_ADDED', actor: { kind: 'HUMAN', email: session.email }, payload: { memberEmail: directAction.memberEmail, constraint: upserted.added }, clientRequestId: directAction.clientRequestId });
      }
      const reconciled = evaluateReconciliation(nextDoc, session.email);
      const afterReconciliation = reconciled.status;
      const saved = await appointmentDocStore.putWithEtag(groupId, directAction.appointmentId, reconciled.doc, current.etag);
      if (!saved) return withMeta(errorResponse(409, 'state_changed', 'State changed. Retry.', traceId));
      for (const event of eventsToAppend) await appointmentEventStore.append(groupId, directAction.appointmentId, event, { idempotencyKey: event.clientRequestId });
      if (beforeReconciliation !== afterReconciliation) {
        const reconciliationChanged: AppointmentEvent = { id: randomUUID(), tsUtc: new Date().toISOString(), type: 'RECONCILIATION_CHANGED', actor: { kind: 'SYSTEM' }, payload: { from: beforeReconciliation, to: afterReconciliation }, clientRequestId: `${directAction.clientRequestId}:reconciliation` };
        const reconciliationConfirmation: AppointmentEvent = { id: randomUUID(), tsUtc: new Date().toISOString(), type: 'SYSTEM_CONFIRMATION', actor: { kind: 'SYSTEM' }, payload: { message: `Reconciliation status changed to ${afterReconciliation}` }, clientRequestId: `${directAction.clientRequestId}:reconciliation-confirm` };
        await appointmentEventStore.append(groupId, directAction.appointmentId, reconciliationChanged, { idempotencyKey: reconciliationChanged.clientRequestId });
        await appointmentEventStore.append(groupId, directAction.appointmentId, reconciliationConfirmation, { idempotencyKey: reconciliationConfirmation.clientRequestId });
        eventsToAppend.push(reconciliationChanged, reconciliationConfirmation);
      }
      return withMeta({ status: 200, jsonBody: { ok: true, constraints: { byMember: { [directAction.memberEmail]: activeConstraintsForMember(reconciled.doc, directAction.memberEmail) } }, appendedEvents: eventsToAppend } });
    } catch (error) {
      context.log(JSON.stringify({ event: 'constraint_action_failed', traceId, groupId, appointmentId: directAction.appointmentId, error: error instanceof Error ? error.message : String(error) }));
      return withMeta(errorResponse(500, 'constraint_action_failed', 'Failed constraint action', traceId));
    }
  }

  if (directAction.type === 'create_suggestion' || directAction.type === 'dismiss_suggestion' || directAction.type === 'react_suggestion' || directAction.type === 'apply_suggestion') {
    const appointment = loaded.state.appointments.find((entry) => entry.id === directAction.appointmentId);
    if (!appointment) {
      const blobPath = appointmentJsonBlobPath(groupId, directAction.appointmentId);
      const existing = await appointmentDocStore.getWithEtag(groupId, directAction.appointmentId);
      context.log(JSON.stringify({ event: 'apply_appointment_not_found', traceId, groupId, appointmentId: directAction.appointmentId, blobPath, appointmentJsonExists: !!existing.doc }));
      return withMeta(errorResponse(404, 'appointment_not_found', 'Appointment not found', traceId));
    }
    try {
      const current = await appointmentDocStore.getWithEtag(groupId, directAction.appointmentId);
      if (!current.doc || !current.etag) return withMeta(errorResponse(404, 'appointment_not_found', 'Appointment not found', traceId));
      const doc = expireSuggestions(ensureAppointmentDoc(current.doc, session.email));
      const byField = ((doc.suggestions as Record<string, unknown>).byField as Record<string, unknown>) ?? {};
      const field = directAction.type === 'create_suggestion' ? directAction.field : directAction.field;
      const list = Array.isArray(byField[field]) ? [...(byField[field] as Record<string, unknown>[])] : [];
      const now = new Date().toISOString();
      const appendedEvents: AppointmentEvent[] = [];
      const canonicalReactionType = 'SUGGESTION_REACTED';

      if (directAction.type === 'create_suggestion') {
        const activeByMemberAndField = activeSuggestionsByField(doc, directAction.field).filter((entry) => normalizeEmail(entry.proposerEmail) === normalizeEmail(session.email));
        if (activeByMemberAndField.length >= 3) return withMeta(errorResponse(400, 'suggestion_limit_exceeded', 'Maximum 3 active suggestions per member per field', traceId));
        const created = newSuggestion({ proposerEmail: normalizeEmail(session.email), field: directAction.field, value: directAction.value });
        list.push(created as unknown as Record<string, unknown>);
        const activeValues = list.map((entry) => ({ active: entry.active !== false && entry.status === 'active', value: String(entry.value ?? ''), id: String(entry.id ?? '') }));
        const distinctValues = new Set(activeValues.filter((entry) => entry.active).map((entry) => entry.value));
        const conflicted = distinctValues.size > 1;
        const nextList = list.map((entry) => {
          if (entry.active !== false && entry.status === 'active') return { ...entry, conflicted };
          return entry;
        });
        byField[field] = nextList;
        const saved = await appointmentDocStore.putWithEtag(groupId, directAction.appointmentId, { ...doc, suggestions: { byField } }, current.etag);
        if (!saved) return withMeta(errorResponse(409, 'state_changed', 'State changed. Retry.', traceId));
        const ev: AppointmentEvent = { id: randomUUID(), tsUtc: now, type: 'SUGGESTION_CREATED', actor: { kind: 'HUMAN', email: session.email }, payload: { suggestion: { ...created, conflicted } }, clientRequestId: directAction.clientRequestId };
        await appointmentEventStore.append(groupId, directAction.appointmentId, ev, { idempotencyKey: directAction.clientRequestId });
        appendedEvents.push(ev);
      } else {
        const idx = list.findIndex((entry) => String(entry.id ?? '') === directAction.suggestionId);
        if (idx < 0) return withMeta(errorResponse(404, 'suggestion_not_found', 'Suggestion not found', traceId));
        const target = list[idx] as Record<string, unknown>;
        if (directAction.type === 'dismiss_suggestion') {
          if (normalizeEmail(String(target.proposerEmail ?? '')) !== normalizeEmail(session.email)) return withMeta(errorResponse(403, 'not_suggestion_proposer', 'Only proposer can dismiss suggestion', traceId));
          list[idx] = { ...target, active: false, status: 'dismissed', updatedAtUtc: now };
          byField[field] = list;
          const saved = await appointmentDocStore.putWithEtag(groupId, directAction.appointmentId, { ...doc, suggestions: { byField } }, current.etag);
          if (!saved) return withMeta(errorResponse(409, 'state_changed', 'State changed. Retry.', traceId));
          const ev: AppointmentEvent = { id: randomUUID(), tsUtc: now, type: 'SUGGESTION_DISMISSED', actor: { kind: 'HUMAN', email: session.email }, payload: { suggestionId: directAction.suggestionId, field }, clientRequestId: directAction.clientRequestId };
          await appointmentEventStore.append(groupId, directAction.appointmentId, ev, { idempotencyKey: directAction.clientRequestId });
          appendedEvents.push(ev);
        }
        if (directAction.type === 'react_suggestion') {
          const reactions = Array.isArray(target.reactions) ? [...(target.reactions as Record<string, unknown>[])] : [];
          const email = normalizeEmail(session.email);
          const nextReactions = [
            ...reactions.filter((entry) => normalizeEmail(String(entry.email ?? '')) !== email),
            { email, reaction: directAction.reaction, tsUtc: now }
          ];
          list[idx] = { ...target, reactions: nextReactions, updatedAtUtc: now };
          byField[field] = list;
          const saved = await appointmentDocStore.putWithEtag(groupId, directAction.appointmentId, { ...doc, suggestions: { byField } }, current.etag);
          if (!saved) return withMeta(errorResponse(409, 'state_changed', 'State changed. Retry.', traceId));
          const ev: AppointmentEvent = { id: randomUUID(), tsUtc: now, type: canonicalReactionType, actor: { kind: 'HUMAN', email: session.email }, payload: { suggestionId: directAction.suggestionId, field, reaction: directAction.reaction }, clientRequestId: directAction.clientRequestId };
          await appointmentEventStore.append(groupId, directAction.appointmentId, ev, { idempotencyKey: directAction.clientRequestId });
          appendedEvents.push(ev);
        }
        if (directAction.type === 'apply_suggestion') {
          const previousReconciliationStatus = String(((doc.reconciliation as Record<string, unknown>).status) ?? 'unreconciled');
          const value = String(target.value ?? '');
          list[idx] = { ...target, active: false, status: 'applied', updatedAtUtc: now };
          const nextDocRaw = { ...doc, suggestions: { byField: { ...byField, [field]: list } }, ...(field === 'title' ? { title: value } : {}), ...(field === 'location' ? { locationDisplay: value, location: value, locationRaw: value } : {}), ...(field === 'time' ? { startTime: value } : {}) };
          const reconciled = evaluateReconciliation(nextDocRaw, session.email);
          const saved = await appointmentDocStore.putWithEtag(groupId, directAction.appointmentId, reconciled.doc, current.etag);
          if (!saved) return withMeta(errorResponse(409, 'state_changed', 'State changed. Retry.', traceId));
          const suggestionApplied: AppointmentEvent = { id: randomUUID(), tsUtc: now, type: 'SUGGESTION_APPLIED', actor: { kind: 'HUMAN', email: session.email }, payload: { suggestionId: directAction.suggestionId, field, value }, clientRequestId: `${directAction.clientRequestId}:applied` };
          const fieldChanged: AppointmentEvent = { id: randomUUID(), tsUtc: now, type: 'FIELD_CHANGED', actor: { kind: 'HUMAN', email: session.email }, payload: { field, to: value }, clientRequestId: directAction.clientRequestId };
          await appointmentEventStore.append(groupId, directAction.appointmentId, suggestionApplied, { idempotencyKey: suggestionApplied.clientRequestId });
          await appointmentEventStore.append(groupId, directAction.appointmentId, fieldChanged, { idempotencyKey: directAction.clientRequestId });
          appendedEvents.push(suggestionApplied, fieldChanged);
          const nextReconciliationStatus = reconciled.status;
          if (previousReconciliationStatus !== nextReconciliationStatus) {
            const reconciliationChanged: AppointmentEvent = { id: randomUUID(), tsUtc: now, type: 'RECONCILIATION_CHANGED', actor: { kind: 'SYSTEM' }, payload: { from: previousReconciliationStatus, to: nextReconciliationStatus }, clientRequestId: `${directAction.clientRequestId}:reconciliation` };
            const reconciliationConfirmation: AppointmentEvent = { id: randomUUID(), tsUtc: now, type: 'SYSTEM_CONFIRMATION', actor: { kind: 'SYSTEM' }, payload: { message: `Reconciliation status changed to ${nextReconciliationStatus}` }, clientRequestId: `${directAction.clientRequestId}:reconciliation-confirm` };
            await appointmentEventStore.append(groupId, directAction.appointmentId, reconciliationChanged, { idempotencyKey: reconciliationChanged.clientRequestId });
            await appointmentEventStore.append(groupId, directAction.appointmentId, reconciliationConfirmation, { idempotencyKey: reconciliationConfirmation.clientRequestId });
            appendedEvents.push(reconciliationChanged, reconciliationConfirmation);
          }
        }
      }

      const latest = await appointmentDocStore.getWithEtag(groupId, directAction.appointmentId);
      const finalDoc = latest.doc ? expireSuggestions(ensureAppointmentDoc(latest.doc, session.email)) : doc;
      return withMeta({ status: 200, jsonBody: { ok: true, appendedEvents, suggestions: finalDoc.suggestions } });
    } catch (error) {
      context.log(JSON.stringify({ event: 'suggestion_action_failed', traceId, groupId, appointmentId: directAction.appointmentId, error: error instanceof Error ? error.message : String(error) }));
      return withMeta(errorResponse(500, 'suggestion_action_failed', 'Failed suggestion action', traceId));
    }
  }


  if (directAction.type === 'dismiss_appointment_proposal') {
    const appointment = loaded.state.appointments.find((entry) => entry.id === directAction.appointmentId);
    if (!appointment) return withMeta(errorResponse(404, 'appointment_not_found', 'Appointment not found', traceId));
    try {
      await loadOrEnsureAppointment(groupId, directAction.appointmentId, session.email);
      const recent = await appointmentEventStore.recent(groupId, directAction.appointmentId, 200);
      const activeProposal = latestActiveTitleProposal(recent.events);
      if (!activeProposal) return withMeta(errorResponse(404, 'proposal_not_found', 'Proposal not found', traceId));
      if (activeProposal.proposalId !== directAction.proposalId) return withMeta(errorResponse(400, 'proposal_not_active', 'Proposal is not active', traceId));
      const cancelEvent: AppointmentEvent = {
        id: randomUUID(),
        tsUtc: new Date().toISOString(),
        type: 'PROPOSAL_CANCELED',
        actor: { kind: 'HUMAN', email: session.email },
        proposalId: directAction.proposalId,
        payload: { proposalId: directAction.proposalId, field: 'title' },
        clientRequestId: directAction.clientRequestId
      };
      const confirmationEvent: AppointmentEvent = {
        id: randomUUID(),
        tsUtc: new Date().toISOString(),
        type: 'SYSTEM_CONFIRMATION',
        actor: { kind: 'SYSTEM' },
        proposalId: directAction.proposalId,
        payload: { message: 'Title proposal cancelled' },
        clientRequestId: `${directAction.clientRequestId}:confirm`
      };
      await appointmentEventStore.append(groupId, directAction.appointmentId, cancelEvent, { idempotencyKey: directAction.clientRequestId });
      await appointmentEventStore.append(groupId, directAction.appointmentId, confirmationEvent, { idempotencyKey: `${directAction.clientRequestId}:confirm` });
      return withMeta({ status: 200, jsonBody: { ok: true, appendedEvents: [cancelEvent, confirmationEvent] } });
    } catch (error) {
      context.log(JSON.stringify({ event: 'dismiss_appointment_proposal_failed', traceId, groupId, appointmentId: directAction.appointmentId, error: error instanceof Error ? error.message : String(error) }));
      return withMeta(errorResponse(500, 'dismiss_appointment_proposal_failed', 'Failed to dismiss proposal', traceId));
    }
  }

  if (directAction.type === 'resolve_appointment_time') {
    const timezone = directAction.timezone || process.env.TZ || 'America/Los_Angeles';
    const nowIso = new Date().toISOString();
    const appointment = directAction.appointmentId
      ? loaded.state.appointments.find((entry) => entry.id === directAction.appointmentId)
      : undefined;
    const appointmentDateLocal = appointment?.time?.resolved?.startUtc
      ? localDateFromResolvedStart(appointment.time.resolved.startUtc, timezone)
      : appointment?.date;
    const resolved = await resolveTimeSpecWithFallback({
      whenText: directAction.whenText,
      timezone,
      now: new Date(nowIso),
      traceId,
      context
    });
    const fallbackAttempted = resolved.fallbackAttempted;
    const usedFallback = resolved.usedFallback;
    const opId = resolved.opId ?? null;
    const model = resolved.model;

    if (!resolved.ok) {
      return withMeta({
        status: 502,
        jsonBody: {
          ok: false,
          error: resolved.error,
          message: resolved.error.message,
          traceId,
          directVersion: DIRECT_VERSION,
          usedFallback,
          fallbackAttempted,
          opId,
          nowIso
        }
      }, opId);
    }

      context.log(JSON.stringify({
        event: 'openai_result',
        route: 'direct',
        traceId,
        invocationId: context.invocationId,
        opId,
        model: model ?? null,
        inputPreview: (directAction.whenText ?? '').slice(0, 120),
        parseStatus: resolved?.time?.intent?.status ?? null,
        timezone
      }));

      if (TIME_RESOLVE_LOG_ENABLED) {
        context.log(JSON.stringify({
          kind: 'time_resolve',
          traceId,
          invocationId: context.invocationId,
          traceparent: (context.traceContext as { traceParent?: string } | undefined)?.traceParent,
          appointmentId: directAction.appointmentId,
          timezone,
          whenText: directAction.whenText,
          fallbackAttempted,
          usedFallback,
          status: resolved.time.intent.status,
          missing: resolved.time.intent.missing ?? [],
          directVersion: DIRECT_VERSION,
          opId: opId ?? null,
          model: model ?? null
        }));
      }

    const timeChoices = isTimeOnlyMissingDateIntent(resolved.time.intent, directAction.whenText)
      ? buildTimeChoicesForUnresolvedTimeOnly({
        whenText: directAction.whenText,
        timezone,
        nowIso,
        appointmentDateLocal
      })
      : undefined;

    return withMeta({
      status: 200,
      jsonBody: {
        ok: true,
        time: resolved.time,
        timezone,
        appointmentId: directAction.appointmentId,
        traceId,
        directVersion: DIRECT_VERSION,
        usedFallback,
        fallbackAttempted,
        opId,
        nowIso,
        ...(timeChoices?.length ? { timeChoices } : {})
      }
    }, opId);
  }

  if (directAction.type === 'delete_appointment') {
    const resolvedDelete = resolveDeleteAppointmentId(loaded.state, directAction);
    if ('error' in resolvedDelete) {
      const snapshot = await buildDirectSnapshot(groupId, loaded.state, traceId);
      context.log(JSON.stringify({ event: 'direct_delete_appointment', traceId, groupId, appointmentId: directAction.appointmentId ?? null, appliedAll: false, storeMutated: 'index/doc', message: resolvedDelete.error }));
      return withMeta({ status: 200, jsonBody: { ok: false, message: resolvedDelete.error, snapshot, traceId } });
    }

    const deleted = await softDeleteAppointmentById(groupId, resolvedDelete.appointmentId, userKeyFromEmail(session.email));
    if (!deleted.ok) {
      const snapshot = await buildDirectSnapshot(groupId, loaded.state, traceId);
      context.log(JSON.stringify({ event: 'direct_delete_appointment', traceId, groupId, appointmentId: resolvedDelete.appointmentId, appliedAll: false, storeMutated: 'index/doc', message: deleted.message }));
      return withMeta({ status: 200, jsonBody: { ok: false, message: deleted.message, snapshot, traceId } });
    }

    const writtenSnapshot = await buildDirectSnapshot(groupId, loaded.state, traceId);
    context.log(JSON.stringify({ event: 'direct_delete_appointment', traceId, groupId, appointmentId: resolvedDelete.appointmentId, appliedAll: true, storeMutated: 'index/doc' }));
    return withMeta({ status: 200, jsonBody: { ok: true, snapshot: writtenSnapshot } });
  }

  if (directAction.type === 'restore_appointment') {
    const restored = await restoreAppointmentById(groupId, directAction.appointmentId);
    if (!restored.ok) {
      const snapshot = await buildDirectSnapshot(groupId, loaded.state, traceId);
      return withMeta({ status: 200, jsonBody: { ok: false, message: restored.message, snapshot, traceId } });
    }

    const writtenSnapshot = await buildDirectSnapshot(groupId, loaded.state, traceId);
    if (restored.alreadyActive) {
      return withMeta({ status: 200, jsonBody: { ok: true, snapshot: writtenSnapshot, message: `Already active: ${directAction.appointmentId}` } });
    }
    return withMeta({ status: 200, jsonBody: { ok: true, snapshot: writtenSnapshot } });
  }

  const execution = await executeActions(loaded.state, [directAction as Action], { activePersonId: caller.memberId, timezoneName: process.env.TZ ?? 'America/Los_Angeles' });
  if (directAction.type === 'create_blank_appointment') {
    if (!execution.appliedAll) return withMeta({ status: 200, jsonBody: { ok: false, message: execution.effectsTextLines.join(' | ') || 'Action could not be applied', snapshot: await buildDirectSnapshot(groupId, loaded.state, traceId), traceId } });
    try {
      const written = await storage.save(groupId, execution.nextState, loaded.etag);
      const createdAppointment = written.state.appointments[written.state.appointments.length - 1];
      if (createdAppointment?.id) {
        await loadOrEnsureAppointment(groupId, createdAppointment.id, session.email);
      }
      await persistCreatedAppointmentDocAndIndex(groupId, loaded.state, written.state, session.email);
      return withMeta({ status: 200, jsonBody: { ok: true, snapshot: await buildDirectSnapshot(groupId, written.state, traceId) } });
    } catch (error) {
      if (error instanceof MissingConfigError) {
        logConfigMissing('direct', traceId, error.missing);
        return withMeta(errorResponse(500, 'CONFIG_MISSING', error.message, traceId, { missing: error.missing }));
      }
      if (error instanceof ConflictError) return withMeta({ status: 409, jsonBody: { ok: false, message: 'State changed. Retry.', traceId } });
      throw error;
    }
  }

  if (directAction.type === 'create_blank_person') {
    const personId = nextPersonId(loaded.state);
    const now = new Date().toISOString();
    loaded.state.people.push({ personId, name: '', email: '', cellE164: '', cellDisplay: '', status: 'active', createdAt: now, lastSeen: now, timezone: process.env.TZ ?? 'America/Los_Angeles', notes: '' });
    try {
      const written = await storage.save(groupId, loaded.state, loaded.etag);
      return withMeta({ status: 200, jsonBody: { ok: true, snapshot: await buildDirectSnapshot(groupId, written.state, traceId), personId } });
    } catch (error) {
      if (error instanceof MissingConfigError) {
        logConfigMissing('direct', traceId, error.missing);
        return withMeta(errorResponse(500, 'CONFIG_MISSING', error.message, traceId, { missing: error.missing }));
      }
      if (error instanceof ConflictError) return withMeta({ status: 409, jsonBody: { ok: false, message: 'State changed. Retry.', traceId } });
      throw error;
    }
  }

  if (directAction.type === 'update_person') {
    const person = loaded.state.people.find((entry) => entry.personId === directAction.personId);
    if (!person) return withMeta(badRequest('Person not found', traceId));
    const nextName = directAction.name === undefined ? person.name : directAction.name.trim();
    const nextEmailRaw = directAction.email ?? person.email ?? '';
    const nextEmail = normalizeEmail(nextEmailRaw);

    if (!nextName) return withMeta(badRequest('Name is required', traceId));
    if (!nextEmail || !isPlausibleEmail(nextEmail)) return withMeta(badRequest('Invalid email', traceId));

    const duplicate = loaded.state.people.find((entry) => entry.status === 'active' && entry.personId !== person.personId && normalizeEmail(entry.email ?? '') === nextEmail);
    if (duplicate) return withMeta(badRequest(`That email is already used by ${duplicate.name || duplicate.personId}`, traceId));

    person.name = nextName;
    person.email = nextEmail;
    person.lastSeen = new Date().toISOString();
    try {
      const written = await storage.save(groupId, loaded.state, loaded.etag);
      return withMeta({ status: 200, jsonBody: { ok: true, snapshot: await buildDirectSnapshot(groupId, written.state, traceId) } });
    } catch (error) {
      if (error instanceof MissingConfigError) {
        logConfigMissing('direct', traceId, error.missing);
        return withMeta(errorResponse(500, 'CONFIG_MISSING', error.message, traceId, { missing: error.missing }));
      }
      if (error instanceof ConflictError) return withMeta({ status: 409, jsonBody: { ok: false, message: 'State changed. Retry.', traceId } });
      throw error;
    }
  }

  if (directAction.type === 'delete_person' || directAction.type === 'reactivate_person') {
    const person = loaded.state.people.find((entry) => entry.personId === directAction.personId);
    if (!person) return withMeta(badRequest('Person not found', traceId));
    person.status = directAction.type === 'delete_person' ? 'removed' : 'active';
    person.lastSeen = new Date().toISOString();
    try {
      const written = await storage.save(groupId, loaded.state, loaded.etag);
      return withMeta({ status: 200, jsonBody: { ok: true, snapshot: await buildDirectSnapshot(groupId, written.state, traceId) } });
    } catch (error) {
      if (error instanceof MissingConfigError) {
        logConfigMissing('direct', traceId, error.missing);
        return withMeta(errorResponse(500, 'CONFIG_MISSING', error.message, traceId, { missing: error.missing }));
      }
      if (error instanceof ConflictError) return withMeta({ status: 409, jsonBody: { ok: false, message: 'State changed. Retry.', traceId } });
      throw error;
    }
  }

  if (!execution.appliedAll) return withMeta({ status: 200, jsonBody: { ok: false, message: execution.effectsTextLines.join(' | ') || 'Action could not be applied', snapshot: await buildDirectSnapshot(groupId, loaded.state, traceId), traceId } });

  try {
    const written = await storage.save(groupId, execution.nextState, loaded.etag);
    return withMeta({ status: 200, jsonBody: { ok: true, snapshot: await buildDirectSnapshot(groupId, written.state, traceId) } });
  } catch (error) {
    if (error instanceof MissingConfigError) {
      logConfigMissing('direct', traceId, error.missing);
      return withMeta(errorResponse(500, 'CONFIG_MISSING', error.message, traceId, { missing: error.missing }));
    }
    if (error instanceof ConflictError) return withMeta({ status: 409, jsonBody: { ok: false, message: 'State changed. Retry.', traceId } });
    throw error;
  }
}
