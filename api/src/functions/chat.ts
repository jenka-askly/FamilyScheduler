import { createHash, randomUUID } from 'node:crypto';
import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { type Action, ParsedModelResponseSchema } from '../lib/actions/schema.js';
import { confirmRuleDraftV2, executeActions, prepareRuleDraftV2, type AvailabilityRuleV2 } from '../lib/actions/executor.js';
import { buildContext, type ChatHistoryEntry } from '../lib/openai/buildContext.js';
import { MissingConfigError } from '../lib/errors/configError.js';
import { errorResponse, logConfigMissing } from '../lib/http/errorResponse.js';
import { parseToActions } from '../lib/openai/openaiClient.js';
import { buildRulesOnlyPrompt } from '../lib/openai/prompts.js';
import { type AppState, type Appointment } from '../lib/state.js';
import { getTimeSpec } from '../lib/time/timeSpec.js';
import { ConflictError, GroupNotFoundError } from '../lib/storage/storage.js';
import { createStorageAdapter, describeStorageTarget } from '../lib/storage/storageFactory.js';
import { normalizeUserText } from '../lib/text/normalize.js';
import { normalizeAppointmentCode } from '../lib/text/normalizeCode.js';
import { requireSessionEmail } from '../lib/auth/requireSession.js';
import { requireActiveMember } from '../lib/auth/requireMembership.js';
import { ensureTraceId, logAuth } from '../lib/logging/authLogs.js';
import { recordUsageError, recordUsageSuccess } from '../lib/usageMeter.js';
import { userKeyFromEmail } from '../lib/identity/userKey.js';
import { recordOpenAiSuccess } from '../lib/usage/usageTables.js';
import { getAppointmentJson } from '../lib/tables/appointments.js';
import { listAppointmentIndexesForGroup } from '../lib/tables/entities.js';

type ChatRequest = { message?: unknown; groupId?: unknown; email?: unknown; phone?: unknown; traceId?: unknown; ruleMode?: unknown; personId?: unknown; replacePromptId?: unknown; replaceRuleCode?: unknown; rules?: unknown; promptId?: unknown; draftedIntervals?: unknown };
type PendingProposal = { id: string; expectedEtag: string; actions: Action[] };
type PendingQuestion = { message: string; options?: Array<{ label: string; value: string; style?: 'primary' | 'secondary' | 'danger' }>; allowFreeText: boolean };
type SessionRuntimeState = { pendingProposal: PendingProposal | null; pendingQuestion: PendingQuestion | null; activePersonId: string | null; chatHistory: ChatHistoryEntry[] };

type ResponseSnapshot = {
  appointments: Array<{ id: string; code: string; desc: string; schemaVersion?: number; updatedAt?: string; time: ReturnType<typeof getTimeSpec>; date: string; startTime?: string; durationMins?: number; isAllDay: boolean; people: string[]; peopleDisplay: string[]; location: string; locationRaw: string; locationDisplay: string; locationMapQuery: string; locationName: string; locationAddress: string; locationDirections: string; notes: string; scanStatus: 'pending' | 'parsed' | 'failed' | 'deleted' | null; scanImageKey: string | null; scanImageMime: string | null; scanCapturedAt: string | null }>;
  people: Array<{ personId: string; name: string; email: string; cellDisplay: string; cellE164: string; status: 'active' | 'removed'; lastSeen?: string; timezone?: string; notes?: string }>;
  rules: Array<{ code: string; schemaVersion?: number; personId: string; kind: 'available' | 'unavailable'; time: ReturnType<typeof getTimeSpec>; date: string; startTime?: string; durationMins?: number; timezone?: string; desc?: string; promptId?: string; originalPrompt?: string; startUtc?: string; endUtc?: string }>;
  historyCount?: number;
};

const sessionState = new Map<string, SessionRuntimeState>();
const confirmSynonyms = new Set(['confirm', 'yes', 'y', 'ok']);
const cancelSynonyms = new Set(['cancel', 'no', 'n']);

const getSessionId = (request: HttpRequest, groupId: string): string => `${groupId}:${((request as { headers?: { get?: (name: string) => string | null } }).headers?.get?.('x-session-id')?.trim() || 'default')}`;
const getSessionState = (sessionId: string): SessionRuntimeState => {
  const existing = sessionState.get(sessionId);
  if (existing) return existing;
  const created: SessionRuntimeState = { pendingProposal: null, pendingQuestion: null, activePersonId: null, chatHistory: [] };
  sessionState.set(sessionId, created);
  return created;
};
const trimHistory = (session: SessionRuntimeState): void => { const max = Number(process.env.OPENAI_SESSION_HISTORY_MAX ?? '120'); if (session.chatHistory.length > max) session.chatHistory = session.chatHistory.slice(-max); };
const usageModel = (): string => process.env.AZURE_OPENAI_DEPLOYMENT?.trim() || process.env.OPENAI_MODEL?.trim() || 'unknown-model';

const deriveDateTimeParts = (start?: string, end?: string): { date: string; startTime?: string; durationMins?: number; isAllDay: boolean } => {
  if (!start || !end) return { date: start?.slice(0, 10) ?? '', isAllDay: true };
  const startDate = new Date(start); const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return { date: start.slice(0, 10), isAllDay: true };
  const durationMins = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
  return { date: start.slice(0, 10), startTime: start.match(/T(\d{2}:\d{2})/)?.[1], durationMins, isAllDay: false };
};

const toResponseSnapshot = (state: AppState): ResponseSnapshot => {
  const nowIso = new Date().toISOString();
  return ({
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
  people: state.people.map((person) => ({ personId: person.personId, name: person.name, email: person.email ?? '', cellDisplay: person.cellDisplay ?? person.cellE164 ?? '', cellE164: person.cellE164 ?? '', status: person.status === 'active' ? 'active' : 'removed', lastSeen: person.lastSeen ?? person.createdAt ?? nowIso, timezone: person.timezone, notes: person.notes ?? '' })),
  rules: state.rules.map((rule) => ({ code: rule.code, schemaVersion: rule.schemaVersion, personId: rule.personId, kind: rule.kind, time: getTimeSpec(rule, rule.timezone ?? process.env.TZ ?? 'America/Los_Angeles'), date: rule.date, startTime: rule.startTime, durationMins: rule.durationMins, timezone: rule.timezone, desc: rule.desc, promptId: rule.promptId, originalPrompt: rule.originalPrompt, startUtc: rule.startUtc, endUtc: rule.endUtc })),
  historyCount: Array.isArray(state.history) ? state.history.length : undefined
  });
};

const withSnapshot = <T extends Record<string, unknown>>(payload: T, state: AppState, groupId?: string): T & { snapshot: ResponseSnapshot; debug?: { storageTarget: { storageMode: string; accountUrl?: string; containerName?: string; stateBlobPrefix?: string; blobNameForGroup: string } } } => {
  const withState = { ...payload, snapshot: toResponseSnapshot(state) } as T & { snapshot: ResponseSnapshot; debug?: { storageTarget: { storageMode: string; accountUrl?: string; containerName?: string; stateBlobPrefix?: string; blobNameForGroup: string } } };
  if (process.env.DEBUG_STORAGE_TARGET !== '1' || !groupId) return withState;
  const storageTarget = describeStorageTarget();
  return {
    ...withState,
    debug: {
      storageTarget: {
        storageMode: storageTarget.storageMode,
        accountUrl: storageTarget.accountUrl,
        containerName: storageTarget.containerName,
        stateBlobPrefix: storageTarget.stateBlobPrefix,
        blobNameForGroup: storageTarget.blobNameForGroup(groupId)
      }
    }
  };
};


const LIST_APPOINTMENTS_COMMANDS = new Set(['list appointments', 'show appointments', 'appointments']);

const parseAppointmentFromDoc = (appointmentId: string, doc: Record<string, unknown>): Appointment | null => {
  const id = typeof doc.id === 'string' && doc.id.trim() ? doc.id.trim() : appointmentId;
  const code = typeof doc.code === 'string' && doc.code.trim() ? doc.code.trim() : `APPT-${appointmentId.slice(-6).toUpperCase()}`;
  const title = typeof doc.title === 'string' ? doc.title : '';
  const assigned = Array.isArray(doc.assigned) ? doc.assigned.filter((item): item is string => typeof item === 'string') : [];
  const people = Array.isArray(doc.people) ? doc.people.filter((item): item is string => typeof item === 'string') : [];
  const scanStatus = doc.scanStatus === 'pending' || doc.scanStatus === 'parsed' || doc.scanStatus === 'failed' || doc.scanStatus === 'deleted'
    ? doc.scanStatus
    : null;
  return {
    id,
    code,
    title,
    schemaVersion: typeof doc.schemaVersion === 'number' ? doc.schemaVersion : undefined,
    updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : undefined,
    start: typeof doc.start === 'string' ? doc.start : undefined,
    end: typeof doc.end === 'string' ? doc.end : undefined,
    date: typeof doc.date === 'string' ? doc.date : undefined,
    startTime: typeof doc.startTime === 'string' ? doc.startTime : undefined,
    durationMins: typeof doc.durationMins === 'number' ? doc.durationMins : undefined,
    timezone: typeof doc.timezone === 'string' ? doc.timezone : undefined,
    isAllDay: typeof doc.isAllDay === 'boolean' ? doc.isAllDay : undefined,
    assigned,
    people,
    location: typeof doc.location === 'string' ? doc.location : '',
    locationRaw: typeof doc.locationRaw === 'string' ? doc.locationRaw : '',
    locationDisplay: typeof doc.locationDisplay === 'string' ? doc.locationDisplay : '',
    locationMapQuery: typeof doc.locationMapQuery === 'string' ? doc.locationMapQuery : '',
    locationName: typeof doc.locationName === 'string' ? doc.locationName : '',
    locationAddress: typeof doc.locationAddress === 'string' ? doc.locationAddress : '',
    locationDirections: typeof doc.locationDirections === 'string' ? doc.locationDirections : '',
    notes: typeof doc.notes === 'string' ? doc.notes : '',
    scanStatus,
    scanImageKey: typeof doc.scanImageKey === 'string' ? doc.scanImageKey : null,
    scanImageMime: typeof doc.scanImageMime === 'string' ? doc.scanImageMime : null,
    scanCapturedAt: typeof doc.scanCapturedAt === 'string' ? doc.scanCapturedAt : null,
    scanAutoDate: typeof doc.scanAutoDate === 'boolean' ? doc.scanAutoDate : undefined
  };
};

const buildSnapshotFromIndex = async (groupId: string, state: AppState, traceId: string): Promise<ResponseSnapshot> => {
  const indexes = await listAppointmentIndexesForGroup(groupId);
  const appointments: Appointment[] = [];
  let blobLoadFailures = 0;
  for (const index of indexes) {
    const doc = await getAppointmentJson(groupId, index.appointmentId);
    if (!doc) {
      blobLoadFailures += 1;
      console.warn(JSON.stringify({ traceId, stage: 'chat_list_appointments_missing_blob', groupId, appointmentId: index.appointmentId }));
      continue;
    }
    const appointment = parseAppointmentFromDoc(index.appointmentId, doc);
    if (!appointment) {
      blobLoadFailures += 1;
      console.warn(JSON.stringify({ traceId, stage: 'chat_list_appointments_invalid_blob', groupId, appointmentId: index.appointmentId }));
      continue;
    }
    appointments.push(appointment);
  }
  console.info(JSON.stringify({ traceId, stage: 'chat_list_appointments_index_loaded', groupId, indexCount: indexes.length, returnedCount: appointments.length, blobLoadFailures }));
  return toResponseSnapshot({ ...state, appointments });
};

type RuleRequestItem = { personId: string; status: 'available' | 'unavailable'; date: string; startTime?: string; durationMins?: number; timezone?: string; promptId?: string; originalPrompt?: string };
type DraftErrorCode = 'MODEL_QUESTION' | 'DISALLOWED_ACTION' | 'ZERO_VALID_RULE_ITEMS' | 'ZERO_INTERVALS' | 'SCHEMA_VALIDATION_FAILED';
const isRuleMode = (value: unknown): value is 'draft' | 'confirm' => value === 'draft' || value === 'confirm';
const isRuleStatus = (v: unknown): v is 'available' | 'unavailable' => v === 'available' || v === 'unavailable';
const parseRuleItems = (value: unknown): { items: RuleRequestItem[] } | { invalidStatus: unknown } => {
  if (!Array.isArray(value)) return { items: [] };

  const items: RuleRequestItem[] = [];
  for (const rawItem of value) {
    if (typeof rawItem !== 'object' || rawItem === null) continue;
    const candidateStatus = rawItem.status;
    if (!isRuleStatus(candidateStatus)) return { invalidStatus: candidateStatus };

    const item = {
      personId: String(rawItem.personId ?? '').trim(),
      status: candidateStatus,
      date: String(rawItem.date ?? '').trim(),
      startTime: typeof rawItem.startTime === 'string' ? rawItem.startTime.trim() : undefined,
      durationMins: typeof rawItem.durationMins === 'number' ? rawItem.durationMins : undefined,
      timezone: typeof rawItem.timezone === 'string' ? rawItem.timezone.trim() : undefined,
      promptId: typeof rawItem.promptId === 'string' ? rawItem.promptId.trim() : undefined,
      originalPrompt: typeof rawItem.originalPrompt === 'string' ? rawItem.originalPrompt : undefined
    };
    if (item.personId && item.date) items.push(item);
  }

  return { items };
};



type RuleModeModelAction = { type: 'add_rule_v2_draft' | 'add_rule_v2_confirm'; personId?: string; promptId?: string; rules?: RuleRequestItem[] };

const normalizeDraftRules = (rules: unknown, requestPersonId: string): unknown => {
  if (!Array.isArray(rules)) return rules;
  return rules.map((rawRule) => {
    if (typeof rawRule !== 'object' || rawRule === null) return rawRule;
    const rule = rawRule as Record<string, unknown>;
    if (rule.personId || !requestPersonId) return rawRule;
    return { ...rule, personId: requestPersonId };
  });
};

const parseRuleModeModelOutput = (value: unknown, options?: { mode: 'draft' | 'confirm'; requestPersonId: string }): { kind: 'proposal' | 'question'; message: string; action?: RuleModeModelAction; actionTypes: string[] } => {
  if (typeof value !== 'object' || value === null) throw new Error('Rule mode response must be an object');
  const record = value as Record<string, unknown>;
  const kind = record.kind === 'proposal' || record.kind === 'question' ? record.kind : null;
  const message = typeof record.message === 'string' ? record.message.trim() : '';
  if (!kind || !message) throw new Error('Rule mode response missing kind/message');
  const actions = Array.isArray(record.actions) ? record.actions.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null) : [];
  const actionTypes = actions.map((action) => (typeof action.type === 'string' ? action.type : ''));
  const first = actions[0];
  if (!first) return { kind, message, actionTypes };
  const type = first.type;
  if (type !== 'add_rule_v2_draft' && type !== 'add_rule_v2_confirm') return { kind, message, actionTypes };
  const modelRules = options?.mode === 'draft' ? normalizeDraftRules(first.rules, options.requestPersonId) : first.rules;
  const parsedRules = parseRuleItems(modelRules);
  if ('invalidStatus' in parsedRules) return { kind, message, actionTypes };
  return { kind, message, actionTypes, action: { type, personId: typeof first.personId === 'string' ? first.personId.trim() : undefined, promptId: typeof first.promptId === 'string' ? first.promptId.trim() : undefined, rules: parsedRules.items } };
};

const getRuleDraftError = (params: { code: DraftErrorCode; traceId: string; details: string }): { message: string; hints: string[]; code: DraftErrorCode; traceId: string; details: string } => ({
  message: "Couldn’t draft a rule from that.",
  code: params.code,
  traceId: params.traceId,
  details: params.details,
  hints: [
    "Try: 'Unavailable tomorrow (all day)'",
    "Try: 'Unavailable Mar 16–Mar 31 (all day)'"
  ]
});

type DraftedInterval = {
  personId: string;
  status: 'available' | 'unavailable';
  startUtc: string;
  endUtc: string;
  promptId?: string;
  originalPrompt?: string;
  timezone?: string;
};

const parseDraftedIntervals = (value: unknown): { ok: true; intervals: DraftedInterval[] } | { ok: false; message: string } => {
  if (!Array.isArray(value)) return { ok: false, message: 'draftedIntervals must be an array' };
  const intervals: DraftedInterval[] = [];
  for (const rawInterval of value) {
    if (typeof rawInterval !== 'object' || rawInterval === null) return { ok: false, message: 'draftedIntervals items must be objects' };
    const interval = rawInterval as Record<string, unknown>;
    const personId = typeof interval.personId === 'string' ? interval.personId.trim() : '';
    const status = interval.status;
    const startUtc = typeof interval.startUtc === 'string' ? interval.startUtc.trim() : '';
    const endUtc = typeof interval.endUtc === 'string' ? interval.endUtc.trim() : '';
    if (!personId) return { ok: false, message: 'draftedIntervals.personId is required' };
    if (status !== 'available' && status !== 'unavailable') return { ok: false, message: "draftedIntervals.status must be 'available' or 'unavailable'" };
    const startMs = Date.parse(startUtc);
    const endMs = Date.parse(endUtc);
    if (Number.isNaN(startMs)) return { ok: false, message: 'draftedIntervals.startUtc must be ISO datetime' };
    if (Number.isNaN(endMs)) return { ok: false, message: 'draftedIntervals.endUtc must be ISO datetime' };
    if (endMs <= startMs) return { ok: false, message: 'endUtc must be greater than startUtc' };
    intervals.push({
      personId,
      status,
      startUtc,
      endUtc,
      promptId: typeof interval.promptId === 'string' && interval.promptId.trim() ? interval.promptId.trim() : undefined,
      originalPrompt: typeof interval.originalPrompt === 'string' ? interval.originalPrompt : undefined,
      timezone: typeof interval.timezone === 'string' && interval.timezone.trim() ? interval.timezone.trim() : undefined
    });
  }
  return { ok: true, intervals };
};

const parseRulesWithOpenAi = async (params: { message: string; mode: 'draft' | 'confirm'; personId: string; timezone: string; now: string; traceId: string; groupSnapshot: string; email: string; }): Promise<{ kind: 'proposal' | 'question'; message: string; action?: RuleModeModelAction; actionTypes: string[]; opId?: string }> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  const model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
  const prompts = buildRulesOnlyPrompt({ mode: params.mode, personId: params.personId, timezone: params.timezone, now: params.now, message: params.message, groupSnapshot: params.groupSnapshot });
  const startedAt = Date.now();
  console.info(JSON.stringify({ traceId: params.traceId, stage: 'chat_rules_openai_before_fetch', mode: params.mode, model }));
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: prompts.system }, { role: 'user', content: prompts.user }] })
  });
  console.info(JSON.stringify({ traceId: params.traceId, stage: 'chat_rules_openai_after_fetch', mode: params.mode, status: response.status, latencyMs: Date.now() - startedAt }));
  if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}`);
  const payload = await response.json() as { id?: string; choices?: Array<{ message?: { content?: string } }>; usage?: { input_tokens?: number; output_tokens?: number; prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
  const opId = payload.id;
  console.info(JSON.stringify({ traceId: params.traceId, stage: 'chat_rules_openai_result', mode: params.mode, model, opId: opId ?? null }));
  await recordUsageSuccess(payload.usage).catch((error) => console.warn(JSON.stringify({ traceId: params.traceId, stage: 'usage_meter_record_success_failed', message: error instanceof Error ? error.message : String(error) })));
  await recordOpenAiSuccess(userKeyFromEmail(params.email), usageModel(), Number(payload.usage?.input_tokens ?? payload.usage?.prompt_tokens ?? 0), Number(payload.usage?.output_tokens ?? payload.usage?.completion_tokens ?? 0), params.traceId).catch((error) => console.warn(JSON.stringify({ traceId: params.traceId, stage: 'usage_tables_record_success_failed', message: error instanceof Error ? error.message : String(error) })));
  const raw = payload.choices?.[0]?.message?.content;
  if (!raw) throw new Error('OpenAI rule parse missing content');
  if (process.env.RULES_DRAFT_DEBUG_RAW === '1') {
    console.info(JSON.stringify({ traceId: params.traceId, stage: 'chat_rules_openai_raw_response', mode: params.mode, raw }));
  }
  return { ...parseRuleModeModelOutput(JSON.parse(raw), { mode: params.mode, requestPersonId: params.personId }), opId };
};

const badRequest = (message: string, traceId: string, opId?: string): HttpResponseInit => ({ status: 400, jsonBody: { kind: 'error', message, traceId, opId: opId ?? null } });
const toProposal = (expectedEtag: string, actions: Action[]): PendingProposal => ({ id: Date.now().toString(), expectedEtag, actions });
const isMutationAction = (action: Action): boolean => !['list_appointments', 'show_appointment', 'list_people', 'show_person', 'list_rules', 'show_rule', 'help'].includes(action.type);
const shouldPersistLastSeen = (lastSeen: string | undefined, nowMs: number): boolean => {
  if (!lastSeen) return true;
  const previousMs = Date.parse(lastSeen);
  if (Number.isNaN(previousMs)) return true;
  return nowMs - previousMs >= 60_000;
};

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

const parseWithOpenAi = async (params: { message: string; state: AppState; session: SessionRuntimeState; sessionId: string; traceId: string; email: string; }): Promise<{ parsed: ReturnType<typeof ParsedModelResponseSchema.parse>; opId?: string }> => {
  const contextEnvelope = buildContext({ state: params.state, identityName: getIdentityName(params.state, params.session.activePersonId), pendingProposal: params.session.pendingProposal ? { summary: 'Pending proposal', actions: params.session.pendingProposal.actions } : null, pendingClarification: params.session.pendingQuestion ? { question: params.session.pendingQuestion.message, partialAction: { type: 'help' }, missing: ['action'] } : null, history: params.session.chatHistory });
  const contextLen = JSON.stringify(contextEnvelope).length;
  console.info(JSON.stringify({ traceId: params.traceId, stage: 'chat_openai_before_fetch', model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini', messageLen: params.message.length, contextLen }));
  let usage: { input_tokens?: number; output_tokens?: number; prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
  const rawModel = await parseToActions(params.message, contextEnvelope, {
    traceId: params.traceId,
    sessionIdHash: createHash('sha256').update(params.sessionId).digest('hex').slice(0, 16),
    onHttpResult: ({ status, latencyMs }) => {
      console.info(JSON.stringify({ traceId: params.traceId, stage: 'chat_openai_after_fetch', status, latencyMs }));
    },
    onModelUsage: (modelUsage) => { usage = modelUsage; }
  });
  await recordUsageSuccess(usage).catch((error) => console.warn(JSON.stringify({ traceId: params.traceId, stage: 'usage_meter_record_success_failed', message: error instanceof Error ? error.message : String(error) })));
  await recordOpenAiSuccess(userKeyFromEmail(params.email), usageModel(), Number(usage?.input_tokens ?? usage?.prompt_tokens ?? 0), Number(usage?.output_tokens ?? usage?.completion_tokens ?? 0), params.traceId).catch((error) => console.warn(JSON.stringify({ traceId: params.traceId, stage: 'usage_tables_record_success_failed', message: error instanceof Error ? error.message : String(error) })));
  return { parsed: ParsedModelResponseSchema.parse(rawModel.parsed), opId: rawModel.opId };
};

export async function chat(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const fallbackTraceId = randomUUID();
  let traceId: string = fallbackTraceId;
  let openAiCallInFlight = false;
  let opId: string | undefined;

  try {
    const body = await request.json() as ChatRequest;
    traceId = ensureTraceId(body.traceId) || fallbackTraceId;
    const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
    if (!groupId) return errorResponse(400, 'invalid_group_id', 'groupId is required', traceId);
    const sessionAuth = await requireSessionEmail(request, traceId, { groupId });
    if (!sessionAuth.ok) return sessionAuth.response;
    const bodyEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (bodyEmail && bodyEmail.toLowerCase() !== sessionAuth.email.toLowerCase()) {
      console.warn(JSON.stringify({ traceId, route: '/api/chat', stage: 'identity_body_email_mismatch', groupId, bodyEmailDomain: bodyEmail.split('@')[1] ?? 'unknown', sessionEmailDomain: sessionAuth.email.split('@')[1] ?? 'unknown' }));
    }
    const messageLen = typeof body.message === 'string' ? body.message.trim().length : 0;
    console.info(JSON.stringify({ traceId, route: '/api/chat', groupId, emailDomain: sessionAuth.email.split('@')[1] ?? 'unknown', messageLen }));
    logAuth({ traceId, stage: 'gate_in', groupId, emailDomain: sessionAuth.email.split('@')[1] ?? 'unknown' });
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (message.length === 0) return badRequest('message is required', traceId, opId);
    const normalized = normalizeUserText(message);

    const session = getSessionState(getSessionId(request, groupId));
    const storage = createStorageAdapter();
    const debugStorageTargetEnabled = process.env.DEBUG_STORAGE_TARGET === '1';
    if (debugStorageTargetEnabled) {
      const storageTarget = describeStorageTarget();
      console.info(JSON.stringify({
        event: 'storage_target',
        fn: 'chat',
        groupId,
        storageMode: storageTarget.storageMode,
        accountUrl: storageTarget.accountUrl,
        containerName: storageTarget.containerName,
        stateBlobPrefix: storageTarget.stateBlobPrefix,
        blobNameForGroup: storageTarget.blobNameForGroup(groupId)
      }));
    }
    let loaded;
    try {
      loaded = await storage.load(groupId);
    } catch (error) {
      if (error instanceof GroupNotFoundError) return errorResponse(404, 'group_not_found', 'Group not found', traceId);
      throw error;
    }
    let state = loaded.state;
    const membership = requireActiveMember(state, sessionAuth.email, traceId);
    if (!membership.ok) {
      logAuth({ traceId, stage: 'gate_denied', reason: 'not_allowed' });
      return membership.response;
    }
    const member = membership.member;
    logAuth({ traceId, stage: 'gate_allowed', personId: member.memberId });
    session.activePersonId = member.memberId;

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const currentPerson = state.people.find((person) => person.personId === member.memberId);
    if (shouldPersistLastSeen(currentPerson?.lastSeen, nowMs)) {
      const nextState: AppState = {
        ...state,
        people: state.people.map((person) => person.personId === member.memberId ? {
          ...person,
          lastSeen: nowIso,
          createdAt: person.createdAt ?? nowIso
        } : person)
      };
      try {
        const written = await storage.save(groupId, nextState, loaded.etag);
        loaded = { state: written.state, etag: written.etag };
        state = loaded.state;
      } catch (error) {
        if (!(error instanceof ConflictError)) throw error;
      }
    }

    const ruleMode = isRuleMode(body.ruleMode) ? body.ruleMode : undefined;
    const requestedPersonId = typeof body.personId === 'string' ? body.personId.trim() : '';
    const parsedRules = parseRuleItems(body.rules);
    if ('invalidStatus' in parsedRules) {
      return {
        status: 400,
        jsonBody: {
          error: 'invalid_rule_status',
          message: "status must be 'available' or 'unavailable'",
          got: parsedRules.invalidStatus
        }
      };
    }
    const withGroupSnapshot = <T extends Record<string, unknown>>(payload: T, currentState: AppState): T & { snapshot: ResponseSnapshot; debug?: { storageTarget: { storageMode: string; accountUrl?: string; containerName?: string; stateBlobPrefix?: string; blobNameForGroup: string } } } => withSnapshot(payload, currentState, groupId);

    if (ruleMode === 'draft' || ruleMode === 'confirm') {
      if (!requestedPersonId) return { status: 400, jsonBody: { kind: 'error', error: 'personId_required', message: 'personId is required', traceId } };
      if (ruleMode === 'confirm' && Array.isArray(body.draftedIntervals) && body.draftedIntervals.length > 0) {
        const parsedDraftedIntervals = parseDraftedIntervals(body.draftedIntervals);
        if (!parsedDraftedIntervals.ok) {
          return {
            status: 400,
            jsonBody: {
              kind: 'error',
              error: 'invalid_drafted_intervals',
              message: parsedDraftedIntervals.message,
              traceId
            }
          };
        }
        if (parsedDraftedIntervals.intervals.some((interval) => interval.personId !== requestedPersonId)) {
          return {
            status: 400,
            jsonBody: {
              kind: 'error',
              error: 'invalid_drafted_intervals_person',
              message: 'draftedIntervals.personId must match request personId',
              traceId
            }
          };
        }
        const draftedRules: Array<Omit<AvailabilityRuleV2, 'code' | 'startUtc' | 'endUtc' | 'assumptions'>> = parsedDraftedIntervals.intervals.map((interval) => {
          const date = interval.startUtc.slice(0, 10);
          const startTime = interval.startUtc.match(/T(\d{2}:\d{2})/)?.[1];
          const durationMins = Math.max(1, Math.round((new Date(interval.endUtc).getTime() - new Date(interval.startUtc).getTime()) / 60000));
          return {
            personId: interval.personId,
            status: interval.status,
            date,
            startTime,
            durationMins,
            timezone: interval.timezone,
            promptId: interval.promptId ?? (typeof body.promptId === 'string' ? body.promptId : undefined),
            originalPrompt: interval.originalPrompt
          };
        });
        try {
          const confirmed = confirmRuleDraftV2(state, draftedRules, { context: { activePersonId: session.activePersonId, timezoneName: process.env.TZ ?? 'America/Los_Angeles' } });
          const written = await storage.save(groupId, confirmed.nextState, loaded.etag);
          console.info('rule_mode_confirm_result', { traceId, mode: 'confirm', source: 'draftedIntervals', persistedIntervalsCount: draftedRules.length, normalizedIntervalsCount: confirmed.normalizedCount, inserted: confirmed.inserted, capCheck: confirmed.capCheck, timezoneFallbackUsed: confirmed.timezoneFallbackUsed });
          return { status: 200, jsonBody: withGroupSnapshot({ kind: 'reply', assistantText: `Saved ${confirmed.inserted} rule(s).`, assumptions: confirmed.assumptions }, written.state) };
        } catch (error) {
          const payload = error instanceof Error ? (error as Error & { payload?: Record<string, unknown> }).payload : undefined;
          if (payload?.error === 'RULE_LIMIT_EXCEEDED') return { status: 409, jsonBody: { ...payload, error: 'rule_limit_exceeded', traceId } };
          if (payload?.error === 'INTERVAL_TOO_LARGE') return { status: 400, jsonBody: { ...payload, traceId } };
          throw error;
        }
      }
      const reportDraftFailure = (params: { code: DraftErrorCode; details: string; incomingRulesCount: number; validRuleItemsCount: number; intervalsCount: number; modelKind: 'proposal' | 'question'; actionType?: string }): HttpResponseInit => {
        console.info('rule_mode_draft_fail', {
          rulesDraftFail: true,
          traceId,
          code: params.code,
          incomingRulesCount: params.incomingRulesCount,
          validRuleItemsCount: params.validRuleItemsCount,
          intervalsCount: params.intervalsCount,
          modelKind: params.modelKind,
          actionType: params.actionType ?? null
        });
        return { status: 200, jsonBody: withGroupSnapshot({ kind: 'reply', draftError: getRuleDraftError({ code: params.code, traceId, details: params.details }) }, state) };
      };
      openAiCallInFlight = true;
      let ruleParse;
      try {
        ruleParse = await parseRulesWithOpenAi({ message, mode: ruleMode, personId: requestedPersonId, timezone: process.env.TZ ?? 'America/Los_Angeles', now: new Date().toISOString(), traceId, groupSnapshot: JSON.stringify(toResponseSnapshot(state)), email: sessionAuth.email });
        opId = ruleParse.opId;
      } catch (error) {
        openAiCallInFlight = false;
        const isSchemaIssue = error instanceof SyntaxError || (error instanceof Error && error.message.startsWith('Rule mode response'));
        if (ruleMode === 'draft' && isSchemaIssue && error instanceof Error) {
          return reportDraftFailure({ code: 'SCHEMA_VALIDATION_FAILED', details: error.message, incomingRulesCount: 0, validRuleItemsCount: 0, intervalsCount: 0, modelKind: 'proposal' });
        }
        throw error;
      }
      openAiCallInFlight = false;
      const requiredType = ruleMode === 'draft' ? 'add_rule_v2_draft' : 'add_rule_v2_confirm';
      const parsedAction = (ruleParse.kind === 'proposal' && ruleParse.action?.type === requiredType) ? ruleParse.action : undefined;
      const hasDisallowedAction = ruleParse.actionTypes.some((type) => type !== requiredType);
      const hasAppointmentAction = ruleParse.actionTypes.some((type) => type.includes('appointment') || type.startsWith('add_appointment') || type.startsWith('reschedule_appointment') || type.startsWith('delete_appointment'));
      const promptId = typeof body.promptId === 'string' ? body.promptId : undefined;
      const incomingRules = parsedAction?.rules?.map((rule) => ({ ...rule, personId: ruleMode === 'draft' ? (rule.personId || requestedPersonId) : rule.personId, promptId: promptId ?? parsedAction.promptId })) ?? [];
      console.info('rule_mode_request', { traceId, ruleMode, personId: requestedPersonId, requiredType, parsedKind: ruleParse.kind, parsedActionType: ruleParse.action?.type, actionTypes: ruleParse.actionTypes, incomingIntervalsCount: incomingRules.length, promptId });
      if (ruleMode === 'confirm' && incomingRules.length === 0) {
        console.info('rule_mode_confirm_zero_intervals', { traceId, mode: 'confirm', code: 'ZERO_INTERVALS_FROM_MODEL' });
      }
      if (ruleMode === 'draft' && ruleParse.kind === 'question') {
        return reportDraftFailure({ code: 'MODEL_QUESTION', details: 'modelKind=question', incomingRulesCount: parsedAction?.rules?.length ?? 0, validRuleItemsCount: incomingRules.length, intervalsCount: 0, modelKind: ruleParse.kind, actionType: ruleParse.action?.type });
      }
      if (ruleMode === 'draft' && (hasDisallowedAction || hasAppointmentAction || !parsedAction)) {
        return reportDraftFailure({ code: 'DISALLOWED_ACTION', details: 'action type not allowed in draft mode', incomingRulesCount: parsedAction?.rules?.length ?? 0, validRuleItemsCount: incomingRules.length, intervalsCount: 0, modelKind: ruleParse.kind, actionType: ruleParse.action?.type });
      }
      if (ruleMode !== 'draft' && (ruleParse.kind === 'question' || hasDisallowedAction || hasAppointmentAction || !parsedAction || incomingRules.length === 0)) {
        return { status: 200, jsonBody: withGroupSnapshot({ kind: 'reply', draftError: getRuleDraftError({ code: 'DISALLOWED_ACTION', traceId, details: 'confirm parse failed' }) }, state) };
      }
      if (ruleMode === 'draft' && incomingRules.length === 0) {
        return reportDraftFailure({ code: 'ZERO_VALID_RULE_ITEMS', details: 'rules missing personId/date', incomingRulesCount: parsedAction?.rules?.length ?? 0, validRuleItemsCount: incomingRules.length, intervalsCount: 0, modelKind: ruleParse.kind, actionType: parsedAction?.type });
      }
      try {
        if (ruleMode === 'draft') {
          const draft = prepareRuleDraftV2(state, incomingRules, { activePersonId: session.activePersonId, timezoneName: process.env.TZ ?? 'America/Los_Angeles' });
          if (draft.draftRules.length === 0) {
            return reportDraftFailure({ code: 'ZERO_INTERVALS', details: 'no intervals produced from valid rules', incomingRulesCount: parsedAction?.rules?.length ?? 0, validRuleItemsCount: incomingRules.length, intervalsCount: 0, modelKind: ruleParse.kind, actionType: parsedAction?.type });
          }
          console.info('rule_mode_draft_result', { traceId, normalizedIntervalsCount: draft.draftRules.length, warningsCount: draft.warnings.length, timezoneFallbackUsed: draft.timezoneFallbackUsed });
          return { status: 200, jsonBody: withGroupSnapshot({ kind: 'reply', assistantText: 'Draft prepared.', draftRules: draft.draftRules, preview: draft.preview, assumptions: draft.assumptions, warnings: draft.warnings, promptId: draft.promptId }, state) };
        }
        const confirmed = confirmRuleDraftV2(state, incomingRules, { context: { activePersonId: session.activePersonId, timezoneName: process.env.TZ ?? 'America/Los_Angeles' } });
        const written = await storage.save(groupId, confirmed.nextState, loaded.etag);
        console.info('rule_mode_confirm_result', { traceId, normalizedIntervalsCount: confirmed.normalizedCount, inserted: confirmed.inserted, capCheck: confirmed.capCheck, timezoneFallbackUsed: confirmed.timezoneFallbackUsed });
        return { status: 200, jsonBody: withGroupSnapshot({ kind: 'reply', assistantText: `Saved ${confirmed.inserted} rule(s).`, assumptions: confirmed.assumptions }, written.state) };
      } catch (error) {
        const payload = error instanceof Error ? (error as Error & { payload?: Record<string, unknown> }).payload : undefined;
        if (payload?.error === 'RULE_LIMIT_EXCEEDED') return { status: 409, jsonBody: { ...payload, error: 'rule_limit_exceeded', traceId } };
        if (payload?.error === 'INTERVAL_TOO_LARGE') return { status: 400, jsonBody: { ...payload, traceId } };
        throw error;
      }
    }

    session.chatHistory.push({ role: 'user', text: message, ts: new Date().toISOString() });
    trimHistory(session);

    const respond = (payload: { kind: 'reply'; assistantText: string } | { kind: 'question'; message: string; options?: Array<{ label: string; value: string; style?: 'primary' | 'secondary' | 'danger' }>; allowFreeText: boolean } | { kind: 'proposal'; proposalId: string; assistantText: string } | { kind: 'applied'; assistantText: string }, currentState: AppState = state): HttpResponseInit => {
      session.chatHistory.push({ role: 'assistant', text: payload.kind === 'question' ? payload.message : payload.assistantText, ts: new Date().toISOString() });
      trimHistory(session);
      return { status: 200, jsonBody: withGroupSnapshot(payload, currentState) };
    };

    if (session.pendingProposal) {
      if (confirmSynonyms.has(normalized)) {
        try {
          const execution = await executeActions(state, session.pendingProposal.actions, { activePersonId: session.activePersonId, timezoneName: process.env.TZ ?? 'America/Los_Angeles' });
          const written = await storage.save(groupId, execution.nextState, session.pendingProposal.expectedEtag);
          session.activePersonId = execution.nextActivePersonId;
          session.pendingProposal = null;
          return { status: 200, jsonBody: withGroupSnapshot({ kind: 'applied', assistantText: execution.effectsTextLines.join('\n') }, written.state) };
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

    if (LIST_APPOINTMENTS_COMMANDS.has(normalized)) {
      const snapshot = await buildSnapshotFromIndex(groupId, state, traceId);
      const assistantText = snapshot.appointments.length > 0
        ? `Listed ${snapshot.appointments.length} appointment(s).`
        : 'No appointments found.';
      session.chatHistory.push({ role: 'assistant', text: assistantText, ts: new Date().toISOString() });
      trimHistory(session);
      return { status: 200, jsonBody: { kind: 'reply', assistantText, snapshot } };
    }

    openAiCallInFlight = true;
    const openAiParsed = await parseWithOpenAi({ message, state, session, sessionId: getSessionId(request, groupId), traceId, email: sessionAuth.email });
    opId = openAiParsed.opId;
    const parsed = openAiParsed.parsed;
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
      await recordUsageError(err instanceof Error ? err.message : 'Unknown error').catch((error) => console.warn(JSON.stringify({ traceId, stage: 'usage_meter_record_error_failed', message: error instanceof Error ? error.message : String(error) })));
      return {
        status: 502,
        jsonBody: {
          ok: false,
          error: 'OPENAI_CALL_FAILED',
          message: err instanceof Error ? err.message : 'Unknown error',
          traceId,
          opId: null
        }
      };
    }

    return errorResponse(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Unknown error', traceId);
  }
}
