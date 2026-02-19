import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { ConflictError } from '../lib/storage/storage.js';
import { type AppState } from '../lib/state.js';
import { executeActions } from '../lib/actions/executor.js';
import { type Action, ParsedModelResponseSchema } from '../lib/actions/schema.js';
import { parseToActions } from '../lib/openai/openaiClient.js';
import { buildContext, type ChatHistoryEntry } from '../lib/openai/buildContext.js';
import { normalizeUserText } from '../lib/text/normalize.js';
import { looksLikeSingleCodeToken, normalizeAppointmentCode, normalizeAvailabilityCode } from '../lib/text/normalizeCode.js';
import { parseFlexibleDate } from '../lib/time/parseDate.js';
import { parseTimeRange } from '../lib/time/parseTimeRange.js';
type ChatRequest = { message?: unknown };
type PendingProposal = {
  id: string;
  actions: Action[];
  expectedEtag: string;
};
type ParsedDateTime = {
  date: string;
  startTime: string;
  endTime: string;
  startIso: string;
  endIso: string;
};
type RescheduleInterpretation = {
  start: string;
  end: string;
  label: string;
  isAllDay?: boolean;
};
type ResponseSnapshot = {
  appointments: Array<{ code: string; title: string; start?: string; end?: string; assigned?: string[] }>;
  availability: Array<{ code: string; personName: string; start: string; end: string; reason?: string }>;
  historyCount?: number;
};
const toResponseSnapshot = (state: AppState): ResponseSnapshot => ({
  appointments: [...state.appointments]
    .sort((left, right) => {
      if (left.start && right.start) return left.start.localeCompare(right.start);
      if (left.start) return -1;
      if (right.start) return 1;
      return left.code.localeCompare(right.code);
    })
    .map((appointment) => ({
      code: appointment.code,
      title: appointment.title,
      start: appointment.start,
      end: appointment.end,
      assigned: appointment.assigned
    })),
  availability: [...state.availability]
    .sort((left, right) => left.start.localeCompare(right.start))
    .map((availability) => ({
      code: availability.code,
      personName: state.people.find((person) => person.id === availability.personId)?.name ?? availability.personId,
      start: availability.start,
      end: availability.end,
      reason: availability.reason
    })),
  historyCount: Array.isArray(state.history) ? state.history.length : undefined
});
const withSnapshot = <T extends Record<string, unknown>>(payload: T, state: AppState): T & { snapshot: ResponseSnapshot } => ({
  ...payload,
  snapshot: toResponseSnapshot(state)
});
const storage = createStorageAdapter();
type ClarificationMissing = 'code' | 'personName' | 'start' | 'end' | 'title' | 'action';
type PendingClarificationAction = {
  type: Action['type'];
  code?: string;
  personName?: string;
  date?: string;
  start?: string;
  end?: string;
  title?: string;
  timezone?: string;
};
type PendingClarification = {
  kind: 'action_fill';
  action: PendingClarificationAction;
  missing: ClarificationMissing[];
  candidates?: Array<{ code: string; label: string }>;
  expectedEtag?: string;
};

type SessionRuntimeState = {
  pendingProposal: PendingProposal | null;
  activePersonId: string | null;
  pendingClarification: PendingClarification | null;
  chatHistory: ChatHistoryEntry[];
};
const sessionState = new Map<string, SessionRuntimeState>();
const getSessionId = (request: HttpRequest): string => {
  const headers = (request as { headers?: { get?: (name: string) => string | null } }).headers;
  return headers?.get?.('x-session-id')?.trim() || 'default';
};
const getSessionState = (sessionId: string): SessionRuntimeState => {
  const existing = sessionState.get(sessionId);
  if (existing) return existing;
  const next: SessionRuntimeState = { pendingProposal: null, activePersonId: null, pendingClarification: null, chatHistory: [] };
  sessionState.set(sessionId, next);
  return next;
};
const trimSessionHistory = (session: SessionRuntimeState): void => {
  const max = Number(process.env.OPENAI_SESSION_HISTORY_MAX ?? '120');
  if (session.chatHistory.length > max) session.chatHistory = session.chatHistory.slice(-max);
};
const badRequest = (message: string): HttpResponseInit => ({ status: 400, jsonBody: { kind: 'error', message } });
const normalizeName = (value: string): string => value.trim().replace(/\s+/g, ' ').toLowerCase();
const parseDeleteCommand = (message: string): { code: string } | null => {
  const match = message.match(/^delete\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  const code = normalizeAppointmentCode(token) ?? normalizeAvailabilityCode(token);
  return code ? { code } : null;
};
const parseUpdateTitleCommand = (message: string): { code: string; title: string } | null => {
  const match = message.match(/^update\s+([^\s]+(?:\s+\d+)?)\s+title\s*(.*)$/i);
  if (!match) return null;
  const code = normalizeAppointmentCode(match[1]);
  return code ? { code, title: match[2].trim() } : null;
};
const parseAddAppointmentCommand = (message: string): { title: string } | null => {
  const match = message.match(/^add\s+appt\s+(.+)$/i);
  return match ? { title: match[1].trim() } : null;
};
const parseIAmCommand = (message: string): { name: string } | null => {
  const match = message.match(/^i\s+am\s+(.+)$/i);
  return match ? { name: match[1].trim() } : null;
};
const parseBareNameCommand = (message: string): { name: string } | null => {
  const match = message.match(/^[a-z][a-z\s'-]*$/i);
  if (!match) return null;
  return { name: message.trim().replace(/\s+/g, ' ') };
};
const parse12HourTime = (value: string): string | null => {
  const match = value.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/i);
  if (!match) return null;
  const hourValue = Number(match[1]);
  const minuteValue = Number(match[2] ?? '0');
  if (hourValue < 1 || hourValue > 12 || minuteValue < 0 || minuteValue > 59) return null;
  let hours24 = hourValue % 12;
  if (match[3].toLowerCase() === 'pm') hours24 += 12;
  return `${hours24.toString().padStart(2, '0')}:${minuteValue.toString().padStart(2, '0')}`;
};
const parse24HourTime = (value: string): string | null => {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hourValue = Number(match[1]);
  const minuteValue = Number(match[2]);
  if (hourValue < 0 || hourValue > 23 || minuteValue < 0 || minuteValue > 59) return null;
  return `${hourValue.toString().padStart(2, '0')}:${match[2]}`;
};
const parseTimeToken = (value: string): string | null => parse24HourTime(value) ?? parse12HourTime(value);
const toIsoString = (date: string, time: string): string => `${date}T${time}:00-08:00`;
const toPacificIsoString = (date: string, time: string): string => `${date}T${time}:00-08:00`;
const TIME_OF_DAY_RANGES: Record<string, { start: string; end: string }> = {
  morning: { start: '09:00', end: '12:00' },
  afternoon: { start: '13:00', end: '17:00' },
  evening: { start: '17:00', end: '21:00' }
};
const parseFlexibleDateWithOptionalYear = (input: string): string | null => {
  const direct = parseFlexibleDate(input);
  if (direct) return direct;
  const monthDayMatch = input.trim().match(/^([a-zA-Z]+)\s+(\d{1,2})$/);
  if (!monthDayMatch) return null;
  const now = new Date();
  const candidateThisYear = parseFlexibleDate(`${monthDayMatch[1]} ${monthDayMatch[2]} ${now.getUTCFullYear()}`);
  if (!candidateThisYear) return null;
  if (candidateThisYear >= now.toISOString().slice(0, 10)) return candidateThisYear;
  return parseFlexibleDate(`${monthDayMatch[1]} ${monthDayMatch[2]} ${now.getUTCFullYear() + 1}`);
};
const parseRescheduleCommand = (message: string): { code: string; interpretation?: RescheduleInterpretation; date?: string } | null => {
  const match = message.match(/^(?:change|update)\s+([^\s]+(?:\s+\d+)?)\s+to\s+(.+)$/i);
  if (!match) return null;
  const code = normalizeAppointmentCode(match[1]);
  if (!code) return null;
  const tail = match[2].trim().replace(/\s+/g, ' ');
  const tailLower = tail.toLowerCase();
  for (const [label, range] of Object.entries(TIME_OF_DAY_RANGES)) {
    if (tailLower.endsWith(` ${label}`)) {
      const datePart = tail.slice(0, -(label.length + 1)).trim();
      const date = parseFlexibleDateWithOptionalYear(datePart);
      if (!date) return null;
      return {
        code,
        interpretation: {
          start: toPacificIsoString(date, range.start),
          end: toPacificIsoString(date, range.end),
          label: `${date} ${label} (${range.start}–${range.end})`
        }
      };
    }
  }
  const dateOnly = parseFlexibleDateWithOptionalYear(tail);
  if (!dateOnly) return null;
  return { code, date: dateOnly };
};
const parseDateAndRange = (dateToken: string, rangeToken: string): ParsedDateTime | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateToken)) return null;
  const [rawStart, rawEnd] = rangeToken.split('-');
  if (!rawStart || !rawEnd) return null;
  const startTime = parseTimeToken(rawStart.toLowerCase());
  const endTime = parseTimeToken(rawEnd.toLowerCase());
  if (!startTime || !endTime) return null;
  const startIso = toIsoString(dateToken, startTime);
  const endIso = toIsoString(dateToken, endTime);
  if (new Date(startIso) >= new Date(endIso)) return null;
  return { date: dateToken, startTime, endTime, startIso, endIso };
};
const parseMarkUnavailableCommand = (message: string): { target: string; parsedDateTime: ParsedDateTime; reason?: string; isMe: boolean } | null => {
  const match = message.match(/^mark\s+(.+?)\s+unavailable\s+(\d{4}-\d{2}-\d{2})\s+([^\s]+)(?:\s+(.+))?$/i);
  if (!match) return null;
  const parsedDateTime = parseDateAndRange(match[2], match[3]);
  if (!parsedDateTime) return null;
  const target = match[1].trim();
  return { target, parsedDateTime, reason: match[4]?.trim() || undefined, isMe: normalizeName(target) === 'me' };
};
const resolveNextYearForMonth = (monthIndex: number, now: Date): number => {
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();
  return monthIndex < currentMonth ? currentYear + 1 : currentYear;
};
const parseMonthRangeQuery = (normalizedMessage: string): { month?: string; start?: string; end?: string } | null => {
  const monthTokens = [
    { tokens: ['january', 'jan'], month: 1 },
    { tokens: ['february', 'feb'], month: 2 },
    { tokens: ['march', 'mar'], month: 3 },
    { tokens: ['april', 'apr'], month: 4 },
    { tokens: ['may'], month: 5 },
    { tokens: ['june', 'jun'], month: 6 },
    { tokens: ['july', 'jul'], month: 7 },
    { tokens: ['august', 'aug'], month: 8 },
    { tokens: ['september', 'sep', 'sept'], month: 9 },
    { tokens: ['october', 'oct'], month: 10 },
    { tokens: ['november', 'nov'], month: 11 },
    { tokens: ['december', 'dec'], month: 12 }
  ];
  if (normalizedMessage.startsWith('who is available in ')) {
    const monthWithOptionalYear = normalizedMessage.slice('who is available in '.length).trim();
    const monthYearMatch = monthWithOptionalYear.match(/^([a-z]+)(?:\s+(\d{4}))?$/i);
    if (monthYearMatch) {
      const monthEntry = monthTokens.find((entry) => entry.tokens.includes(monthYearMatch[1]));
      if (!monthEntry) return null;
      const resolvedYear = monthYearMatch[2] ? Number(monthYearMatch[2]) : resolveNextYearForMonth(monthEntry.month - 1, new Date());
      return { month: `${resolvedYear}-${String(monthEntry.month).padStart(2, '0')}` };
    }
  }
  const yearMonthMatch = normalizedMessage.match(/^who\s+is\s+available\s+in\s+(\d{4}-\d{2})$/i);
  if (yearMonthMatch) return { month: yearMonthMatch[1] };
  const explicitRangeMatch = normalizedMessage.match(/^who\s+is\s+available\s+(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})$/i);
  return explicitRangeMatch ? { start: explicitRangeMatch[1], end: explicitRangeMatch[2] } : null;
};
const toProposal = (expectedEtag: string, actions: Action[]): PendingProposal => ({ id: Date.now().toString(), actions, expectedEtag });
const isMutationAction = (action: Action): boolean => ['add_appointment', 'delete_appointment', 'update_appointment_title', 'update_appointment_schedule', 'reschedule_appointment', 'add_availability', 'delete_availability', 'set_identity', 'reset_state'].includes(action.type);
const renderProposalText = (actions: Action[]): string => {
  const lines = actions.map((action, index) => {
    if (action.type === 'add_appointment') return `${index + 1}) Add appointment '${action.title}'`;
    if (action.type === 'delete_appointment') return `${index + 1}) Delete appointment ${action.code}`;
    if (action.type === 'update_appointment_title') return `${index + 1}) Update ${action.code} title to '${action.title}'`;
    if (action.type === 'update_appointment_schedule' || action.type === 'reschedule_appointment') {
      const dayHint = action.isAllDay ? ' (all day)' : '';
      return `${index + 1}) Reschedule ${action.code} to ${action.start}–${action.end}${dayHint}`;
    }
    if (action.type === 'add_availability') return `${index + 1}) Mark ${action.personName ?? 'me'} unavailable ${action.start}–${action.end}${action.reason ? ` (${action.reason})` : ''}`;
    if (action.type === 'delete_availability') return `${index + 1}) Delete availability ${action.code}`;
    if (action.type === 'set_identity') return `${index + 1}) Set identity to ${action.name}`;
    return `${index + 1}) Reset state`;
  });
  return `Please confirm you want to:\n${lines.join('\n')}\nReply 'confirm' or 'cancel'.`;
};


const renderProposalFromPreview = (state: AppState, actions: Action[], activePersonId: string | null): string => {
  const preview = executeActions(state, actions, { activePersonId, timezoneName: process.env.TZ ?? 'America/Los_Angeles' });
  const text = preview.effectsTextLines.join('\n').trim();
  return text.length > 0 ? `${text}\nReply 'confirm' or 'cancel'.` : renderProposalText(actions);
};
const createClarificationState = (action: Action | undefined): PendingClarification | null => {
  if (!action) return null;
  if (action.type === 'list_availability' && !action.personName) {
    return { kind: 'action_fill', action: { type: 'list_availability' }, missing: ['personName'] };
  }
  return null;
};
const parseClarificationCandidates = (question: string): Array<{ code: string; label: string }> => {
  const candidateMatches = [...question.matchAll(/(APPT[\s-]?\d+)/gi)];
  const candidates = candidateMatches
    .map((match) => normalizeAppointmentCode(match[1]))
    .filter((code): code is string => Boolean(code))
    .map((code) => ({ code, label: code }));
  return candidates.filter((candidate, index) => candidates.findIndex((item) => item.code === candidate.code) === index);
};
const actionTypeFromInput = (input: string): Action['type'] | null => {
  const normalized = normalizeUserText(input);
  if (normalized === 'delete') return 'delete_appointment';
  if (normalized === 'show') return 'show_appointment';
  if (normalized === 'update') return 'update_appointment_title';
  return null;
};
const toExecutableAction = (pending: PendingClarification): Action | null => {
  if (pending.action.type === 'list_availability') {
    return { type: 'list_availability', personName: typeof pending.action.personName === 'string' ? pending.action.personName : undefined };
  }
  if (pending.action.type === 'delete_appointment' && typeof pending.action.code === 'string') {
    return { type: 'delete_appointment', code: pending.action.code };
  }
  if (pending.action.type === 'delete_availability' && typeof pending.action.code === 'string') {
    return { type: 'delete_availability', code: pending.action.code };
  }
  if (pending.action.type === 'show_appointment' && typeof pending.action.code === 'string') {
    return { type: 'show_appointment', code: pending.action.code };
  }
  if (pending.action.type === 'show_availability' && typeof pending.action.code === 'string') {
    return { type: 'show_availability', code: pending.action.code };
  }
  if (pending.action.type === 'update_appointment_title' && typeof pending.action.code === 'string' && typeof pending.action.title === 'string') {
    return { type: 'update_appointment_title', code: pending.action.code, title: pending.action.title };
  }
  if ((pending.action.type === 'reschedule_appointment' || pending.action.type === 'update_appointment_schedule')
    && typeof pending.action.code === 'string'
    && typeof pending.action.start === 'string'
    && typeof pending.action.end === 'string') {
    return { type: 'reschedule_appointment', code: pending.action.code, start: pending.action.start, end: pending.action.end, timezone: pending.action.timezone };
  }
  return null;
};
const toPendingClarificationContext = (pending: PendingClarification | null): { question: string; partialAction: Action; missing: string[] } | null => {
  if (!pending) return null;
  return {
    question: renderClarificationQuestion(pending),
    partialAction: toExecutableAction(pending) ?? { type: 'help' },
    missing: [...pending.missing]
  };
};
const renderClarificationQuestion = (pending: PendingClarification): string => {
  const nextMissing = pending.missing[0];
  if (nextMissing === 'code') {
    if (pending.candidates && pending.candidates.length > 0) {
      const listed = pending.candidates.map((candidate) => candidate.code).join(' or ');
      return `Which code should I use: ${listed}? You can type formats like APPT-1 or appt1.`;
    }
    return 'Which code should I use? You can type formats like APPT-1 or appt1.';
  }
  if (nextMissing === 'personName') return 'Whose availability?';
  if (nextMissing === 'action') return 'What action do you want: delete, show, or update?';
  if (nextMissing === 'start') return 'Please provide a start date/time.';
  if (nextMissing === 'end') return 'Please provide an end date/time.';
  return 'Please provide the missing details.';
};
const getCurrentIdentityName = (state: AppState, activePersonId: string | null): string | null => {
  if (!activePersonId) return null;
  return state.people.find((person) => person.id === activePersonId)?.name ?? null;
};
const resolveAvailabilityQueries = (
  state: AppState,
  actions: Action[],
  activePersonId: string | null
): { actions: Action[]; clarification?: PendingClarification } => {
  const currentIdentity = getCurrentIdentityName(state, activePersonId);
  const resolvedActions = actions.map((action) => {
    if (action.type === 'list_availability' && !action.personName && currentIdentity) {
      return { ...action, personName: currentIdentity };
    }
    return action;
  });
  const needsPersonName = resolvedActions.some((action) => action.type === 'list_availability' && !action.personName);
  if (needsPersonName) {
    return {
      actions: resolvedActions,
      clarification: { kind: 'action_fill', action: { type: 'list_availability' }, missing: ['personName'] }
    };
  }
  return { actions: resolvedActions };
};
const fillPendingClarification = (state: AppState, clarification: PendingClarification, value: string): void => {
  const trimmedValue = value.trim();
  for (const missing of [...clarification.missing]) {
    if (missing === 'code') {
      const normalizedCode = normalizeAppointmentCode(trimmedValue) ?? normalizeAvailabilityCode(trimmedValue);
      if (!normalizedCode) return;
      clarification.action.code = normalizedCode;
      clarification.missing = clarification.missing.filter((item) => item !== 'code');
      continue;
    }
    if (missing === 'personName') {
      const matchedPerson = state.people.find((person) => normalizeName(person.name) === normalizeName(trimmedValue));
      clarification.action.personName = matchedPerson?.name ?? trimmedValue;
      clarification.missing = clarification.missing.filter((item) => item !== 'personName');
      continue;
    }
    if (missing === 'action') {
      const nextType = actionTypeFromInput(trimmedValue);
      if (!nextType) return;
      clarification.action.type = nextType;
      clarification.missing = clarification.missing.filter((item) => item !== 'action');
      continue;
    }
    return;
  }
};
const findDeleteByTitleCandidates = (message: string, state: AppState): Array<{ code: string; label: string }> => {
  const match = message.match(/^delete\s+the\s+(.+?)\s+one$/i);
  if (!match) return [];
  const titleHint = normalizeUserText(match[1]);
  return state.appointments
    .filter((appointment) => normalizeUserText(appointment.title).includes(titleHint))
    .map((appointment) => ({ code: appointment.code, label: appointment.title }));
};
export async function chat(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = crypto.randomUUID();
  const sessionId = getSessionId(request);
  const session = getSessionState(sessionId);
  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return badRequest('message is required');
  }
  if (typeof body.message !== 'string' || body.message.trim().length === 0) {
    return badRequest('message is required');
  }
  await storage.initIfMissing();
  const { state, etag } = await storage.getState();
  const message = body.message.trim();
  const normalizedMessage = normalizeUserText(message);
  session.chatHistory.push({ role: 'user', text: message, ts: new Date().toISOString() });
  trimSessionHistory(session);
  const respond = (payload: Record<string, unknown>, snapshotState: AppState = state): HttpResponseInit => {
    const assistantText = typeof payload.assistantText === 'string' ? payload.assistantText : (typeof payload.question === 'string' ? payload.question : undefined);
    if (assistantText) session.chatHistory.push({ role: 'assistant', text: assistantText, ts: new Date().toISOString() });
    trimSessionHistory(session);
    return {
      status: 200,
      jsonBody: withSnapshot({ ...payload, traceId }, snapshotState)
    };
  };
  const isShowListCommand = ['show list', 'list', 'show', 'show all', 'list all'].includes(normalizedMessage);
  if (normalizedMessage.includes('cancel')) {
    session.pendingProposal = null;
    session.pendingClarification = null;
    return respond({ kind: 'reply', assistantText: 'Cancelled.' });
  }
  if (normalizedMessage.includes('confirm')) {
    if (!session.pendingProposal) return respond({ kind: 'reply', assistantText: 'No pending change.' });
    const proposalToApply = session.pendingProposal;
    session.pendingProposal = null;
    const loaded = await storage.getState();
    if (loaded.etag !== proposalToApply.expectedEtag) {
      return respond({ kind: 'reply', assistantText: 'State changed since proposal. Please retry.' }, loaded.state);
    }
    const execution = executeActions(loaded.state, proposalToApply.actions, { activePersonId: session.activePersonId, timezoneName: process.env.TZ ?? 'America/Los_Angeles' });
    session.activePersonId = execution.nextActivePersonId;
    try {
      await storage.putState(execution.nextState, loaded.etag);
    } catch (error) {
      if (error instanceof ConflictError) {
        return respond({ kind: 'reply', assistantText: 'State changed since proposal. Please retry.' }, loaded.state);
      }
      throw error;
    }
    return respond({ kind: 'applied', assistantText: execution.effectsTextLines.join('\n') }, execution.nextState);
  }
  if (session.pendingClarification) {
    if ((session.pendingClarification.action.type === 'reschedule_appointment' || session.pendingClarification.action.type === 'update_appointment_schedule')
      && session.pendingClarification.missing.includes('start')
      && session.pendingClarification.missing.includes('end')) {
      const parsedRange = parseTimeRange(message);
      if (!parsedRange) {
        return respond({ kind: 'clarify', question: 'Please provide a time range like 9am-10am.' });
      }
      const actionDate = session.pendingClarification.action.date;
      const timezone = session.pendingClarification.action.timezone ?? 'America/Los_Angeles';
      if (!actionDate) {
        return respond({ kind: 'clarify', question: 'Please provide the missing details.' });
      }
      session.pendingClarification.action.start = `${actionDate}T${parsedRange.startHHMM}:00-08:00`;
      session.pendingClarification.action.end = `${actionDate}T${parsedRange.endHHMM}:00-08:00`;
      session.pendingClarification.action.timezone = timezone;
      session.pendingClarification.missing = session.pendingClarification.missing.filter((item) => item !== 'start' && item !== 'end');
    } else {
      fillPendingClarification(state, session.pendingClarification, message);
    }
    if (session.pendingClarification.missing.length > 0) {
      const looksCodeLike = looksLikeSingleCodeToken(message);
      if (session.pendingClarification.missing.includes('code') && !looksCodeLike) {
        return respond({ kind: 'clarify', question: renderClarificationQuestion(session.pendingClarification) });
      }
      return respond({ kind: 'clarify', question: renderClarificationQuestion(session.pendingClarification) });
    }
    const completedClarification = session.pendingClarification;
    session.pendingClarification = null;
    const completedAction = toExecutableAction(completedClarification);
    if (!completedAction) {
      return respond({ kind: 'clarify', question: 'Please provide the missing details.' });
    }
    if (isMutationAction(completedAction)) {
      const expectedEtag = completedClarification.expectedEtag ?? etag;
      session.pendingProposal = toProposal(expectedEtag, [completedAction]);
      if (completedAction.type === 'delete_appointment') {
        const label = completedClarification.candidates?.find((candidate) => candidate.code === completedAction.code)?.label;
        const targetLabel = label ? ` — ${label}` : '';
        return respond({
          kind: 'proposal',
          proposalId: session.pendingProposal.id,
          assistantText: `Please confirm you want to delete ${completedAction.code}${targetLabel}. Reply confirm/cancel.`
        });
      }
      return respond({ kind: 'proposal', proposalId: session.pendingProposal.id, assistantText: renderProposalText([completedAction]) });
    }
    const availabilityResolved = resolveAvailabilityQueries(state, [completedAction], session.activePersonId);
    if (availabilityResolved.clarification) {
      session.pendingClarification = availabilityResolved.clarification;
      return respond({ kind: 'clarify', question: renderClarificationQuestion(session.pendingClarification) });
    }
    const execution = executeActions(state, availabilityResolved.actions, { activePersonId: session.activePersonId, timezoneName: process.env.TZ ?? 'America/Los_Angeles' });
    return respond({ kind: 'reply', assistantText: execution.effectsTextLines.join('\n') });
  }
  if (isShowListCommand) {
    if (state.appointments.length > 0) {
      const execution = executeActions(state, [{ type: 'list_appointments' }], { activePersonId: session.activePersonId, timezoneName: process.env.TZ ?? 'America/Los_Angeles' });
      return respond({ kind: 'reply', assistantText: execution.effectsTextLines.join('\n') });
    }
    if (state.availability.length > 0) {
      const execution = executeActions(state, [{ type: 'list_availability' }], { activePersonId: session.activePersonId, timezoneName: process.env.TZ ?? 'America/Los_Angeles' });
      return respond({ kind: 'reply', assistantText: execution.effectsTextLines.join('\n') });
    }
    return respond({ kind: 'reply', assistantText: 'Nothing yet. Try commands: add appt <title> or mark me unavailable YYYY-MM-DD HH:MM-HH:MM <reason>.' });
  }
  if (normalizedMessage === 'reset state') {
    if ((process.env.STORAGE_MODE ?? 'local') !== 'local') {
      return respond({ kind: 'reply', assistantText: 'reset state is only supported when STORAGE_MODE=local.' });
    }
    session.pendingProposal = toProposal(etag, [{ type: 'reset_state' }]);
    return respond({
      kind: 'proposal',
      proposalId: session.pendingProposal.id,
      assistantText: `Please confirm you want to:
1) Reset state
Reply 'confirm' or 'cancel'.`
    });
  }
  const deterministicActions: Action[] = [];
  if (normalizedMessage.includes('seattle time') || normalizedMessage.includes('la time')) {
    return respond({ kind: 'reply', assistantText: 'Same Pacific timezone.' });
  }
  if (normalizedMessage.includes('pacific') || normalizedMessage.includes('seattle time') || normalizedMessage.includes('la time')) {
    return respond({ kind: 'reply', assistantText: 'Using America/Los_Angeles (Pacific).' });
  }
  const rescheduleCommand = parseRescheduleCommand(message);
  if (rescheduleCommand?.interpretation) {
    const { code, interpretation } = rescheduleCommand;
    deterministicActions.push({
      type: 'reschedule_appointment',
      code,
      start: interpretation.start,
      end: interpretation.end,
      isAllDay: interpretation.isAllDay
    });
  } else if (rescheduleCommand?.date) {
    session.pendingClarification = {
      kind: 'action_fill',
      action: { type: 'reschedule_appointment', code: rescheduleCommand.code, date: rescheduleCommand.date, start: undefined, end: undefined, timezone: process.env.TZ ?? 'America/Los_Angeles' },
      missing: ['start', 'end'],
      expectedEtag: etag
    };
    return respond({ kind: 'clarify', question: 'Please provide a time range like 9am-10am.' });
  }
  const iAmCommand = parseIAmCommand(message);
  if (iAmCommand) deterministicActions.push({ type: 'set_identity', name: iAmCommand.name });
  const addCommand = parseAddAppointmentCommand(message);
  if (addCommand) deterministicActions.push({ type: 'add_appointment', title: addCommand.title });
  const markUnavailableCommand = parseMarkUnavailableCommand(message);
  if (markUnavailableCommand) {
    deterministicActions.push({
      type: 'add_availability',
      personName: markUnavailableCommand.isMe ? undefined : markUnavailableCommand.target,
      start: markUnavailableCommand.parsedDateTime.startIso,
      end: markUnavailableCommand.parsedDateTime.endIso,
      reason: markUnavailableCommand.reason
    });
  }
  const deleteCommand = parseDeleteCommand(message);
  if (deleteCommand) {
    deterministicActions.push(deleteCommand.code.startsWith('AVL-')
      ? { type: 'delete_availability', code: deleteCommand.code }
      : { type: 'delete_appointment', code: deleteCommand.code });
  }
  if (!deleteCommand) {
    const deleteCandidates = findDeleteByTitleCandidates(message, state);
    if (deleteCandidates.length > 1) {
      session.pendingClarification = {
        kind: 'action_fill',
        action: { type: 'delete_appointment' },
        missing: ['code'],
        candidates: deleteCandidates,
        expectedEtag: etag
      };
      const listed = deleteCandidates.map((candidate) => `${candidate.code} (${candidate.label})`).join(' or ');
      return respond({ kind: 'clarify', question: `Which appointment code should I delete: ${listed}?` });
    }
  }
  const updateCommand = parseUpdateTitleCommand(message);
  if (updateCommand && updateCommand.title) deterministicActions.push({ type: 'update_appointment_title', code: updateCommand.code, title: updateCommand.title });
  if (normalizedMessage === 'list appointments' || normalizedMessage === 'show my appt' || normalizedMessage === 'show my appointments') deterministicActions.push({ type: 'list_appointments' });
  if (normalizedMessage === 'list availability') deterministicActions.push({ type: 'list_availability' });
  if (normalizedMessage === 'list my availability' || normalizedMessage === 'show my availability') deterministicActions.push({ type: 'list_availability' });
  const listForMatch = message.match(/^list\s+availability\s+for\s+(.+)$/i);
  if (listForMatch) deterministicActions.push({ type: 'list_availability', personName: listForMatch[1].trim() });
  if (normalizedMessage === 'show appointment') {
    if (state.appointments.length > 5) return respond({ kind: 'clarify', question: 'Which appointment code should I show?' });
    deterministicActions.push({ type: 'list_appointments' });
  }
  if (normalizedMessage.startsWith('show ')) {
    const rawCode = message.slice(message.toLowerCase().indexOf('show ') + 'show '.length);
    const requestedCode = normalizeAppointmentCode(rawCode) ?? normalizeAvailabilityCode(rawCode);
    if (requestedCode) {
      deterministicActions.push(requestedCode.startsWith('AVL-') ? { type: 'show_availability', code: requestedCode } : { type: 'show_appointment', code: requestedCode });
    }
  }
  const monthQuery = parseMonthRangeQuery(normalizedMessage);
  if (monthQuery) deterministicActions.push({ type: 'who_is_available', month: monthQuery.month, start: monthQuery.start, end: monthQuery.end });
  if (normalizedMessage === 'help') deterministicActions.push({ type: 'help' });
  if (deterministicActions.length > 0) {
    const mutationActions = deterministicActions.filter(isMutationAction);
    if (mutationActions.length > 0) {
      session.pendingProposal = toProposal(etag, mutationActions);
      if (mutationActions.length === 1 && (mutationActions[0].type === 'update_appointment_schedule' || mutationActions[0].type === 'reschedule_appointment')) {
        const schedule = mutationActions[0];
        const dateOnly = schedule.start.slice(0, 10);
        const allDayLabel = schedule.isAllDay ? ' (all day)' : '';
        return respond({ kind: 'proposal', proposalId: session.pendingProposal.id, assistantText: `Reschedule ${schedule.code} to ${dateOnly}${allDayLabel}. Confirm?` });
      }
      return respond({ kind: 'proposal', proposalId: session.pendingProposal.id, assistantText: renderProposalText(mutationActions) });
    }
    const availabilityResolved = resolveAvailabilityQueries(state, deterministicActions, session.activePersonId);
    if (availabilityResolved.clarification) {
      session.pendingClarification = availabilityResolved.clarification;
      return respond({ kind: 'clarify', question: renderClarificationQuestion(session.pendingClarification) });
    }
    const execution = executeActions(state, availabilityResolved.actions, { activePersonId: session.activePersonId, timezoneName: process.env.TZ ?? 'America/Los_Angeles' });
    return respond({ kind: 'reply', assistantText: execution.effectsTextLines.join('\n') });
  }
  if (parseTimeRange(message)) {
    return respond({ kind: 'clarify', question: 'What date and what are you changing?' });
  }
  if (normalizedMessage.includes('who is available')) {
    return respond({
      kind: 'clarify',
      question: "Do you mean March 2026? Reply: 'who is available in 2026-03' or 'who is available in march 2026'."
    });
  }
  if (/^mark\s+\d{1,2}\s+\d{4}$/.test(normalizedMessage)) {
    return respond({ kind: 'clarify', question: 'Did you mean a month name like Mar 9 2026? Please spell the month.' });
  }
  const openaiEnabled = (process.env.OPENAI_PARSER_ENABLED ?? 'false').toLowerCase() === 'true';
  if (!openaiEnabled) {
    return respond({ kind: 'reply', assistantText: 'Natural language parsing is disabled. Try commands: help' });
  }
  try {
    const parsed = ParsedModelResponseSchema.parse(await parseToActions(message, buildContext({
      state,
      identityName: getCurrentIdentityName(state, session.activePersonId),
      pendingProposal: session.pendingProposal ? { summary: renderProposalText(session.pendingProposal.actions), actions: session.pendingProposal.actions } : null,
      pendingClarification: toPendingClarificationContext(session.pendingClarification),
      history: session.chatHistory
    })));
    console.info(JSON.stringify({ traceId, openaiUsed: true, model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini', responseKind: parsed.kind }));
    const confidenceThreshold = Number(process.env.OPENAI_CONFIDENCE_THRESHOLD ?? '0.6');
    if (typeof parsed.confidence === 'number' && parsed.confidence < confidenceThreshold) {
      return respond({ kind: 'clarify', question: 'Please clarify with explicit code/date/time so I can apply this safely.' });
    }
    if (parsed.kind === 'clarify') {
      const question = parsed.clarificationQuestion ?? 'Could you clarify?';
      const actionClarification = createClarificationState(parsed.actions[0]);
      const candidates = parseClarificationCandidates(question);
      if (actionClarification) {
        session.pendingClarification = actionClarification;
      } else if (/which appointment code should i delete/i.test(question) && candidates.length > 0) {
        session.pendingClarification = {
          kind: 'action_fill',
          action: { type: 'delete_appointment' },
          missing: ['code'],
          candidates,
          expectedEtag: etag
        };
      }
      return respond({ kind: 'clarify', question: parsed.clarificationQuestion ?? 'Could you clarify?' });
    }
    if (parsed.kind === 'query') {
      const availabilityResolved = resolveAvailabilityQueries(state, parsed.actions, session.activePersonId);
      if (availabilityResolved.clarification) {
        session.pendingClarification = availabilityResolved.clarification;
        return respond({ kind: 'clarify', question: renderClarificationQuestion(session.pendingClarification) });
      }
      const execution = executeActions(state, availabilityResolved.actions, { activePersonId: session.activePersonId, timezoneName: process.env.TZ ?? 'America/Los_Angeles' });
      return respond({ kind: 'reply', assistantText: execution.effectsTextLines.join('\n') });
    }
    const mutationActions = parsed.actions.filter(isMutationAction);
    const bareNameCommand = parseBareNameCommand(message);
    if (bareNameCommand && mutationActions.length === 1 && mutationActions[0].type === 'set_identity') {
      return respond({ kind: 'reply', assistantText: "If you want to set identity, reply like: 'I am Joe'." });
    }
    session.pendingProposal = toProposal(etag, mutationActions);
    return respond({ kind: 'proposal', proposalId: session.pendingProposal.id, assistantText: renderProposalFromPreview(state, mutationActions, session.activePersonId) });
  } catch (error) {
    console.warn(JSON.stringify({ traceId, openaiUsed: true, validationFailure: true, message: error instanceof Error ? error.message : 'unknown' }));
    return respond({ kind: 'clarify', question: 'I could not safely parse that. Please provide explicit codes and dates.' });
  }
}
