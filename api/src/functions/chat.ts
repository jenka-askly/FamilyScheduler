import { createHash, randomUUID } from 'node:crypto';
import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { type Action, ParsedModelResponseSchema } from '../lib/actions/schema.js';
import { confirmRuleDraftV2, executeActions, prepareRuleDraftV2, type AvailabilityRuleV2 } from '../lib/actions/executor.js';
import { buildContext, type ChatHistoryEntry } from '../lib/openai/buildContext.js';
import { MissingConfigError } from '../lib/errors/configError.js';
import { errorResponse, logConfigMissing } from '../lib/http/errorResponse.js';
import { parseToActions } from '../lib/openai/openaiClient.js';
import { type AppState } from '../lib/state.js';
import { ConflictError, GroupNotFoundError } from '../lib/storage/storage.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { normalizeUserText } from '../lib/text/normalize.js';
import { normalizeAppointmentCode } from '../lib/text/normalizeCode.js';
import { findActivePersonByPhone, validateJoinRequest } from '../lib/groupAuth.js';
import { ensureTraceId, logAuth } from '../lib/logging/authLogs.js';

type ChatRequest = { message?: unknown; groupId?: unknown; phone?: unknown; traceId?: unknown; ruleMode?: unknown; replacePromptId?: unknown; replaceRuleCode?: unknown; rules?: unknown; promptId?: unknown };
type PendingProposal = { id: string; expectedEtag: string; actions: Action[] };
type PendingQuestion = { message: string; options?: Array<{ label: string; value: string; style?: 'primary' | 'secondary' | 'danger' }>; allowFreeText: boolean };
type SessionRuntimeState = { pendingProposal: PendingProposal | null; pendingQuestion: PendingQuestion | null; activePersonId: string | null; chatHistory: ChatHistoryEntry[] };

type ResponseSnapshot = {
  appointments: Array<{ code: string; desc: string; date: string; startTime?: string; durationMins?: number; isAllDay: boolean; people: string[]; peopleDisplay: string[]; location: string; locationRaw: string; locationDisplay: string; locationMapQuery: string; locationName: string; locationAddress: string; locationDirections: string; notes: string }>;
  people: Array<{ personId: string; name: string; cellDisplay: string; status: 'active' | 'removed'; timezone?: string; notes?: string }>;
  rules: Array<{ code: string; personId: string; kind: 'available' | 'unavailable'; date: string; startTime?: string; durationMins?: number; timezone?: string; desc?: string; promptId?: string; originalPrompt?: string; startUtc?: string; endUtc?: string }>;
  historyCount?: number;
};

const sessionState = new Map<string, SessionRuntimeState>();
const confirmSynonyms = new Set(['confirm', 'yes', 'y', 'ok']);
const cancelSynonyms = new Set(['cancel', 'no', 'n']);

const hashPhone = (phoneE164: string): string => createHash('sha256').update(phoneE164).digest('hex').slice(0, 12);
const getSessionId = (request: HttpRequest, groupId: string, phoneE164: string): string => `${groupId}:${phoneE164}:${((request as { headers?: { get?: (name: string) => string | null } }).headers?.get?.('x-session-id')?.trim() || 'default')}`;
const getSessionState = (sessionId: string): SessionRuntimeState => {
  const existing = sessionState.get(sessionId);
  if (existing) return existing;
  const created: SessionRuntimeState = { pendingProposal: null, pendingQuestion: null, activePersonId: null, chatHistory: [] };
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
      location: appointment.locationDisplay ?? appointment.location ?? '',
      locationRaw: appointment.locationRaw ?? '',
      locationDisplay: appointment.locationDisplay ?? appointment.location ?? '',
      locationMapQuery: appointment.locationMapQuery ?? appointment.locationAddress ?? appointment.locationDisplay ?? appointment.location ?? '',
      locationName: appointment.locationName ?? '',
      locationAddress: appointment.locationAddress ?? '',
      locationDirections: appointment.locationDirections ?? '',
      notes: appointment.notes ?? ''
    };
  }),
  people: state.people.map((person) => ({ personId: person.personId, name: person.name, cellDisplay: person.cellDisplay ?? person.cellE164, status: person.status === 'active' ? 'active' : 'removed', timezone: person.timezone, notes: person.notes ?? '' })),
  rules: state.rules.map((rule) => ({ code: rule.code, personId: rule.personId, kind: rule.kind, date: rule.date, startTime: rule.startTime, durationMins: rule.durationMins, timezone: rule.timezone, desc: rule.desc, promptId: rule.promptId, originalPrompt: rule.originalPrompt, startUtc: rule.startUtc, endUtc: rule.endUtc })),
  historyCount: Array.isArray(state.history) ? state.history.length : undefined
});

const withSnapshot = <T extends Record<string, unknown>>(payload: T, state: AppState): T & { snapshot: ResponseSnapshot } => ({ ...payload, snapshot: toResponseSnapshot(state) });

type RuleRequestItem = { personId: string; status: 'available' | 'unavailable'; date: string; startTime?: string; durationMins?: number; timezone?: string; promptId?: string; originalPrompt?: string };
const isRuleMode = (value: unknown): value is 'draft' | 'confirm' => value === 'draft' || value === 'confirm';
const parseRuleItems = (value: unknown): RuleRequestItem[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      personId: String(item.personId ?? '').trim(),
      status: item.status === 'available' || item.status === 'unavailable' ? item.status : 'unavailable',
      date: String(item.date ?? '').trim(),
      startTime: typeof item.startTime === 'string' ? item.startTime.trim() : undefined,
      durationMins: typeof item.durationMins === 'number' ? item.durationMins : undefined,
      timezone: typeof item.timezone === 'string' ? item.timezone.trim() : undefined,
      promptId: typeof item.promptId === 'string' ? item.promptId.trim() : undefined,
      originalPrompt: typeof item.originalPrompt === 'string' ? item.originalPrompt : undefined
    }))
    .filter((item) => item.personId && item.date);
};

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
  const contextEnvelope = buildContext({ state: params.state, identityName: getIdentityName(params.state, params.session.activePersonId), pendingProposal: params.session.pendingProposal ? { summary: 'Pending proposal', actions: params.session.pendingProposal.actions } : null, pendingClarification: params.session.pendingQuestion ? { question: params.session.pendingQuestion.message, partialAction: { type: 'help' }, missing: ['action'] } : null, history: params.session.chatHistory });
  const contextLen = JSON.stringify(contextEnvelope).length;
  console.info(JSON.stringify({ traceId: params.traceId, stage: 'chat_openai_before_fetch', model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini', messageLen: params.message.length, contextLen }));
  const rawModel = await parseToActions(params.message, contextEnvelope, {
    traceId: params.traceId,
    sessionIdHash: createHash('sha256').update(params.sessionId).digest('hex').slice(0, 16),
    onHttpResult: ({ status, latencyMs }) => {
      console.info(JSON.stringify({ traceId: params.traceId, stage: 'chat_openai_after_fetch', status, latencyMs }));
    }
  });
  return ParsedModelResponseSchema.parse(rawModel);
};

export async function chat(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const fallbackTraceId = randomUUID();
  let traceId: string = fallbackTraceId;
  let openAiCallInFlight = false;

  try {
    const body = await request.json() as ChatRequest;
    traceId = ensureTraceId(body.traceId) || fallbackTraceId;
    const identity = validateJoinRequest(body.groupId, body.phone);
    const messageLen = typeof body.message === 'string' ? body.message.trim().length : 0;
    console.info(JSON.stringify({ traceId, route: '/api/chat', groupId: identity.ok ? identity.groupId : null, phoneHash: identity.ok ? hashPhone(identity.phoneE164) : null, messageLen }));
    if (!identity.ok) {
      return {
        ...identity.response,
        jsonBody: { ...(identity.response.jsonBody as Record<string, unknown>), traceId }
      };
    }
    logAuth({ traceId, stage: 'gate_in', groupId: identity.groupId, phone: identity.phoneE164 });
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!isRuleMode(body.ruleMode) && message.length === 0) return badRequest('message is required', traceId);
    const normalized = normalizeUserText(message);

    const session = getSessionState(getSessionId(request, identity.groupId, identity.phoneE164));
    const storage = createStorageAdapter();
    let loaded;
    try {
      loaded = await storage.load(identity.groupId);
    } catch (error) {
      if (error instanceof GroupNotFoundError) return errorResponse(404, 'group_not_found', 'Group not found', traceId);
      throw error;
    }
    const state = loaded.state;
    const allowed = findActivePersonByPhone(state, identity.phoneE164);
    if (!allowed) {
      logAuth({ traceId, stage: 'gate_denied', reason: 'not_allowed' });
      return errorResponse(403, 'not_allowed', 'Not allowed', traceId);
    }
    logAuth({ traceId, stage: 'gate_allowed', personId: allowed.personId });
    session.activePersonId = allowed.personId;

    const ruleMode = isRuleMode(body.ruleMode) ? body.ruleMode : undefined;
    const incomingRules = parseRuleItems(body.rules);
    if (ruleMode) {
      console.info('rule_mode_request', { traceId, ruleMode, personIds: [...new Set(incomingRules.map((rule) => rule.personId))], promptId: typeof body.promptId === 'string' ? body.promptId : undefined, replacePromptId: typeof body.replacePromptId === 'string' ? body.replacePromptId : undefined, replaceRuleCode: typeof body.replaceRuleCode === 'string' ? body.replaceRuleCode : undefined, incomingIntervalsCount: incomingRules.length });
      if (incomingRules.length === 0) return badRequest('rules are required for ruleMode', traceId);
      try {
        if (ruleMode === 'draft') {
          const draft = prepareRuleDraftV2(state, incomingRules.map((rule) => ({ ...rule, promptId: rule.promptId ?? (typeof body.promptId === 'string' ? body.promptId : undefined) })), { activePersonId: session.activePersonId, timezoneName: process.env.TZ ?? 'America/Los_Angeles' });
          console.info('rule_mode_draft_result', { traceId, normalizedIntervalsCount: draft.draftRules.length, warningsCount: draft.warnings.length, timezoneFallbackUsed: draft.timezoneFallbackUsed });
          return { status: 200, jsonBody: withSnapshot({ kind: 'reply', assistantText: 'Draft prepared.', draftRules: draft.draftRules, preview: draft.preview, assumptions: draft.assumptions, warnings: draft.warnings, promptId: draft.promptId }, state) };
        }
        const confirmed = confirmRuleDraftV2(state, incomingRules.map((rule) => ({ ...rule, promptId: rule.promptId ?? (typeof body.promptId === 'string' ? body.promptId : undefined) })), { replacePromptId: typeof body.replacePromptId === 'string' ? body.replacePromptId : undefined, replaceRuleCode: typeof body.replaceRuleCode === 'string' ? body.replaceRuleCode : undefined, context: { activePersonId: session.activePersonId, timezoneName: process.env.TZ ?? 'America/Los_Angeles' } });
        const written = await storage.save(identity.groupId, confirmed.nextState, loaded.etag);
        console.info('rule_mode_confirm_result', { traceId, normalizedIntervalsCount: confirmed.normalizedCount, inserted: confirmed.inserted, capCheck: confirmed.capCheck, timezoneFallbackUsed: confirmed.timezoneFallbackUsed });
        return { status: 200, jsonBody: withSnapshot({ kind: 'applied', assistantText: `Saved ${confirmed.inserted} rule(s).`, assumptions: confirmed.assumptions }, written.state) };
      } catch (error) {
        const payload = error instanceof Error ? (error as Error & { payload?: Record<string, unknown> }).payload : undefined;
        if (payload?.error === 'RULE_LIMIT_EXCEEDED') return { status: 409, jsonBody: { ...payload, traceId } };
        if (payload?.error === 'INTERVAL_TOO_LARGE') return { status: 400, jsonBody: { ...payload, traceId } };
        throw error;
      }
    }

    session.chatHistory.push({ role: 'user', text: message, ts: new Date().toISOString() });
    trimHistory(session);

    const respond = (payload: { kind: 'reply'; assistantText: string } | { kind: 'question'; message: string; options?: Array<{ label: string; value: string; style?: 'primary' | 'secondary' | 'danger' }>; allowFreeText: boolean } | { kind: 'proposal'; proposalId: string; assistantText: string } | { kind: 'applied'; assistantText: string }, currentState: AppState = state): HttpResponseInit => {
      session.chatHistory.push({ role: 'assistant', text: payload.kind === 'question' ? payload.message : payload.assistantText, ts: new Date().toISOString() });
      trimHistory(session);
      return { status: 200, jsonBody: withSnapshot(payload, currentState) };
    };

    if (session.pendingProposal) {
      if (confirmSynonyms.has(normalized)) {
        try {
          const execution = await executeActions(state, session.pendingProposal.actions, { activePersonId: session.activePersonId, timezoneName: process.env.TZ ?? 'America/Los_Angeles' });
          const written = await storage.save(identity.groupId, execution.nextState, session.pendingProposal.expectedEtag);
          session.activePersonId = execution.nextActivePersonId;
          session.pendingProposal = null;
          return { status: 200, jsonBody: withSnapshot({ kind: 'applied', assistantText: execution.effectsTextLines.join('\n') }, written.state) };
        } catch (error) {
          if (error instanceof ConflictError) return { status: 409, jsonBody: { kind: 'error', message: 'State changed. Retry.', traceId } };
          throw error;
        }
      }
      if (cancelSynonyms.has(normalized)) { session.pendingProposal = null; session.pendingQuestion = null; return respond({ kind: 'reply', assistantText: 'Cancelled.' }); }
      return respond({ kind: 'question', message: 'Please confirm or cancel.', options: [{ label: 'Confirm', value: 'confirm', style: 'primary' }, { label: 'Cancel', value: 'cancel', style: 'secondary' }], allowFreeText: true });
    }

    if (confirmSynonyms.has(normalized)) return respond({ kind: 'question', message: 'What should I confirm?', allowFreeText: true });
    if (cancelSynonyms.has(normalized)) return respond({ kind: 'reply', assistantText: 'Nothing to cancel.' });

    if (normalized === 'help') return respond({ kind: 'reply', assistantText: 'Try commands: add person with phone, add appointment, add unavailable rule, list people.' });

    openAiCallInFlight = true;
    const parsed = await parseWithOpenAi({ message, state, session, sessionId: getSessionId(request, identity.groupId, identity.phoneE164), traceId });
    openAiCallInFlight = false;
    const normalizedActions = normalizeActionCodes(parsed.actions ?? []);
    const codeError = validateReferencedCodes(state, normalizedActions);
    if (codeError) return respond({ kind: 'question', message: codeError, allowFreeText: true });
    if (parsed.kind === 'question') {
      const questionPayload: PendingQuestion = {
        message: parsed.message,
        options: parsed.options,
        allowFreeText: parsed.allowFreeText ?? true
      };
      session.pendingQuestion = questionPayload;
      return respond({ kind: 'question', ...questionPayload });
    }
    if (parsed.kind === 'proposal') {
      const mutationActions = normalizedActions.filter(isMutationAction);
      if (mutationActions.length === 0) return respond({ kind: 'question', message: 'Please clarify the change with a valid action and summary.', allowFreeText: true });
      const previewExecution = await executeActions(state, mutationActions, { activePersonId: session.activePersonId, timezoneName: process.env.TZ ?? 'America/Los_Angeles' });
      session.pendingProposal = toProposal(loaded.etag, mutationActions);
      session.pendingQuestion = null;
      return respond({ kind: 'proposal', proposalId: session.pendingProposal.id, assistantText: previewExecution.effectsTextLines.join('\n') || parsed.message });
    }
    session.pendingQuestion = null;
    if (normalizedActions.length > 0) {
      const execution = await executeActions(state, normalizedActions, { activePersonId: session.activePersonId, timezoneName: process.env.TZ ?? 'America/Los_Angeles' });
      return respond({ kind: 'reply', assistantText: execution.effectsTextLines.join('\n') || parsed.message });
    }
    return respond({ kind: 'reply', assistantText: parsed.message });
  } catch (err) {
    if (err instanceof MissingConfigError) {
      logConfigMissing('chat', traceId, err.missing);
      return errorResponse(500, 'CONFIG_MISSING', err.message, traceId, { missing: err.missing });
    }
    if (err instanceof GroupNotFoundError) {
      return errorResponse(404, 'group_not_found', 'Group not found', traceId);
    }
    if (err instanceof ConflictError) {
      return errorResponse(409, 'state_changed', 'State changed. Retry.', traceId);
    }

    console.error('chat_handler_failed', {
      traceId,
      message: err instanceof Error ? err.message : String(err)
    });

    if (openAiCallInFlight) {
      return {
        status: 502,
        jsonBody: {
          ok: false,
          error: 'OPENAI_CALL_FAILED',
          message: err instanceof Error ? err.message : 'Unknown error',
          traceId
        }
      };
    }

    return errorResponse(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Unknown error', traceId);
  }
}
