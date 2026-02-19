import { createHash, randomUUID } from 'node:crypto';
import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { type Action, ParsedModelResponseSchema } from '../lib/actions/schema.js';
import { executeActions } from '../lib/actions/executor.js';
import { buildContext, type ChatHistoryEntry } from '../lib/openai/buildContext.js';
import { parseToActions } from '../lib/openai/openaiClient.js';
import { type AppState } from '../lib/state.js';
import { ConflictError } from '../lib/storage/storage.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { normalizeUserText } from '../lib/text/normalize.js';
import { normalizeAppointmentCode, normalizeAvailabilityCode } from '../lib/text/normalizeCode.js';

type ChatRequest = { message?: unknown };
type PendingProposal = { id: string; expectedEtag: string; actions: Action[] };
type PendingClarification = { question: string };
type SessionRuntimeState = {
  pendingProposal: PendingProposal | null;
  pendingClarification: PendingClarification | null;
  activePersonId: string | null;
  chatHistory: ChatHistoryEntry[];
};

type ResponseSnapshot = {
  appointments: Array<{ code: string; desc: string; date: string; startTime?: string; durationMins?: number; isAllDay: boolean; people: string[]; location: string }>;
  availability: Array<{ code: string; personName: string; desc: string; date: string; startTime?: string; durationMins?: number; isAllDay: boolean }>;
  historyCount?: number;
};

const storage = createStorageAdapter();
const sessionState = new Map<string, SessionRuntimeState>();
const confirmSynonyms = new Set(['confirm', 'yes', 'y', 'ok']);
const cancelSynonyms = new Set(['cancel', 'no', 'n']);

const getSessionId = (request: HttpRequest): string => {
  const headers = (request as { headers?: { get?: (name: string) => string | null } }).headers;
  return headers?.get?.('x-session-id')?.trim() || 'default';
};

const getSessionState = (sessionId: string): SessionRuntimeState => {
  const existing = sessionState.get(sessionId);
  if (existing) return existing;
  const created: SessionRuntimeState = { pendingProposal: null, pendingClarification: null, activePersonId: null, chatHistory: [] };
  sessionState.set(sessionId, created);
  return created;
};

const trimHistory = (session: SessionRuntimeState): void => {
  const max = Number(process.env.OPENAI_SESSION_HISTORY_MAX ?? '120');
  if (session.chatHistory.length > max) session.chatHistory = session.chatHistory.slice(-max);
};

const deriveDateTimeParts = (start?: string, end?: string): { date: string; startTime?: string; durationMins?: number; isAllDay: boolean } => {
  if (!start || !end) return { date: start?.slice(0, 10) ?? '', isAllDay: true };
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return { date: start.slice(0, 10), isAllDay: true };
  const durationMins = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
  return {
    date: start.slice(0, 10),
    startTime: start.match(/T(\d{2}:\d{2})/)?.[1],
    durationMins,
    isAllDay: false
  };
};

const toResponseSnapshot = (state: AppState): ResponseSnapshot => ({
  appointments: [...state.appointments].map((appointment) => {
    const derived = deriveDateTimeParts(appointment.start, appointment.end);
    return {
      code: appointment.code,
      desc: appointment.title,
      date: appointment.date ?? derived.date,
      startTime: appointment.startTime ?? derived.startTime,
      durationMins: appointment.durationMins ?? derived.durationMins,
      isAllDay: appointment.isAllDay ?? derived.isAllDay,
      people: appointment.people ?? [],
      location: appointment.location ?? ''
    };
  }),
  availability: [...state.availability].map((availability) => {
    const derived = deriveDateTimeParts(availability.start, availability.end);
    return {
      code: availability.code,
      personName: state.people.find((person) => person.id === availability.personId)?.name ?? availability.personId,
      desc: availability.reason ?? '',
      date: availability.date ?? derived.date,
      startTime: availability.startTime ?? derived.startTime,
      durationMins: availability.durationMins ?? derived.durationMins,
      isAllDay: availability.isAllDay ?? derived.isAllDay
    };
  }),
  historyCount: Array.isArray(state.history) ? state.history.length : undefined
});

const withSnapshot = <T extends Record<string, unknown>>(payload: T, state: AppState): T & { snapshot: ResponseSnapshot } => ({ ...payload, snapshot: toResponseSnapshot(state) });

const badRequest = (message: string, traceId: string): HttpResponseInit => ({ status: 400, jsonBody: { kind: 'error', message, traceId } });
const toProposal = (expectedEtag: string, actions: Action[]): PendingProposal => ({ id: Date.now().toString(), expectedEtag, actions });

const isMutationAction = (action: Action): boolean => ['add_appointment', 'delete_appointment', 'update_appointment_desc', 'reschedule_appointment', 'add_people_to_appointment', 'remove_people_from_appointment', 'replace_people_on_appointment', 'clear_people_on_appointment', 'set_appointment_location', 'add_availability', 'delete_availability', 'set_identity', 'reset_state'].includes(action.type);

const normalizeActionCodes = (actions: Action[]): Action[] => actions.map((action) => {
  if ('code' in action && typeof action.code === 'string') {
    const code = normalizeAppointmentCode(action.code) ?? normalizeAvailabilityCode(action.code) ?? action.code;
    return { ...action, code } as Action;
  }
  return action;
});

const validateReferencedCodes = (state: AppState, actions: Action[]): string | null => {
  for (const action of actions) {
    if (!('code' in action) || typeof action.code !== 'string') continue;
    const code = action.code;
    if (code.startsWith('APPT-') && !state.appointments.some((item) => item.code.toUpperCase() === code.toUpperCase())) {
      return `I cannot find ${code}. Which appointment code should I use?`;
    }
    if (code.startsWith('AVL-') && !state.availability.some((item) => item.code.toUpperCase() === code.toUpperCase())) {
      return `I cannot find ${code}. Which availability code should I use?`;
    }
  }
  return null;
};

const getIdentityName = (state: AppState, activePersonId: string | null): string | null => {
  if (!activePersonId) return null;
  return state.people.find((person) => person.id === activePersonId)?.name ?? null;
};

const parseWithOpenAi = async (params: { message: string; state: AppState; session: SessionRuntimeState; sessionId: string; traceId: string }): Promise<ReturnType<typeof ParsedModelResponseSchema.parse>> => {
  const contextEnvelope = buildContext({
    state: params.state,
    identityName: getIdentityName(params.state, params.session.activePersonId),
    pendingProposal: params.session.pendingProposal ? { summary: 'Pending proposal', actions: params.session.pendingProposal.actions } : null,
    pendingClarification: params.session.pendingClarification ? { question: params.session.pendingClarification.question, partialAction: { type: 'help' }, missing: ['action'] } : null,
    history: params.session.chatHistory
  });
  console.info(JSON.stringify({ traceId: params.traceId, stage: 'openai_context_envelope', contextEnvelope }));
  const rawModel = await parseToActions(params.message, contextEnvelope, {
    traceId: params.traceId,
    sessionIdHash: createHash('sha256').update(params.sessionId).digest('hex').slice(0, 16)
  });
  return ParsedModelResponseSchema.parse(rawModel);
};

export async function chat(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = randomUUID();
  await storage.initIfMissing();

  const body = await request.json() as ChatRequest;
  if (typeof body.message !== 'string' || body.message.trim().length === 0) return badRequest('message is required', traceId);
  const message = body.message.trim();
  const normalized = normalizeUserText(message);

  const sessionId = getSessionId(request);
  const session = getSessionState(sessionId);
  const loaded = await storage.getState();
  const state = loaded.state;
  const etag = loaded.etag;

  session.chatHistory.push({ role: 'user', text: message, ts: new Date().toISOString() });
  trimHistory(session);

  const respond = (payload: { kind: 'reply'; assistantText: string } | { kind: 'clarify'; question: string } | { kind: 'proposal'; proposalId: string; assistantText: string } | { kind: 'applied'; assistantText: string }): HttpResponseInit => {
    const assistantText = payload.kind === 'clarify' ? payload.question : payload.assistantText;
    session.chatHistory.push({ role: 'assistant', text: assistantText, ts: new Date().toISOString() });
    trimHistory(session);
    return { status: 200, jsonBody: withSnapshot(payload, state) };
  };

  if (session.pendingProposal) {
    if (confirmSynonyms.has(normalized)) {
      try {
        const execution = executeActions(state, session.pendingProposal.actions, { activePersonId: session.activePersonId, timezoneName: process.env.TZ ?? 'America/Los_Angeles' });
        const written = await storage.putState(execution.nextState, session.pendingProposal.expectedEtag);
        session.activePersonId = execution.nextActivePersonId;
        session.pendingProposal = null;
        return { status: 200, jsonBody: withSnapshot({ kind: 'applied', assistantText: execution.effectsTextLines.join('\n') }, written.state) };
      } catch (error) {
        if (error instanceof ConflictError) return { status: 409, jsonBody: { kind: 'error', message: 'State changed. Retry.', traceId } };
        throw error;
      }
    }
    if (cancelSynonyms.has(normalized)) {
      session.pendingProposal = null;
      session.pendingClarification = null;
      return respond({ kind: 'reply', assistantText: 'Cancelled.' });
    }
    return respond({ kind: 'clarify', question: 'Please confirm or cancel.' });
  }

  if (confirmSynonyms.has(normalized)) return respond({ kind: 'clarify', question: 'What should I confirm?' });
  if (cancelSynonyms.has(normalized)) return respond({ kind: 'reply', assistantText: 'Nothing to cancel.' });

  if (normalized === 'help') {
    return respond({ kind: 'reply', assistantText: 'Try commands: add appt <desc> <date>, list appointments, list availability, show <CODE>, delete <CODE>.' });
  }
  if (normalized.startsWith('passkey') || normalized === 'session init') {
    return respond({ kind: 'reply', assistantText: 'Session ready.' });
  }

  try {
    const parsed = await parseWithOpenAi({ message, state, session, sessionId, traceId });
    if (typeof parsed.confidence === 'number' && parsed.confidence < Number(process.env.OPENAI_CONFIDENCE_THRESHOLD ?? '0.6')) {
      return respond({ kind: 'clarify', question: 'Please clarify with explicit code/date/time so I can apply this safely.' });
    }

    const normalizedActions = normalizeActionCodes(parsed.actions ?? []);
    const codeError = validateReferencedCodes(state, normalizedActions);
    if (codeError) {
      console.warn(JSON.stringify({ traceId, stage: 'post_processor', validationError: codeError }));
      session.pendingClarification = { question: codeError };
      return respond({ kind: 'clarify', question: codeError });
    }

    if (parsed.kind === 'clarify') {
      session.pendingClarification = { question: parsed.message };
      return respond({ kind: 'clarify', question: parsed.message });
    }

    if (parsed.kind === 'proposal') {
      const mutationActions = normalizedActions.filter(isMutationAction);
      if (mutationActions.length === 0 || parsed.message.trim().length === 0) {
        const question = 'Please clarify the change with a valid action and summary.';
        console.warn(JSON.stringify({ traceId, stage: 'post_processor', validationError: question }));
        session.pendingClarification = { question };
        return respond({ kind: 'clarify', question });
      }
      session.pendingClarification = null;
      session.pendingProposal = toProposal(etag, mutationActions);
      return respond({ kind: 'proposal', proposalId: session.pendingProposal.id, assistantText: parsed.message });
    }

    session.pendingClarification = null;
    if (normalizedActions.length > 0) {
      const execution = executeActions(state, normalizedActions, { activePersonId: session.activePersonId, timezoneName: process.env.TZ ?? 'America/Los_Angeles' });
      return respond({ kind: 'reply', assistantText: execution.effectsTextLines.join('\n') || parsed.message });
    }
    return respond({ kind: 'reply', assistantText: parsed.message });
  } catch (error) {
    console.warn(JSON.stringify({ traceId, stage: 'openai_parse_failure', error: error instanceof Error ? error.message : 'unknown' }));
    session.pendingClarification = { question: 'I could not safely parse that. Please provide explicit codes and dates.' };
    return respond({ kind: 'clarify', question: session.pendingClarification.question });
  }
}
