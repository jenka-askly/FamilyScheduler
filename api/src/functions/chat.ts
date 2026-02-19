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
import { normalizeAppointmentCode } from '../lib/text/normalizeCode.js';

type ChatRequest = { message?: unknown };
type PendingProposal = { id: string; expectedEtag: string; actions: Action[] };
type PendingClarification = { question: string };
type SessionRuntimeState = { pendingProposal: PendingProposal | null; pendingClarification: PendingClarification | null; activePersonId: string | null; chatHistory: ChatHistoryEntry[] };

type ResponseSnapshot = {
  appointments: Array<{ code: string; desc: string; date: string; startTime?: string; durationMins?: number; isAllDay: boolean; people: string[]; peopleDisplay: string[]; location: string; notes: string }>;
  people: Array<{ personId: string; name: string; cellDisplay: string; status: 'active' | 'inactive'; timezone?: string; notes?: string }>;
  rules: Array<{ code: string; personId: string; kind: 'available' | 'unavailable'; date: string; startTime?: string; durationMins?: number; timezone?: string; desc?: string }>;
  historyCount?: number;
};

const storage = createStorageAdapter();
const sessionState = new Map<string, SessionRuntimeState>();
const confirmSynonyms = new Set(['confirm', 'yes', 'y', 'ok']);
const cancelSynonyms = new Set(['cancel', 'no', 'n']);

const getSessionId = (request: HttpRequest): string => ((request as { headers?: { get?: (name: string) => string | null } }).headers?.get?.('x-session-id')?.trim() || 'default');
const getSessionState = (sessionId: string): SessionRuntimeState => {
  const existing = sessionState.get(sessionId);
  if (existing) return existing;
  const created: SessionRuntimeState = { pendingProposal: null, pendingClarification: null, activePersonId: null, chatHistory: [] };
  sessionState.set(sessionId, created);
  return created;
};
const trimHistory = (session: SessionRuntimeState): void => { const max = Number(process.env.OPENAI_SESSION_HISTORY_MAX ?? '120'); if (session.chatHistory.length > max) session.chatHistory = session.chatHistory.slice(-max); };

const deriveDateTimeParts = (start?: string, end?: string): { date: string; startTime?: string; durationMins?: number; isAllDay: boolean } => {
  if (!start || !end) return { date: start?.slice(0, 10) ?? '', isAllDay: true };
  const startDate = new Date(start); const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return { date: start.slice(0, 10), isAllDay: true };
  const durationMins = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
  return { date: start.slice(0, 10), startTime: start.match(/T(\d{2}:\d{2})/)?.[1], durationMins, isAllDay: false };
};

const toResponseSnapshot = (state: AppState): ResponseSnapshot => ({
  appointments: state.appointments.map((appointment) => {
    const derived = deriveDateTimeParts(appointment.start, appointment.end);
    return {
      code: appointment.code,
      desc: appointment.title,
      date: appointment.date ?? derived.date,
      startTime: appointment.startTime ?? derived.startTime,
      durationMins: appointment.durationMins ?? derived.durationMins,
      isAllDay: appointment.isAllDay ?? derived.isAllDay,
      people: appointment.people ?? [],
      peopleDisplay: (appointment.people ?? []).map((personId) => state.people.find((person) => person.personId === personId)?.name ?? personId),
      location: appointment.location ?? '',
      notes: appointment.notes ?? ''
    };
  }),
  people: state.people.map((person) => ({ personId: person.personId, name: person.name, cellDisplay: person.cellDisplay ?? person.cellE164, status: person.status, timezone: person.timezone, notes: person.notes ?? '' })),
  rules: state.rules.map((rule) => ({ code: rule.code, personId: rule.personId, kind: rule.kind, date: rule.date, startTime: rule.startTime, durationMins: rule.durationMins, timezone: rule.timezone, desc: rule.desc })),
  historyCount: Array.isArray(state.history) ? state.history.length : undefined
});

const withSnapshot = <T extends Record<string, unknown>>(payload: T, state: AppState): T & { snapshot: ResponseSnapshot } => ({ ...payload, snapshot: toResponseSnapshot(state) });
const badRequest = (message: string, traceId: string): HttpResponseInit => ({ status: 400, jsonBody: { kind: 'error', message, traceId } });
const toProposal = (expectedEtag: string, actions: Action[]): PendingProposal => ({ id: Date.now().toString(), expectedEtag, actions });
const isMutationAction = (action: Action): boolean => !['list_appointments', 'show_appointment', 'list_people', 'show_person', 'list_rules', 'show_rule', 'help'].includes(action.type);

const normalizeActionCodes = (actions: Action[]): Action[] => actions.map((action) => ('code' in action && typeof action.code === 'string' ? { ...action, code: normalizeAppointmentCode(action.code) ?? action.code } as Action : action));
const validateReferencedCodes = (state: AppState, actions: Action[]): string | null => {
  for (const action of actions) {
    if (!('code' in action) || typeof action.code !== 'string') continue;
    if (action.code.toUpperCase().startsWith('APPT-') && !state.appointments.some((item) => item.code.toUpperCase() === action.code.toUpperCase())) return `I cannot find ${action.code}. Which appointment code should I use?`;
    if (action.code.toUpperCase().startsWith('RULE-') && !state.rules.some((item) => item.code.toUpperCase() === action.code.toUpperCase())) return `I cannot find ${action.code}. Which rule code should I use?`;
  }
  return null;
};
const getIdentityName = (state: AppState, activePersonId: string | null): string | null => state.people.find((person) => person.personId === activePersonId)?.name ?? null;

const parseWithOpenAi = async (params: { message: string; state: AppState; session: SessionRuntimeState; sessionId: string; traceId: string; }) => {
  const contextEnvelope = buildContext({ state: params.state, identityName: getIdentityName(params.state, params.session.activePersonId), pendingProposal: params.session.pendingProposal ? { summary: 'Pending proposal', actions: params.session.pendingProposal.actions } : null, pendingClarification: params.session.pendingClarification ? { question: params.session.pendingClarification.question, partialAction: { type: 'help' }, missing: ['action'] } : null, history: params.session.chatHistory });
  const rawModel = await parseToActions(params.message, contextEnvelope, { traceId: params.traceId, sessionIdHash: createHash('sha256').update(params.sessionId).digest('hex').slice(0, 16) });
  return ParsedModelResponseSchema.parse(rawModel);
};

export async function chat(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = randomUUID();
  await storage.initIfMissing();
  const body = await request.json() as ChatRequest;
  if (typeof body.message !== 'string' || body.message.trim().length === 0) return badRequest('message is required', traceId);
  const message = body.message.trim();
  const normalized = normalizeUserText(message);

  const session = getSessionState(getSessionId(request));
  const loaded = await storage.getState();
  const state = loaded.state;

  session.chatHistory.push({ role: 'user', text: message, ts: new Date().toISOString() });
  trimHistory(session);

  const respond = (payload: { kind: 'reply'; assistantText: string } | { kind: 'clarify'; question: string } | { kind: 'proposal'; proposalId: string; assistantText: string } | { kind: 'applied'; assistantText: string }): HttpResponseInit => {
    session.chatHistory.push({ role: 'assistant', text: payload.kind === 'clarify' ? payload.question : payload.assistantText, ts: new Date().toISOString() });
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
    if (cancelSynonyms.has(normalized)) { session.pendingProposal = null; session.pendingClarification = null; return respond({ kind: 'reply', assistantText: 'Cancelled.' }); }
    return respond({ kind: 'clarify', question: 'Please confirm or cancel.' });
  }


  if (confirmSynonyms.has(normalized)) return respond({ kind: 'clarify', question: 'What should I confirm?' });
  if (cancelSynonyms.has(normalized)) return respond({ kind: 'reply', assistantText: 'Nothing to cancel.' });

  if (normalized === 'help') return respond({ kind: 'reply', assistantText: 'Try commands: add person with phone, add appointment, add unavailable rule, list people.' });

  try {
    const parsed = await parseWithOpenAi({ message, state, session, sessionId: getSessionId(request), traceId });
    const normalizedActions = normalizeActionCodes(parsed.actions ?? []);
    const codeError = validateReferencedCodes(state, normalizedActions);
    if (codeError) return respond({ kind: 'clarify', question: codeError });
    if (parsed.kind === 'clarify') return respond({ kind: 'clarify', question: parsed.message });
    if (parsed.kind === 'proposal') {
      const mutationActions = normalizedActions.filter(isMutationAction);
      if (mutationActions.length === 0) return respond({ kind: 'clarify', question: 'Please clarify the change with a valid action and summary.' });
      const previewExecution = executeActions(state, mutationActions, { activePersonId: session.activePersonId, timezoneName: process.env.TZ ?? 'America/Los_Angeles' });
      session.pendingProposal = toProposal(loaded.etag, mutationActions);
      return respond({ kind: 'proposal', proposalId: session.pendingProposal.id, assistantText: previewExecution.effectsTextLines.join('\n') || parsed.message });
    }
    if (normalizedActions.length > 0) {
      const execution = executeActions(state, normalizedActions, { activePersonId: session.activePersonId, timezoneName: process.env.TZ ?? 'America/Los_Angeles' });
      return respond({ kind: 'reply', assistantText: execution.effectsTextLines.join('\n') || parsed.message });
    }
    return respond({ kind: 'reply', assistantText: parsed.message });
  } catch {
    return respond({ kind: 'clarify', question: 'I could not safely parse that. Please provide explicit codes and dates.' });
  }
}
