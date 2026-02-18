import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { ConflictError } from '../lib/storage/storage.js';
import { type AppState } from '../lib/state.js';
import { executeActions } from '../lib/actions/executor.js';
import { type Action, ParsedModelResponseSchema } from '../lib/actions/schema.js';
import { parseToActions } from '../lib/openai/openaiClient.js';
import { normalizeUserText } from '../lib/text/normalize.js';

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

const storage = createStorageAdapter();
let pendingProposal: PendingProposal | null = null;
let activePersonId: string | null = null;
let pendingClarification: null | {
  intent: string;
  missing: string;
  partialAction: Action;
} = null;

const badRequest = (message: string): HttpResponseInit => ({ status: 400, jsonBody: { kind: 'error', message } });
const normalizeCode = (value: string): string => value.trim().toUpperCase();
const normalizeName = (value: string): string => value.trim().replace(/\s+/g, ' ').toLowerCase();

const parseDeleteCommand = (message: string): { code: string } | null => {
  const match = message.match(/^delete\s+([a-z]+-[a-z0-9-]+)$/i);
  return match ? { code: normalizeCode(match[1]) } : null;
};
const parseUpdateTitleCommand = (message: string): { code: string; title: string } | null => {
  const match = message.match(/^update\s+(appt-\d+)\s+title\s*(.*)$/i);
  return match ? { code: normalizeCode(match[1]), title: match[2].trim() } : null;
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
const isMutationAction = (action: Action): boolean => ['add_appointment', 'delete_appointment', 'update_appointment_title', 'add_availability', 'delete_availability', 'set_identity', 'reset_state'].includes(action.type);

const renderProposalText = (actions: Action[]): string => {
  const lines = actions.map((action, index) => {
    if (action.type === 'add_appointment') return `${index + 1}) Add appointment '${action.title}'`;
    if (action.type === 'delete_appointment') return `${index + 1}) Delete appointment ${action.code}`;
    if (action.type === 'update_appointment_title') return `${index + 1}) Update ${action.code} title to '${action.title}'`;
    if (action.type === 'add_availability') return `${index + 1}) Mark ${action.personName ?? 'me'} unavailable ${action.start}–${action.end}${action.reason ? ` (${action.reason})` : ''}`;
    if (action.type === 'delete_availability') return `${index + 1}) Delete availability ${action.code}`;
    if (action.type === 'set_identity') return `${index + 1}) Set identity to ${action.name}`;
    return `${index + 1}) Reset state`;
  });
  return `Please confirm you want to:\n${lines.join('\n')}\nReply 'confirm' or 'cancel'.`;
};

const buildOpenAiContext = (state: AppState) => ({
  peopleNames: state.people.map((person) => person.name).slice(0, 30),
  appointmentsSummary: state.appointments.slice(0, 40).map((item) => `${item.code}: ${item.title}`),
  availabilitySummary: state.availability.slice(0, 60).map((item) => `${item.code}: ${item.start} to ${item.end}`),
  timezoneName: process.env.TZ ?? 'America/Los_Angeles'
});

const createClarificationState = (action: Action | undefined): typeof pendingClarification => {
  if (!action) return null;

  if (action.type === 'list_availability' && !action.personName) {
    return { intent: action.type, missing: 'personName', partialAction: { type: 'list_availability' } };
  }

  return null;
};

const fillPendingClarification = (
  clarification: NonNullable<typeof pendingClarification>,
  value: string
): Action | null => {
  if (clarification.intent === 'list_availability' && clarification.missing === 'personName') {
    return { ...(clarification.partialAction as Extract<Action, { type: 'list_availability' }>), personName: value.trim() };
  }

  return null;
};

export async function chat(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = crypto.randomUUID();
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

  if (normalizedMessage === 'cancel') {
    pendingProposal = null;
    pendingClarification = null;
    return { status: 200, jsonBody: { kind: 'reply', assistantText: 'Cancelled.', traceId } };
  }

  if (pendingClarification) {
    const action = fillPendingClarification(pendingClarification, message);
    pendingClarification = null;
    if (action) {
      const execution = executeActions(state, [action], { activePersonId, timezoneName: process.env.TZ ?? 'America/Los_Angeles' });
      return { status: 200, jsonBody: { kind: 'reply', assistantText: execution.effectsTextLines.join('\n'), traceId } };
    }
  }

  if (normalizedMessage === 'confirm') {
    if (!pendingProposal) return { status: 200, jsonBody: { kind: 'reply', assistantText: 'No pending change.', traceId } };
    const proposalToApply = pendingProposal;
    pendingProposal = null;
    const loaded = await storage.getState();
    if (loaded.etag !== proposalToApply.expectedEtag) {
      return { status: 200, jsonBody: { kind: 'reply', assistantText: 'State changed since proposal. Please retry.', traceId } };
    }

    const execution = executeActions(loaded.state, proposalToApply.actions, { activePersonId, timezoneName: process.env.TZ ?? 'America/Los_Angeles' });
    activePersonId = execution.nextActivePersonId;

    try {
      await storage.putState(execution.nextState, loaded.etag);
    } catch (error) {
      if (error instanceof ConflictError) {
        return { status: 200, jsonBody: { kind: 'reply', assistantText: 'State changed since proposal. Please retry.', traceId } };
      }
      throw error;
    }

    return { status: 200, jsonBody: { kind: 'applied', assistantText: execution.effectsTextLines.join('\n'), traceId } };
  }

  if (normalizedMessage === 'reset state') {
    if ((process.env.STORAGE_MODE ?? 'local') !== 'local') {
      return { status: 200, jsonBody: { kind: 'reply', assistantText: 'reset state is only supported when STORAGE_MODE=local.', traceId } };
    }

    pendingProposal = toProposal(etag, [{ type: 'reset_state' }]);
    return { status: 200, jsonBody: { kind: 'proposal', proposalId: pendingProposal.id, assistantText: `Please confirm you want to:
1) Reset state
Reply 'confirm' or 'cancel'.`, traceId } };
  }

  const deterministicActions: Action[] = [];
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

  const deleteCommand = parseDeleteCommand(normalizedMessage);
  if (deleteCommand) {
    deterministicActions.push(deleteCommand.code.startsWith('AVL-')
      ? { type: 'delete_availability', code: deleteCommand.code }
      : { type: 'delete_appointment', code: deleteCommand.code });
  }

  const updateCommand = parseUpdateTitleCommand(message);
  if (updateCommand && updateCommand.title) deterministicActions.push({ type: 'update_appointment_title', code: updateCommand.code, title: updateCommand.title });

  if (normalizedMessage === 'list appointments') deterministicActions.push({ type: 'list_appointments' });
  if (normalizedMessage === 'list availability') deterministicActions.push({ type: 'list_availability' });
  if (normalizedMessage === 'list my availability') {
    pendingClarification = { intent: 'list_availability', missing: 'personName', partialAction: { type: 'list_availability' } };
    return { status: 200, jsonBody: { kind: 'clarify', question: 'Whose availability?', traceId } };
  }
  const listForMatch = message.match(/^list\s+availability\s+for\s+(.+)$/i);
  if (listForMatch) deterministicActions.push({ type: 'list_availability', personName: listForMatch[1].trim() });

  if (normalizedMessage.startsWith('show ')) {
    const requestedCode = normalizeCode(normalizedMessage.slice('show '.length));
    deterministicActions.push(requestedCode.startsWith('AVL-') ? { type: 'show_availability', code: requestedCode } : { type: 'show_appointment', code: requestedCode });
  }

  const monthQuery = parseMonthRangeQuery(normalizedMessage);
  if (monthQuery) deterministicActions.push({ type: 'who_is_available', month: monthQuery.month, start: monthQuery.start, end: monthQuery.end });
  if (normalizedMessage === 'help') deterministicActions.push({ type: 'help' });

  if (deterministicActions.length > 0) {
    const mutationActions = deterministicActions.filter(isMutationAction);
    if (mutationActions.length === 1 && mutationActions[0].type === 'set_identity') {
      const execution = executeActions(state, mutationActions, { activePersonId, timezoneName: process.env.TZ ?? 'America/Los_Angeles' });
      activePersonId = execution.nextActivePersonId;
      await storage.putState(execution.nextState, etag);
      return { status: 200, jsonBody: { kind: 'reply', assistantText: execution.effectsTextLines.join('\n'), traceId } };
    }

    if (mutationActions.length > 0) {
      pendingProposal = toProposal(etag, mutationActions);
      return { status: 200, jsonBody: { kind: 'proposal', proposalId: pendingProposal.id, assistantText: renderProposalText(mutationActions), traceId } };
    }

    const execution = executeActions(state, deterministicActions, { activePersonId, timezoneName: process.env.TZ ?? 'America/Los_Angeles' });
    return { status: 200, jsonBody: { kind: 'reply', assistantText: execution.effectsTextLines.join('\n'), traceId } };
  }

  if (normalizedMessage.includes('who is available')) {
    return {
      status: 200,
      jsonBody: {
        kind: 'clarify',
        question: "Do you mean March 2026? Reply: 'who is available in 2026-03' or 'who is available in march 2026'.",
        traceId
      }
    };
  }

  const openaiEnabled = (process.env.OPENAI_PARSER_ENABLED ?? 'false').toLowerCase() === 'true';
  if (!openaiEnabled) {
    return { status: 200, jsonBody: { kind: 'reply', assistantText: 'Natural language parsing is disabled. Try commands: help', traceId } };
  }

  try {
    const parsed = ParsedModelResponseSchema.parse(await parseToActions(message, buildOpenAiContext(state)));
    console.info(JSON.stringify({ traceId, openaiUsed: true, model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini', responseKind: parsed.kind }));

    if (parsed.kind === 'clarify') {
      pendingClarification = createClarificationState(parsed.actions[0]);
      return { status: 200, jsonBody: { kind: 'clarify', question: parsed.clarificationQuestion ?? 'Could you clarify?', traceId } };
    }

    if (parsed.kind === 'query') {
      const execution = executeActions(state, parsed.actions, { activePersonId, timezoneName: process.env.TZ ?? 'America/Los_Angeles' });
      return { status: 200, jsonBody: { kind: 'reply', assistantText: execution.effectsTextLines.join('\n'), traceId } };
    }

    const mutationActions = parsed.actions.filter(isMutationAction);
    const bareNameCommand = parseBareNameCommand(message);
    if (bareNameCommand && mutationActions.length === 1 && mutationActions[0].type === 'set_identity') {
      return { status: 200, jsonBody: { kind: 'reply', assistantText: "If you want to set identity, reply like: 'I am Joe'.", traceId } };
    }
    const setIdentityOnly = mutationActions.length > 0 && mutationActions.every((action) => action.type === 'set_identity');
    if (setIdentityOnly) {
      const execution = executeActions(state, mutationActions, { activePersonId, timezoneName: process.env.TZ ?? 'America/Los_Angeles' });
      activePersonId = execution.nextActivePersonId;
      await storage.putState(execution.nextState, etag);
      return { status: 200, jsonBody: { kind: 'reply', assistantText: execution.effectsTextLines.join('\n'), traceId } };
    }

    pendingProposal = toProposal(etag, mutationActions);
    return { status: 200, jsonBody: { kind: 'proposal', proposalId: pendingProposal.id, assistantText: renderProposalText(mutationActions), traceId } };
  } catch (error) {
    console.warn(JSON.stringify({ traceId, openaiUsed: true, validationFailure: true, message: error instanceof Error ? error.message : 'unknown' }));
    return { status: 200, jsonBody: { kind: 'clarify', question: 'I could not safely parse that. Please provide explicit codes and dates.', traceId } };
  }
}
