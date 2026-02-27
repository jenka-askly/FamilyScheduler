import { randomUUID } from 'node:crypto';
import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { executeActions } from '../lib/actions/executor.js';
import type { Action } from '../lib/actions/schema.js';
import { MissingConfigError } from '../lib/errors/configError.js';
import { type AppState } from '../lib/state.js';
import { getTimeSpec } from '../lib/time/timeSpec.js';
import { resolveTimeSpecWithFallback } from '../lib/time/resolveTimeSpecWithFallback.js';
import { errorResponse, logConfigMissing } from '../lib/http/errorResponse.js';
import { ConflictError, GroupNotFoundError } from '../lib/storage/storage.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
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
import { getAppointmentJsonWithEtag, putAppointmentJsonWithEtag } from '../lib/tables/appointments.js';

export type ResponseSnapshot = {
  appointments: Array<{ id: string; code: string; desc: string; schemaVersion?: number; updatedAt?: string; time: ReturnType<typeof getTimeSpec>; date: string; startTime?: string; durationMins?: number; isAllDay: boolean; people: string[]; peopleDisplay: string[]; location: string; locationRaw: string; locationDisplay: string; locationMapQuery: string; locationName: string; locationAddress: string; locationDirections: string; notes: string; scanStatus: 'pending' | 'parsed' | 'failed' | 'deleted' | null; scanImageKey: string | null; scanImageMime: string | null; scanCapturedAt: string | null }>;
  people: Array<{ personId: string; name: string; email: string; cellDisplay: string; cellE164: string; status: 'active' | 'removed'; lastSeen?: string; timezone?: string; notes?: string }>;
  rules: Array<{ code: string; schemaVersion?: number; personId: string; kind: 'available' | 'unavailable'; time: ReturnType<typeof getTimeSpec>; date: string; startTime?: string; durationMins?: number; timezone?: string; desc?: string; promptId?: string; originalPrompt?: string; startUtc?: string; endUtc?: string }>;
  historyCount?: number;
};

type DirectBody = { action?: unknown; groupId?: unknown; traceId?: unknown };

type DirectAction =
  | { type: 'create_blank_appointment' }
  | { type: 'delete_appointment'; code: string }
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
  | { type: 'get_appointment_detail'; appointmentId: string; limit?: number; cursor?: EventCursor }
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
  | { type: 'apply_suggestion'; appointmentId: string; suggestionId: string; field: 'title' | 'time' | 'location'; clientRequestId: string };

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
  const closed = events.some((event) => event.proposalId === latestProposal.proposalId && (event.type === 'FIELD_CHANGED' || event.type === 'PROPOSAL_CANCELED'));
  return closed ? null : latestProposal;
};

const deriveDateTimeParts = (start?: string, end?: string): { date: string; startTime?: string; durationMins?: number; isAllDay: boolean } => {
  if (!start || !end) return { date: start?.slice(0, 10) ?? '', isAllDay: true };
  const startDate = new Date(start); const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return { date: start.slice(0, 10), isAllDay: true };
  const durationMins = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
  return { date: start.slice(0, 10), startTime: start.match(/T(\d{2}:\d{2})/)?.[1], durationMins, isAllDay: false };
};

export const toResponseSnapshot = (state: AppState): ResponseSnapshot => ({
  appointments: state.appointments.map((appointment) => {
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
const withDirectMeta = (response: HttpResponseInit, traceId: string, context: InvocationContext, opId: string | null = null): HttpResponseInit => {
  const withVersion = withDirectVersion(response);
  const jsonBody = withVersion.jsonBody;
  const withInvocation = (!jsonBody || typeof jsonBody !== 'object' || Array.isArray(jsonBody))
    ? withVersion
    : {
        ...withVersion,
        jsonBody: {
          ...(jsonBody as Record<string, unknown>),
          invocationId: context.invocationId,
          opId
        }
      };
  return withDirectHeaders(withInvocation, traceId, context);
};
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const asString = (value: unknown): string | null => typeof value === 'string' ? value.trim() : null;
const nextPersonId = (state: AppState): string => `P-${state.people.reduce((max, person) => {
  const match = person.personId.match(/^P-(\d+)$/i);
  return match ? Math.max(max, Number(match[1])) : max;
}, 0) + 1}`;

const parseDirectAction = (value: unknown): DirectAction => {
  if (!isRecord(value)) throw new Error('action must be an object');
  const type = asString(value.type);
  if (!type) throw new Error('action.type is required');

  if (type === 'create_blank_appointment') return { type };
  if (type === 'delete_appointment') {
    const code = asString(value.code);
    if (!code) throw new Error('code is required');
    return { type, code };
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
  if (type === 'delete_person') {
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

  throw new Error(`unsupported action type: ${type}`);
};

export async function direct(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const fallbackTraceId = randomUUID();
  const body = await request.json() as DirectBody;
  const traceId = ensureTraceId(body.traceId) || fallbackTraceId;
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  if (!groupId) return withDirectMeta(errorResponse(400, 'invalid_group_id', 'groupId is required', traceId), traceId, context);

  const session = await requireSessionEmail(request, traceId, { groupId });
  if (!session.ok) return withDirectMeta(session.response, traceId, context);
  logAuth({ traceId, stage: 'gate_in', groupId, emailDomain: session.email.split('@')[1] ?? 'unknown' });

  let directAction: DirectAction;
  try {
    directAction = parseDirectAction(body.action);
  } catch (error) {
    return withDirectMeta(badRequest(error instanceof Error ? error.message : 'invalid action', traceId), traceId, context);
  }

  let storage: StorageAdapter;
  try {
    storage = createStorageAdapter();
  } catch (error) {
    if (error instanceof MissingConfigError) {
      logConfigMissing('direct', traceId, error.missing);
      return withDirectMeta(errorResponse(500, 'CONFIG_MISSING', error.message, traceId, { missing: error.missing }), traceId, context);
    }
    throw error;
  }
  let loaded;
  try {
    loaded = await storage.load(groupId);
  } catch (error) {
    if (error instanceof MissingConfigError) {
      logConfigMissing('direct', traceId, error.missing);
      return withDirectMeta(errorResponse(500, 'CONFIG_MISSING', error.message, traceId, { missing: error.missing }), traceId, context);
    }
    if (error instanceof GroupNotFoundError) return withDirectMeta(errorResponse(404, 'group_not_found', 'Group not found', traceId), traceId, context);
    throw error;
  }
  const membership = requireActiveMember(loaded.state, session.email, traceId);
  if (!membership.ok) {
    logAuth({ traceId, stage: 'gate_denied', reason: 'not_allowed' });
    return withDirectMeta(membership.response, traceId, context);
  }
  const caller = membership.member;
  logAuth({ traceId, stage: 'gate_allowed', memberId: caller.memberId });

  if (directAction.type === 'get_appointment_detail') {
    const appointment = loaded.state.appointments.find((entry) => entry.id === directAction.appointmentId);
    if (!appointment) return withDirectMeta(errorResponse(404, 'appointment_not_found', 'Appointment not found', traceId), traceId, context);

    try {
      const recent = await getRecentEvents(groupId, directAction.appointmentId, directAction.limit ?? 20, directAction.cursor);
      const appointmentDoc = await getAppointmentJsonWithEtag(groupId, directAction.appointmentId);
      const doc = appointmentDoc.doc ? expireSuggestions(ensureAppointmentDoc(appointmentDoc.doc, session.email)) : null;
      const discussionTypes = new Set(['USER_MESSAGE', 'SYSTEM_CONFIRMATION', 'PROPOSAL_CREATED', 'PROPOSAL_PAUSED', 'PROPOSAL_RESUMED', 'PROPOSAL_EDITED', 'PROPOSAL_APPLIED', 'PROPOSAL_CANCELED', 'SUGGESTION_CREATED', 'SUGGESTION_APPLIED', 'SUGGESTION_DISMISSED', 'SUGGESTION_REACTED', 'SUGGESTION_REACTION', 'CONSTRAINT_ADDED', 'CONSTRAINT_REMOVED']);
      const discussionEvents = recent.events.filter((event) => discussionTypes.has(event.type));
      const changeEvents = recent.events.filter((event) => materialEventTypes.has(event.type));
      return withDirectMeta({
        status: 200,
        jsonBody: {
          ok: true,
          appointment: toResponseSnapshot({ ...loaded.state, appointments: [appointment] }).appointments[0],
          eventsPage: recent.events,
          nextCursor: recent.nextCursor,
          projections: { discussionEvents, changeEvents },
          constraints: doc ? (doc.constraints as Record<string, unknown>) : { byMember: {} },
          suggestions: doc ? (doc.suggestions as Record<string, unknown>) : { byField: {} }
        }
      }, traceId, context);
    } catch (error) {
      context.log(JSON.stringify({ event: 'appointment_detail_failed', traceId, groupId, appointmentId: directAction.appointmentId, error: error instanceof Error ? error.message : String(error) }));
      return withDirectMeta(errorResponse(500, 'appointment_detail_failed', 'Failed to load appointment detail', traceId), traceId, context);
    }
  }

  if (directAction.type === 'append_appointment_message') {
    const appointment = loaded.state.appointments.find((entry) => entry.id === directAction.appointmentId);
    if (!appointment) return withDirectMeta(errorResponse(404, 'appointment_not_found', 'Appointment not found', traceId), traceId, context);

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
      const messageResult = await appendEvent(groupId, directAction.appointmentId, baseEvent, { idempotencyKey: directAction.clientRequestId });
      if (messageResult.appended) appendedEvents.push(messageResult.event);

      let proposal: { proposalId: string; field: 'title'; from: string; to: string } | null = null;
      const proposedTitle = detectTitleProposal(directAction.text);

      if (proposedTitle) {
        const recent = await getRecentEvents(groupId, directAction.appointmentId, 50);
        if (latestActiveTitleProposal(recent.events)) {
          return withDirectMeta(errorResponse(400, 'title_proposal_pending', 'title_proposal_pending', traceId), traceId, context);
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
        const proposalResult = await appendEvent(groupId, directAction.appointmentId, proposalEvent, { idempotencyKey: `${directAction.clientRequestId}:proposal` });
        if (proposalResult.appended) appendedEvents.push(proposalResult.event);
        proposal = { proposalId, field: 'title', from: appointment.title ?? '', to: proposedTitle };
      }

      return withDirectMeta({ status: 200, jsonBody: { ok: true, appendedEvents, proposal } }, traceId, context);
    } catch (error) {
      context.log(JSON.stringify({ event: 'append_appointment_message_failed', traceId, groupId, appointmentId: directAction.appointmentId, error: error instanceof Error ? error.message : String(error) }));
      return withDirectMeta(errorResponse(500, 'append_appointment_message_failed', 'Failed to append appointment message', traceId), traceId, context);
    }
  }

  if (directAction.type === 'apply_appointment_proposal') {
    const appointment = loaded.state.appointments.find((entry) => entry.id === directAction.appointmentId);
    if (!appointment) return withDirectMeta(errorResponse(404, 'appointment_not_found', 'Appointment not found', traceId), traceId, context);

    try {
      const alreadyApplied = await hasLatestChunkIdempotencyKey(groupId, directAction.appointmentId, directAction.clientRequestId);
      if (alreadyApplied) {
        return withDirectMeta({ status: 200, jsonBody: { ok: true, appointment: toResponseSnapshot({ ...loaded.state, appointments: [appointment] }).appointments[0], appendedEvents: [] } }, traceId, context);
      }

      if (directAction.value.length > TITLE_MAX_LENGTH) return withDirectMeta(errorResponse(400, 'invalid_title', `title must be at most ${TITLE_MAX_LENGTH} characters`, traceId), traceId, context);
      const recent = await getRecentEvents(groupId, directAction.appointmentId, 200);
      const activeProposal = latestActiveTitleProposal(recent.events);
      if (!activeProposal || activeProposal.proposalId !== directAction.proposalId) {
        return withDirectMeta(errorResponse(400, 'proposal_not_active', 'Proposal is not active', traceId), traceId, context);
      }

      const maxAttempts = 4;
      let updatedAppointmentDoc: Record<string, unknown> | null = null;
      let previousReconciliationStatus = 'unreconciled';
      let nextReconciliationStatus = 'unreconciled';
      for (let i = 0; i < maxAttempts; i += 1) {
        const current = await getAppointmentJsonWithEtag(groupId, directAction.appointmentId);
        if (!current.doc || !current.etag) return withDirectMeta(errorResponse(404, 'appointment_not_found', 'Appointment not found', traceId), traceId, context);
        const previousTitle = typeof current.doc.title === 'string' ? current.doc.title : '';
        previousReconciliationStatus = typeof (current.doc.reconciliation as Record<string, unknown> | undefined)?.status === 'string' ? String((current.doc.reconciliation as Record<string, unknown>).status) : 'unreconciled';
        const reconciled = evaluateReconciliation({ ...current.doc, title: directAction.value, updatedAt: new Date().toISOString() }, session.email);
        nextReconciliationStatus = reconciled.status;
        const nextDoc = reconciled.doc;
        const saved = await putAppointmentJsonWithEtag(groupId, directAction.appointmentId, nextDoc, current.etag);
        if (saved) {
          updatedAppointmentDoc = { ...nextDoc, _previousTitle: previousTitle };
          break;
        }
      }

      if (!updatedAppointmentDoc) return withDirectMeta(errorResponse(409, 'state_changed', 'State changed. Retry.', traceId), traceId, context);

      const stateAppointment = loaded.state.appointments.find((entry) => entry.id === directAction.appointmentId);
      if (stateAppointment) {
        stateAppointment.title = directAction.value;
        stateAppointment.updatedAt = new Date().toISOString();
      }

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
      await appendEvent(groupId, directAction.appointmentId, proposalAppliedEvent, { idempotencyKey: `${directAction.clientRequestId}:proposal-applied` });
      await appendEvent(groupId, directAction.appointmentId, changedEvent, { idempotencyKey: directAction.clientRequestId });
      await appendEvent(groupId, directAction.appointmentId, confirmEvent, { idempotencyKey: `${directAction.clientRequestId}:confirm` });

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
        await appendEvent(groupId, directAction.appointmentId, reconciliationChanged, { idempotencyKey: `${directAction.clientRequestId}:reconciliation` });
        await appendEvent(groupId, directAction.appointmentId, reconciliationConfirmation, { idempotencyKey: `${directAction.clientRequestId}:reconciliation-confirm` });
        appendedEvents.push(reconciliationChanged, reconciliationConfirmation);
      }

      return withDirectMeta({
        status: 200,
        jsonBody: {
          ok: true,
          appointment: toResponseSnapshot({ ...loaded.state, appointments: [loaded.state.appointments.find((entry) => entry.id === directAction.appointmentId) ?? appointment] }).appointments[0],
          appendedEvents,
          eventsPageHead: appendedEvents
        }
      }, traceId, context);
    } catch (error) {
      context.log(JSON.stringify({ event: 'apply_appointment_proposal_failed', traceId, groupId, appointmentId: directAction.appointmentId, error: error instanceof Error ? error.message : String(error) }));
      return withDirectMeta(errorResponse(500, 'apply_appointment_proposal_failed', 'Failed to apply proposal', traceId), traceId, context);
    }
  }

  if (directAction.type === 'pause_appointment_proposal' || directAction.type === 'resume_appointment_proposal') {
    const appointment = loaded.state.appointments.find((entry) => entry.id === directAction.appointmentId);
    if (!appointment) return withDirectMeta(errorResponse(404, 'appointment_not_found', 'Appointment not found', traceId), traceId, context);
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
      await appendEvent(groupId, directAction.appointmentId, proposalEvent, { idempotencyKey: directAction.clientRequestId });
      return withDirectMeta({ status: 200, jsonBody: { ok: true, appendedEvents: [proposalEvent] } }, traceId, context);
    } catch (error) {
      context.log(JSON.stringify({ event: 'proposal_lifecycle_failed', traceId, groupId, appointmentId: directAction.appointmentId, error: error instanceof Error ? error.message : String(error) }));
      return withDirectMeta(errorResponse(500, 'proposal_lifecycle_failed', 'Failed proposal lifecycle update', traceId), traceId, context);
    }
  }

  if (directAction.type === 'edit_appointment_proposal') {
    const appointment = loaded.state.appointments.find((entry) => entry.id === directAction.appointmentId);
    if (!appointment) return withDirectMeta(errorResponse(404, 'appointment_not_found', 'Appointment not found', traceId), traceId, context);
    try {
      const recent = await getRecentEvents(groupId, directAction.appointmentId, 200);
      const activeProposal = latestActiveTitleProposal(recent.events);
      if (!activeProposal || activeProposal.proposalId !== directAction.proposalId) return withDirectMeta(errorResponse(400, 'proposal_not_active', 'Proposal is not active', traceId), traceId, context);
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
      await appendEvent(groupId, directAction.appointmentId, editEvent, { idempotencyKey: directAction.clientRequestId });
      return withDirectMeta({ status: 200, jsonBody: { ok: true, appendedEvents: [editEvent] } }, traceId, context);
    } catch (error) {
      context.log(JSON.stringify({ event: 'edit_appointment_proposal_failed', traceId, groupId, appointmentId: directAction.appointmentId, error: error instanceof Error ? error.message : String(error) }));
      return withDirectMeta(errorResponse(500, 'edit_appointment_proposal_failed', 'Failed to edit proposal', traceId), traceId, context);
    }
  }

  if (directAction.type === 'add_constraint' || directAction.type === 'edit_constraint' || directAction.type === 'remove_constraint') {
    const appointment = loaded.state.appointments.find((entry) => entry.id === directAction.appointmentId);
    if (!appointment) return withDirectMeta(errorResponse(404, 'appointment_not_found', 'Appointment not found', traceId), traceId, context);
    if (normalizeEmail(session.email) !== directAction.memberEmail) return withDirectMeta(errorResponse(403, 'forbidden_constraint_member', 'Members can only edit their own constraints', traceId), traceId, context);
    try {
      const current = await getAppointmentJsonWithEtag(groupId, directAction.appointmentId);
      if (!current.doc || !current.etag) return withDirectMeta(errorResponse(404, 'appointment_not_found', 'Appointment not found', traceId), traceId, context);
      const beforeReconciliation = String(((current.doc.reconciliation as Record<string, unknown> | undefined)?.status) ?? 'unreconciled');
      let nextDoc = current.doc;
      const eventsToAppend: AppointmentEvent[] = [];
      if (directAction.type === 'remove_constraint') {
        const removed = removeConstraintForMember(current.doc, directAction.memberEmail, directAction.constraintId);
        if (!removed.removed) return withDirectMeta(errorResponse(404, 'constraint_not_found', 'Constraint not found', traceId), traceId, context);
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
      const saved = await putAppointmentJsonWithEtag(groupId, directAction.appointmentId, reconciled.doc, current.etag);
      if (!saved) return withDirectMeta(errorResponse(409, 'state_changed', 'State changed. Retry.', traceId), traceId, context);
      for (const event of eventsToAppend) await appendEvent(groupId, directAction.appointmentId, event, { idempotencyKey: event.clientRequestId });
      if (beforeReconciliation !== afterReconciliation) {
        const reconciliationChanged: AppointmentEvent = { id: randomUUID(), tsUtc: new Date().toISOString(), type: 'RECONCILIATION_CHANGED', actor: { kind: 'SYSTEM' }, payload: { from: beforeReconciliation, to: afterReconciliation }, clientRequestId: `${directAction.clientRequestId}:reconciliation` };
        const reconciliationConfirmation: AppointmentEvent = { id: randomUUID(), tsUtc: new Date().toISOString(), type: 'SYSTEM_CONFIRMATION', actor: { kind: 'SYSTEM' }, payload: { message: `Reconciliation status changed to ${afterReconciliation}` }, clientRequestId: `${directAction.clientRequestId}:reconciliation-confirm` };
        await appendEvent(groupId, directAction.appointmentId, reconciliationChanged, { idempotencyKey: reconciliationChanged.clientRequestId });
        await appendEvent(groupId, directAction.appointmentId, reconciliationConfirmation, { idempotencyKey: reconciliationConfirmation.clientRequestId });
        eventsToAppend.push(reconciliationChanged, reconciliationConfirmation);
      }
      return withDirectMeta({ status: 200, jsonBody: { ok: true, constraints: { byMember: { [directAction.memberEmail]: activeConstraintsForMember(reconciled.doc, directAction.memberEmail) } }, appendedEvents: eventsToAppend } }, traceId, context);
    } catch (error) {
      context.log(JSON.stringify({ event: 'constraint_action_failed', traceId, groupId, appointmentId: directAction.appointmentId, error: error instanceof Error ? error.message : String(error) }));
      return withDirectMeta(errorResponse(500, 'constraint_action_failed', 'Failed constraint action', traceId), traceId, context);
    }
  }

  if (directAction.type === 'create_suggestion' || directAction.type === 'dismiss_suggestion' || directAction.type === 'react_suggestion' || directAction.type === 'apply_suggestion') {
    const appointment = loaded.state.appointments.find((entry) => entry.id === directAction.appointmentId);
    if (!appointment) return withDirectMeta(errorResponse(404, 'appointment_not_found', 'Appointment not found', traceId), traceId, context);
    try {
      const current = await getAppointmentJsonWithEtag(groupId, directAction.appointmentId);
      if (!current.doc || !current.etag) return withDirectMeta(errorResponse(404, 'appointment_not_found', 'Appointment not found', traceId), traceId, context);
      const doc = expireSuggestions(ensureAppointmentDoc(current.doc, session.email));
      const byField = ((doc.suggestions as Record<string, unknown>).byField as Record<string, unknown>) ?? {};
      const field = directAction.type === 'create_suggestion' ? directAction.field : directAction.field;
      const list = Array.isArray(byField[field]) ? [...(byField[field] as Record<string, unknown>[])] : [];
      const now = new Date().toISOString();
      const appendedEvents: AppointmentEvent[] = [];
      const canonicalReactionType = 'SUGGESTION_REACTED';

      if (directAction.type === 'create_suggestion') {
        const activeByMemberAndField = activeSuggestionsByField(doc, directAction.field).filter((entry) => normalizeEmail(entry.proposerEmail) === normalizeEmail(session.email));
        if (activeByMemberAndField.length >= 3) return withDirectMeta(errorResponse(400, 'suggestion_limit_exceeded', 'Maximum 3 active suggestions per member per field', traceId), traceId, context);
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
        const saved = await putAppointmentJsonWithEtag(groupId, directAction.appointmentId, { ...doc, suggestions: { byField } }, current.etag);
        if (!saved) return withDirectMeta(errorResponse(409, 'state_changed', 'State changed. Retry.', traceId), traceId, context);
        const ev: AppointmentEvent = { id: randomUUID(), tsUtc: now, type: 'SUGGESTION_CREATED', actor: { kind: 'HUMAN', email: session.email }, payload: { suggestion: { ...created, conflicted } }, clientRequestId: directAction.clientRequestId };
        await appendEvent(groupId, directAction.appointmentId, ev, { idempotencyKey: directAction.clientRequestId });
        appendedEvents.push(ev);
      } else {
        const idx = list.findIndex((entry) => String(entry.id ?? '') === directAction.suggestionId);
        if (idx < 0) return withDirectMeta(errorResponse(404, 'suggestion_not_found', 'Suggestion not found', traceId), traceId, context);
        const target = list[idx] as Record<string, unknown>;
        if (directAction.type === 'dismiss_suggestion') {
          if (normalizeEmail(String(target.proposerEmail ?? '')) !== normalizeEmail(session.email)) return withDirectMeta(errorResponse(403, 'not_suggestion_proposer', 'Only proposer can dismiss suggestion', traceId), traceId, context);
          list[idx] = { ...target, active: false, status: 'dismissed', updatedAtUtc: now };
          byField[field] = list;
          const saved = await putAppointmentJsonWithEtag(groupId, directAction.appointmentId, { ...doc, suggestions: { byField } }, current.etag);
          if (!saved) return withDirectMeta(errorResponse(409, 'state_changed', 'State changed. Retry.', traceId), traceId, context);
          const ev: AppointmentEvent = { id: randomUUID(), tsUtc: now, type: 'SUGGESTION_DISMISSED', actor: { kind: 'HUMAN', email: session.email }, payload: { suggestionId: directAction.suggestionId, field }, clientRequestId: directAction.clientRequestId };
          await appendEvent(groupId, directAction.appointmentId, ev, { idempotencyKey: directAction.clientRequestId });
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
          const saved = await putAppointmentJsonWithEtag(groupId, directAction.appointmentId, { ...doc, suggestions: { byField } }, current.etag);
          if (!saved) return withDirectMeta(errorResponse(409, 'state_changed', 'State changed. Retry.', traceId), traceId, context);
          const ev: AppointmentEvent = { id: randomUUID(), tsUtc: now, type: canonicalReactionType, actor: { kind: 'HUMAN', email: session.email }, payload: { suggestionId: directAction.suggestionId, field, reaction: directAction.reaction }, clientRequestId: directAction.clientRequestId };
          await appendEvent(groupId, directAction.appointmentId, ev, { idempotencyKey: directAction.clientRequestId });
          appendedEvents.push(ev);
        }
        if (directAction.type === 'apply_suggestion') {
          const previousReconciliationStatus = String(((doc.reconciliation as Record<string, unknown>).status) ?? 'unreconciled');
          const value = String(target.value ?? '');
          list[idx] = { ...target, active: false, status: 'applied', updatedAtUtc: now };
          const nextDocRaw = { ...doc, suggestions: { byField: { ...byField, [field]: list } }, ...(field === 'title' ? { title: value } : {}), ...(field === 'location' ? { locationDisplay: value, location: value, locationRaw: value } : {}), ...(field === 'time' ? { startTime: value } : {}) };
          const reconciled = evaluateReconciliation(nextDocRaw, session.email);
          const saved = await putAppointmentJsonWithEtag(groupId, directAction.appointmentId, reconciled.doc, current.etag);
          if (!saved) return withDirectMeta(errorResponse(409, 'state_changed', 'State changed. Retry.', traceId), traceId, context);
          const suggestionApplied: AppointmentEvent = { id: randomUUID(), tsUtc: now, type: 'SUGGESTION_APPLIED', actor: { kind: 'HUMAN', email: session.email }, payload: { suggestionId: directAction.suggestionId, field, value }, clientRequestId: `${directAction.clientRequestId}:applied` };
          const fieldChanged: AppointmentEvent = { id: randomUUID(), tsUtc: now, type: 'FIELD_CHANGED', actor: { kind: 'HUMAN', email: session.email }, payload: { field, to: value }, clientRequestId: directAction.clientRequestId };
          await appendEvent(groupId, directAction.appointmentId, suggestionApplied, { idempotencyKey: suggestionApplied.clientRequestId });
          await appendEvent(groupId, directAction.appointmentId, fieldChanged, { idempotencyKey: directAction.clientRequestId });
          appendedEvents.push(suggestionApplied, fieldChanged);
          const nextReconciliationStatus = reconciled.status;
          if (previousReconciliationStatus !== nextReconciliationStatus) {
            const reconciliationChanged: AppointmentEvent = { id: randomUUID(), tsUtc: now, type: 'RECONCILIATION_CHANGED', actor: { kind: 'SYSTEM' }, payload: { from: previousReconciliationStatus, to: nextReconciliationStatus }, clientRequestId: `${directAction.clientRequestId}:reconciliation` };
            const reconciliationConfirmation: AppointmentEvent = { id: randomUUID(), tsUtc: now, type: 'SYSTEM_CONFIRMATION', actor: { kind: 'SYSTEM' }, payload: { message: `Reconciliation status changed to ${nextReconciliationStatus}` }, clientRequestId: `${directAction.clientRequestId}:reconciliation-confirm` };
            await appendEvent(groupId, directAction.appointmentId, reconciliationChanged, { idempotencyKey: reconciliationChanged.clientRequestId });
            await appendEvent(groupId, directAction.appointmentId, reconciliationConfirmation, { idempotencyKey: reconciliationConfirmation.clientRequestId });
            appendedEvents.push(reconciliationChanged, reconciliationConfirmation);
          }
        }
      }

      const latest = await getAppointmentJsonWithEtag(groupId, directAction.appointmentId);
      const finalDoc = latest.doc ? expireSuggestions(ensureAppointmentDoc(latest.doc, session.email)) : doc;
      return withDirectMeta({ status: 200, jsonBody: { ok: true, appendedEvents, suggestions: finalDoc.suggestions } }, traceId, context);
    } catch (error) {
      context.log(JSON.stringify({ event: 'suggestion_action_failed', traceId, groupId, appointmentId: directAction.appointmentId, error: error instanceof Error ? error.message : String(error) }));
      return withDirectMeta(errorResponse(500, 'suggestion_action_failed', 'Failed suggestion action', traceId), traceId, context);
    }
  }


  if (directAction.type === 'dismiss_appointment_proposal') {
    const appointment = loaded.state.appointments.find((entry) => entry.id === directAction.appointmentId);
    if (!appointment) return withDirectMeta(errorResponse(404, 'appointment_not_found', 'Appointment not found', traceId), traceId, context);
    try {
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
      await appendEvent(groupId, directAction.appointmentId, cancelEvent, { idempotencyKey: directAction.clientRequestId });
      await appendEvent(groupId, directAction.appointmentId, confirmationEvent, { idempotencyKey: `${directAction.clientRequestId}:confirm` });
      return withDirectMeta({ status: 200, jsonBody: { ok: true, appendedEvents: [cancelEvent, confirmationEvent] } }, traceId, context);
    } catch (error) {
      context.log(JSON.stringify({ event: 'dismiss_appointment_proposal_failed', traceId, groupId, appointmentId: directAction.appointmentId, error: error instanceof Error ? error.message : String(error) }));
      return withDirectMeta(errorResponse(500, 'dismiss_appointment_proposal_failed', 'Failed to dismiss proposal', traceId), traceId, context);
    }
  }

  if (directAction.type === 'resolve_appointment_time') {
    const timezone = directAction.timezone || process.env.TZ || 'America/Los_Angeles';
    const nowIso = new Date().toISOString();
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
      return withDirectMeta({
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
      }, traceId, context, opId);
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

    return withDirectMeta({
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
        nowIso
      }
    }, traceId, context, opId);
  }

  const execution = await executeActions(loaded.state, [directAction as Action], { activePersonId: caller.memberId, timezoneName: process.env.TZ ?? 'America/Los_Angeles' });
  if (directAction.type === 'create_blank_person') {
    const personId = nextPersonId(loaded.state);
    const now = new Date().toISOString();
    loaded.state.people.push({ personId, name: '', email: '', cellE164: '', cellDisplay: '', status: 'active', createdAt: now, lastSeen: now, timezone: process.env.TZ ?? 'America/Los_Angeles', notes: '' });
    try {
      const written = await storage.save(groupId, loaded.state, loaded.etag);
      return withDirectMeta({ status: 200, jsonBody: { ok: true, snapshot: toResponseSnapshot(written.state), personId } }, traceId, context);
    } catch (error) {
      if (error instanceof MissingConfigError) {
        logConfigMissing('direct', traceId, error.missing);
        return withDirectMeta(errorResponse(500, 'CONFIG_MISSING', error.message, traceId, { missing: error.missing }), traceId, context);
      }
      if (error instanceof ConflictError) return withDirectMeta({ status: 409, jsonBody: { ok: false, message: 'State changed. Retry.', traceId } }, traceId, context);
      throw error;
    }
  }

  if (directAction.type === 'update_person') {
    const person = loaded.state.people.find((entry) => entry.personId === directAction.personId);
    if (!person) return withDirectMeta(badRequest('Person not found', traceId), traceId, context);
    const nextName = directAction.name === undefined ? person.name : directAction.name.trim();
    const nextEmailRaw = directAction.email ?? person.email ?? '';
    const nextEmail = normalizeEmail(nextEmailRaw);

    if (!nextName) return withDirectMeta(badRequest('Name is required', traceId), traceId, context);
    if (!nextEmail || !isPlausibleEmail(nextEmail)) return withDirectMeta(badRequest('Invalid email', traceId), traceId, context);

    const duplicate = loaded.state.people.find((entry) => entry.status === 'active' && entry.personId !== person.personId && normalizeEmail(entry.email ?? '') === nextEmail);
    if (duplicate) return withDirectMeta(badRequest(`That email is already used by ${duplicate.name || duplicate.personId}`, traceId), traceId, context);

    person.name = nextName;
    person.email = nextEmail;
    person.lastSeen = new Date().toISOString();
    try {
      const written = await storage.save(groupId, loaded.state, loaded.etag);
      return withDirectMeta({ status: 200, jsonBody: { ok: true, snapshot: toResponseSnapshot(written.state) } }, traceId, context);
    } catch (error) {
      if (error instanceof MissingConfigError) {
        logConfigMissing('direct', traceId, error.missing);
        return withDirectMeta(errorResponse(500, 'CONFIG_MISSING', error.message, traceId, { missing: error.missing }), traceId, context);
      }
      if (error instanceof ConflictError) return withDirectMeta({ status: 409, jsonBody: { ok: false, message: 'State changed. Retry.', traceId } }, traceId, context);
      throw error;
    }
  }

  if (directAction.type === 'delete_person') {
    const person = loaded.state.people.find((entry) => entry.personId === directAction.personId);
    if (!person) return withDirectMeta(badRequest('Person not found', traceId), traceId, context);
    person.status = 'removed';
    person.lastSeen = new Date().toISOString();
    try {
      const written = await storage.save(groupId, loaded.state, loaded.etag);
      return withDirectMeta({ status: 200, jsonBody: { ok: true, snapshot: toResponseSnapshot(written.state) } }, traceId, context);
    } catch (error) {
      if (error instanceof MissingConfigError) {
        logConfigMissing('direct', traceId, error.missing);
        return withDirectMeta(errorResponse(500, 'CONFIG_MISSING', error.message, traceId, { missing: error.missing }), traceId, context);
      }
      if (error instanceof ConflictError) return withDirectMeta({ status: 409, jsonBody: { ok: false, message: 'State changed. Retry.', traceId } }, traceId, context);
      throw error;
    }
  }

  if (!execution.appliedAll) return withDirectMeta({ status: 400, jsonBody: { ok: false, message: execution.effectsTextLines[0] ?? 'Action could not be applied', traceId } }, traceId, context);

  try {
    const written = await storage.save(groupId, execution.nextState, loaded.etag);
    return withDirectMeta({ status: 200, jsonBody: { ok: true, snapshot: toResponseSnapshot(written.state) } }, traceId, context);
  } catch (error) {
    if (error instanceof MissingConfigError) {
      logConfigMissing('direct', traceId, error.missing);
      return withDirectMeta(errorResponse(500, 'CONFIG_MISSING', error.message, traceId, { missing: error.missing }), traceId, context);
    }
    if (error instanceof ConflictError) return withDirectMeta({ status: 409, jsonBody: { ok: false, message: 'State changed. Retry.', traceId } }, traceId, context);
    throw error;
  }
}
