import { createEmptyAppState, type AppState, type Appointment, type AvailabilityRule, type Person, normalizeAppState } from '../state.js';
import { computePersonStatusForInterval } from '../availability/computeStatus.js';
import { intervalBounds, normalizeRulesV2, overlaps } from '../availability/interval.js';
import { PhoneValidationError, validateAndNormalizePhone } from '../validation/phone.js';
import type { Action } from './schema.js';
import { normalizeLocation } from '../location/normalize.js';
import { getTimeSpec, parseTimeSpec } from '../time/timeSpec.js';
import { aiParseLocation } from '../location/aiParseLocation.js';

export type ExecutionContext = { activePersonId: string | null; timezoneName: string; };
export type ExecuteActionsResult = { nextState: AppState; effectsTextLines: string[]; appliedAll: boolean; nextActivePersonId: string | null; };
export type ResolvedAppointmentTimes = { startIso?: string; endIso?: string; isAllDay: boolean; };

const normalizeCode = (value: string): string => value.trim().toUpperCase();
const normalizeName = (value: string): string => value.trim().replace(/\s+/g, ' ').toLowerCase();
const normalizePersonValue = (value: string): string => value.trim().replace(/\s+/g, ' ');
const findAppointmentByCode = (state: AppState, inputCode: string): Appointment | undefined => state.appointments.find((item) => normalizeCode(item.code) === normalizeCode(inputCode));
const findRuleByCode = (state: AppState, inputCode: string): AvailabilityRule | undefined => state.rules.find((item) => normalizeCode(item.code) === normalizeCode(inputCode));
const findPersonById = (state: AppState, personId: string): Person | undefined => state.people.find((person) => person.personId === personId);
const findPersonByName = (state: AppState, name: string): Person | undefined => state.people.find((person) => normalizeName(person.name) === normalizeName(name));

const getNextAppointmentCode = (state: AppState): string => `APPT-${state.appointments.reduce((max, appointment) => {
  const match = appointment.code.match(/^APPT-(\d+)$/i); return match ? Math.max(max, Number(match[1])) : max;
}, 0) + 1}`;
const getNextPersonId = (state: AppState): string => `P-${state.people.reduce((max, person) => { const m = person.personId.match(/^P-(\d+)$/i); return m ? Math.max(max, Number(m[1])) : max; }, 0) + 1}`;
const getNextRuleCode = (state: AppState): string => `RULE-${state.rules.reduce((max, rule) => { const m = rule.code.match(/^RULE-(\d+)$/i); return m ? Math.max(max, Number(m[1])) : max; }, 0) + 1}`;

const getTimeZoneOffset = (date: Date, timeZone: string): string => {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' });
  const zonePart = formatter.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value ?? 'GMT-08:00';
  const match = zonePart.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return '-08:00';
  return `${match[1]}${match[2].padStart(2, '0')}:${(match[3] ?? '00').padStart(2, '0')}`;
};
const buildIsoAtZone = (date: string, startTime: string, timezone: string): string => `${date}T${startTime}:00${getTimeZoneOffset(new Date(`${date}T${startTime}:00Z`), timezone)}`;
export const resolveAppointmentTimes = (date: string, startTime?: string, durationMins?: number, timezone = 'America/Los_Angeles'): ResolvedAppointmentTimes => {
  if (!startTime) return { isAllDay: true };
  if (!durationMins || durationMins < 1) return { isAllDay: false };
  const startIso = buildIsoAtZone(date, startTime, timezone);
  const endIso = new Date(new Date(startIso).getTime() + durationMins * 60_000).toISOString();
  return { startIso, endIso, isAllDay: false };
};
const describeTime = (date: string, startTime?: string, durationMins?: number): string => (!startTime ? `${date} (all day)` : `${date} ${startTime} (${durationMins ?? 60}m)`);
const todayIsoDate = (): string => new Date().toISOString().slice(0, 10);

const fromTimedFieldsToTimeSpec = (date: string, startTime: string | undefined, durationMins: number | undefined, timezone: string): ReturnType<typeof getTimeSpec> => {
  if (!startTime) return parseTimeSpec({ originalText: date, timezone });
  if (!durationMins) return { intent: { status: 'unresolved', originalText: `${date} ${startTime}`, missing: ['duration'] } };
  const end = new Date(new Date(`${date}T${startTime}:00`).getTime() + durationMins * 60_000);
  const h = String(end.getHours()).padStart(2, '0');
  const m = String(end.getMinutes()).padStart(2, '0');
  return parseTimeSpec({ originalText: `${date} ${startTime}-${h}:${m}`, timezone });
};

const isLocationAiFormattingEnabled = (): boolean => (process.env.LOCATION_AI_FORMATTING ?? 'false').toLowerCase() === 'true';

const applyAppointmentLocation = async (appointment: Appointment, locationRawInput: string): Promise<void> => {
  const locationRaw = locationRawInput;
  appointment.locationRaw = locationRaw;

  if (!isLocationAiFormattingEnabled()) {
    const normalized = normalizeLocation(locationRaw);
    appointment.locationDisplay = normalized.display;
    appointment.locationMapQuery = normalized.mapQuery;
    appointment.locationName = '';
    appointment.locationAddress = '';
    appointment.locationDirections = '';
    appointment.location = normalized.display;
    return;
  }

  const parsed = await aiParseLocation(locationRaw);
  appointment.locationDisplay = parsed.display;
  appointment.locationMapQuery = parsed.mapQuery;
  appointment.locationName = parsed.name;
  appointment.locationAddress = parsed.address;
  appointment.locationDirections = parsed.directions;
  appointment.location = parsed.display;
};

const resolvePeopleRefs = (state: AppState, refs: string[]): { ids: string[]; unresolved: string[] } => {
  const ids: string[] = []; const unresolved: string[] = []; const seen = new Set<string>();
  for (const refRaw of refs) {
    const ref = normalizePersonValue(refRaw);
    const person = findPersonById(state, ref) ?? findPersonByName(state, ref);
    if (!person) { unresolved.push(ref); if (seen.has(ref)) continue; seen.add(ref); ids.push(ref); continue; }
    if (seen.has(person.personId)) continue;
    seen.add(person.personId); ids.push(person.personId);
  }
  return { ids, unresolved };
};

const ensureNameUnique = (state: AppState, name: string, excludePersonId?: string): boolean => !state.people.some((person) => person.status === 'active' && person.personId !== excludePersonId && normalizeName(person.name) === normalizeName(name));
const ensureCellUnique = (state: AppState, e164: string, excludePersonId?: string): boolean => !state.people.some((person) => person.status === 'active' && person.personId !== excludePersonId && person.cellE164 === e164);
export const RULE_LIMIT_PER_PERSON = 20;
export const MAX_INTERVAL_DAYS = 14;

export type AvailabilityRuleV2 = {
  code: string;
  personId: string;
  status: 'available' | 'unavailable';
  startUtc: string;
  endUtc: string;
  timezone?: string;
  assumptions?: string[];
  promptId?: string;
  originalPrompt?: string;
};

export type RuleDraftWarning = { message: string; status: 'available' | 'unavailable'; interval: string; code: string };
export type RuleDraftResult = { draftRules: AvailabilityRuleV2[]; preview: string[]; assumptions: string[]; warnings: RuleDraftWarning[]; promptId: string; timezoneFallbackUsed: boolean };
export type RuleConfirmResult = { nextState: AppState; inserted: number; normalizedCount: number; assumptions: string[]; timezoneFallbackUsed: boolean; capCheck: { personId: string; existingCount: number; incomingCount: number; total: number }[] };

const isValidTimezone = (value?: string): value is string => {
  if (!value?.trim()) return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

const resolveRuleTimezone = (timezone: string | undefined, personTimezone: string | undefined, contextTimezone: string): { timezone: string; fallbackUsed: boolean; assumption?: string } => {
  if (isValidTimezone(timezone)) return { timezone, fallbackUsed: false };
  const fallback = (isValidTimezone(personTimezone) && personTimezone) || (isValidTimezone(process.env.TZ) && process.env.TZ) || 'America/Los_Angeles';
  return { timezone: fallback, fallbackUsed: true, assumption: `Timezone not specified/invalid; assumed ${fallback}.` };
};

const toUtcFromLocal = (date: string, startTime: string | undefined, durationMins: number | undefined, timezone: string): { startUtc: string; endUtc: string } => {
  const start = startTime ?? '00:00';
  const startIso = buildIsoAtZone(date, start, timezone);
  const intervalMins = startTime ? (durationMins ?? 60) : (24 * 60);
  return { startUtc: new Date(startIso).toISOString(), endUtc: new Date(new Date(startIso).getTime() + intervalMins * 60_000).toISOString() };
};

const assertMaxInterval = (startUtc: string, endUtc: string, personId: string): void => {
  const span = new Date(endUtc).getTime() - new Date(startUtc).getTime();
  if (span > (MAX_INTERVAL_DAYS * 24 * 60 * 60 * 1000)) {
    const error = new Error('INTERVAL_TOO_LARGE');
    (error as Error & { payload?: Record<string, unknown> }).payload = { error: 'INTERVAL_TOO_LARGE', message: 'Interval exceeds 14 days; please specify an end date/time.', personId };
    throw error;
  }
};

const asRuleV2List = (state: AppState): AvailabilityRuleV2[] => state.rules
  .filter((rule) => typeof (rule as AvailabilityRuleV2 & { startUtc?: string }).startUtc === 'string' && typeof (rule as AvailabilityRuleV2 & { endUtc?: string }).endUtc === 'string')
  .map((rule) => ({
    code: rule.code,
    personId: rule.personId,
    status: (rule as AvailabilityRule & { status?: 'available' | 'unavailable' }).status ?? (rule.kind === 'available' ? 'available' : 'unavailable'),
    startUtc: (rule as AvailabilityRuleV2 & { startUtc: string }).startUtc,
    endUtc: (rule as AvailabilityRuleV2 & { endUtc: string }).endUtc,
    timezone: rule.timezone,
    assumptions: (rule as AvailabilityRuleV2).assumptions ?? [],
    promptId: (rule as AvailabilityRuleV2).promptId,
    originalPrompt: (rule as AvailabilityRuleV2).originalPrompt
  }));

const toLegacyRule = (rule: AvailabilityRuleV2): AvailabilityRule => ({
  code: rule.code,
  personId: rule.personId,
  kind: rule.status,
  timezone: rule.timezone,
  desc: rule.originalPrompt,
  date: rule.startUtc.slice(0, 10),
  startTime: rule.startUtc.slice(11, 16),
  durationMins: Math.max(1, Math.round((new Date(rule.endUtc).getTime() - new Date(rule.startUtc).getTime()) / 60000)),
  ...(rule as unknown as Record<string, unknown>)
}) as AvailabilityRule;

export const prepareRuleDraftV2 = (state: AppState, incomingRules: Array<Omit<AvailabilityRuleV2, 'code' | 'startUtc' | 'endUtc' | 'assumptions'>>, context: ExecutionContext): RuleDraftResult => {
  const assumptions: string[] = [];
  let timezoneFallbackUsed = false;
  const converted = incomingRules.map((rule, index) => {
    const person = findPersonById(state, rule.personId);
    const resolvedTimezone = resolveRuleTimezone(rule.timezone, person?.timezone, context.timezoneName);
    timezoneFallbackUsed ||= resolvedTimezone.fallbackUsed;
    if (resolvedTimezone.assumption) assumptions.push(resolvedTimezone.assumption);
    const interval = toUtcFromLocal((rule as AvailabilityRule & { date: string }).date, (rule as AvailabilityRule).startTime, (rule as AvailabilityRule).durationMins, resolvedTimezone.timezone);
    assertMaxInterval(interval.startUtc, interval.endUtc, rule.personId);
    return { ...rule, code: `DRAFT-${index + 1}`, startUtc: interval.startUtc, endUtc: interval.endUtc, timezone: resolvedTimezone.timezone, assumptions: resolvedTimezone.assumption ? [resolvedTimezone.assumption] : [] };
  });

  const draftRules = normalizeRulesV2(converted);
  const existing = asRuleV2List(state);
  const warnings: RuleDraftWarning[] = [];
  for (const draftRule of draftRules) {
    const overlapsExisting = existing.filter((rule) => rule.personId === draftRule.personId)
      .filter((rule) => new Date(draftRule.startUtc).getTime() < new Date(rule.endUtc).getTime() && new Date(draftRule.endUtc).getTime() > new Date(rule.startUtc).getTime());
    overlapsExisting.forEach((conflict) => warnings.push({
      code: conflict.code,
      status: conflict.status,
      interval: `${conflict.startUtc} → ${conflict.endUtc}`,
      message: `Overlaps an existing ${conflict.status.toUpperCase()} rule; UNAVAILABLE will take precedence in status computation.`
    }));
  }

  return { draftRules, preview: draftRules.map((rule) => `${rule.status.toUpperCase()} ${rule.startUtc} → ${rule.endUtc}`), assumptions: [...new Set(assumptions)], warnings, promptId: incomingRules[0]?.promptId ?? `prompt-${Date.now()}`, timezoneFallbackUsed };
};

export const confirmRuleDraftV2 = (state: AppState, incomingRules: Array<Omit<AvailabilityRuleV2, 'code' | 'startUtc' | 'endUtc' | 'assumptions'>>, options: { context: ExecutionContext }): RuleConfirmResult => {
  const draft = prepareRuleDraftV2(state, incomingRules, options.context);
  const nextState = normalizeAppState(structuredClone(state));
  const personIds = [...new Set(draft.draftRules.map((rule) => rule.personId))];
  const unchangedRules = nextState.rules.filter((rule) => !personIds.includes(rule.personId) || !(rule as AvailabilityRuleV2).startUtc || !(rule as AvailabilityRuleV2).endUtc);

  const hasOverlapUtc = (a: AvailabilityRuleV2, b: AvailabilityRuleV2): boolean => new Date(a.startUtc).getTime() < new Date(b.endUtc).getTime() && new Date(a.endUtc).getTime() > new Date(b.startUtc).getTime();

  const capCheck = personIds.map((personId) => {
    const existingPersonRules = asRuleV2List(nextState).filter((rule) => rule.personId === personId);
    const incomingPersonRules = draft.draftRules.filter((rule) => rule.personId === personId);
    const nonOverlappingExisting = existingPersonRules.filter((existing) => !incomingPersonRules.some((incoming) => hasOverlapUtc(existing, incoming)));
    const normalizedPerson = normalizeRulesV2([...nonOverlappingExisting, ...incomingPersonRules]);
    return { personId, existingCount: existingPersonRules.length, incomingCount: incomingPersonRules.length, total: normalizedPerson.length };
  });

  const overLimit = capCheck.find((entry) => entry.total > RULE_LIMIT_PER_PERSON);
  if (overLimit) {
    const error = new Error('RULE_LIMIT_EXCEEDED');
    (error as Error & { payload?: Record<string, unknown> }).payload = { error: 'RULE_LIMIT_EXCEEDED', message: 'Max 20 rules per person. Please delete or consolidate rules.', personId: overLimit.personId, limit: RULE_LIMIT_PER_PERSON };
    throw error;
  }

  for (const personId of personIds) {
    const existingPersonRules = asRuleV2List(nextState).filter((rule) => rule.personId === personId);
    const incomingPersonRules = draft.draftRules.filter((rule) => rule.personId === personId);
    const nonOverlappingExisting = existingPersonRules.filter((existing) => !incomingPersonRules.some((incoming) => hasOverlapUtc(existing, incoming)));
    const normalizedPerson = normalizeRulesV2([...nonOverlappingExisting, ...incomingPersonRules]);
    normalizedPerson.forEach((rule) => {
      unchangedRules.push(toLegacyRule({ ...rule, code: getNextRuleCode({ ...nextState, rules: unchangedRules }) }));
    });
  }

  nextState.rules = unchangedRules;
  return { nextState, inserted: draft.draftRules.length, normalizedCount: draft.draftRules.length, assumptions: draft.assumptions, timezoneFallbackUsed: draft.timezoneFallbackUsed, capCheck };
};


export const executeActions = async (state: AppState, actions: Action[], context: ExecutionContext): Promise<ExecuteActionsResult> => {
  const nextState = normalizeAppState(structuredClone(state));
  const effectsTextLines: string[] = [];
  let appliedAll = true;
  let nextActivePersonId = context.activePersonId;

  for (const action of actions) {
    if (action.type === 'reset_state') {
      const reset = createEmptyAppState();
      nextState.people = reset.people; nextState.appointments = reset.appointments; nextState.rules = reset.rules; nextActivePersonId = null;
      effectsTextLines.push('State reset.');
      continue;
    }

    if (action.type === 'add_person') {
      if (action.name.trim().length > 60 || !ensureNameUnique(nextState, action.name)) { effectsTextLines.push(`Cannot add person: duplicate/invalid name ${action.name}.`); appliedAll = false; continue; }
      const activeCount = nextState.people.filter((person) => person.status === 'active').length;
      if (activeCount >= 10) { effectsTextLines.push('Cannot add person: active people limit (10) reached.'); appliedAll = false; continue; }
      try {
        const phone = validateAndNormalizePhone(action.cell);
        if (!ensureCellUnique(nextState, phone.e164)) { effectsTextLines.push(`Cannot add person: phone ${phone.e164} already in use.`); appliedAll = false; continue; }
        const personId = getNextPersonId(nextState);
        nextState.people.push({ personId, name: normalizePersonValue(action.name), cellE164: phone.e164, cellDisplay: phone.display, status: 'active', timezone: action.timezone ?? context.timezoneName, notes: (action.notes ?? '').trim() });
        effectsTextLines.push(`Add person ${action.name} (${phone.e164}).`);
      } catch (error) {
        if (error instanceof PhoneValidationError) { effectsTextLines.push(`Cannot add person: ${error.message}`); appliedAll = false; continue; }
        throw error;
      }
      continue;
    }

    if (action.type === 'update_person') {
      const person = findPersonById(nextState, action.personId);
      if (!person) { effectsTextLines.push(`Not found: ${action.personId}`); appliedAll = false; continue; }
      const changes: string[] = [];
      if (action.name !== undefined) {
        if (action.name.trim().length > 60 || !ensureNameUnique(nextState, action.name, person.personId)) { effectsTextLines.push(`Cannot update person: duplicate/invalid name ${action.name}.`); appliedAll = false; continue; }
        person.name = normalizePersonValue(action.name); changes.push('name');
      }
      if (action.cell !== undefined) {
        try {
          const phone = validateAndNormalizePhone(action.cell);
          if (!ensureCellUnique(nextState, phone.e164, person.personId)) { effectsTextLines.push(`Cannot update person: phone ${phone.e164} already in use.`); appliedAll = false; continue; }
          person.cellE164 = phone.e164; person.cellDisplay = phone.display; changes.push('cell');
        } catch (error) {
          if (error instanceof PhoneValidationError) { effectsTextLines.push(`Cannot update person: ${error.message}`); appliedAll = false; continue; }
          throw error;
        }
      }
      if (action.timezone !== undefined) { person.timezone = action.timezone; changes.push('timezone'); }
      if (action.notes !== undefined) { person.notes = action.notes.trim(); changes.push('notes'); }
      effectsTextLines.push(`Update person ${person.name}: ${changes.join(', ') || 'no-op'}.`);
      continue;
    }

    if (action.type === 'deactivate_person' || action.type === 'reactivate_person') {
      const person = findPersonById(nextState, action.personId);
      if (!person) { effectsTextLines.push(`Not found: ${action.personId}`); appliedAll = false; continue; }
      person.status = action.type === 'deactivate_person' ? 'removed' : 'active';
      effectsTextLines.push(`${action.type === 'deactivate_person' ? 'Deactivate' : 'Reactivate'} person ${person.name}.`);
      continue;
    }

    if (action.type === 'add_rule') {
      const person = findPersonById(nextState, action.personId);
      if (!person) { effectsTextLines.push(`Not found: ${action.personId}`); appliedAll = false; continue; }
      const timezone = action.timezone ?? person.timezone ?? context.timezoneName;
      const newRule = { schemaVersion: 2, personId: action.personId, kind: action.kind, date: action.date, startTime: action.startTime, durationMins: action.startTime ? action.durationMins : undefined, timezone, desc: (action.desc ?? '').trim(), time: fromTimedFieldsToTimeSpec(action.date, action.startTime, action.durationMins, timezone) };
      if (newRule.time.intent.status !== 'resolved' || !newRule.time.resolved) { effectsTextLines.push('Rule time must be fully resolved before confirm.'); appliedAll = false; continue; }
      const newBounds = intervalBounds({ date: newRule.date, startTime: newRule.startTime, durationMins: newRule.startTime ? newRule.durationMins : undefined });
      const conflicts = nextState.rules
        .filter((rule) => rule.personId === action.personId && rule.date === action.date)
        .filter((rule) => rule.kind !== action.kind)
        .filter((rule) => overlaps(newBounds, intervalBounds({ date: rule.date, startTime: rule.startTime, durationMins: rule.startTime ? rule.durationMins : undefined })));

      if (conflicts.length > 0) {
        nextState.rules = nextState.rules.filter((rule) => !conflicts.some((conflict) => conflict.code === rule.code));
        effectsTextLines.push(`This will remove ${conflicts.length} conflicting rule(s).`);
        conflicts.forEach((conflict) => {
          effectsTextLines.push(`Remove conflicting ${conflict.kind.toUpperCase()} rule ${conflict.code} for ${person.name} on ${describeTime(conflict.date, conflict.startTime, conflict.durationMins)}.`);
        });
      }

      const code = getNextRuleCode(nextState);
      nextState.rules.push({ code, ...newRule });
      effectsTextLines.push(`Add ${action.kind.toUpperCase()} rule for ${person.name} on ${describeTime(newRule.date, newRule.startTime, newRule.durationMins)}.`);
      continue;
    }

    if (action.type === 'delete_rule') {
      const index = nextState.rules.findIndex((rule) => normalizeCode(rule.code) === normalizeCode(action.code));
      if (index < 0) { effectsTextLines.push(`Not found: ${action.code}`); appliedAll = false; continue; }
      const [removed] = nextState.rules.splice(index, 1);
      effectsTextLines.push(`Deleted ${removed.code}.`);
      continue;
    }

    if (action.type === 'create_blank_appointment') {
      const code = getNextAppointmentCode(nextState);
      const date = todayIsoDate();
      nextState.appointments.push({ id: `${Date.now()}-${code}`, schemaVersion: 2, updatedAt: new Date().toISOString(), code, title: '', time: { intent: { status: 'unresolved', originalText: '', missing: ['date'] } }, start: undefined, end: undefined, isAllDay: true, date, startTime: undefined, durationMins: undefined, timezone: context.timezoneName, assigned: [], people: [], location: '', locationRaw: '', locationDisplay: '', locationMapQuery: '', locationName: '', locationAddress: '', locationDirections: '', notes: '' });
      effectsTextLines.push(`Added ${code} — blank appointment on ${date} (all day)`);
      continue;
    }

    if (action.type === 'add_appointment') {
      const code = getNextAppointmentCode(nextState); const timezone = action.timezone ?? context.timezoneName; const resolved = resolveAppointmentTimes(action.date, action.startTime, action.durationMins, timezone);
      const resolvedPeople = resolvePeopleRefs(nextState, action.people ?? []);
      nextState.appointments.push({ id: `${Date.now()}-${code}`, schemaVersion: 2, updatedAt: new Date().toISOString(), code, title: action.desc, time: fromTimedFieldsToTimeSpec(action.date, action.startTime, action.durationMins, timezone), start: resolved.startIso, end: resolved.endIso, isAllDay: resolved.isAllDay, date: action.date, startTime: action.startTime, durationMins: action.startTime ? action.durationMins : undefined, timezone, assigned: resolvedPeople.ids, people: resolvedPeople.ids, location: '', locationRaw: '', locationDisplay: '', locationMapQuery: '', locationName: '', locationAddress: '', locationDirections: '', notes: '' });
      applyAppointmentLocation(nextState.appointments[nextState.appointments.length - 1], action.location ?? '');
      effectsTextLines.push(`Added ${code} — ${action.desc} on ${describeTime(action.date, action.startTime, action.durationMins)}`);
      continue;
    }

    if (action.type === 'delete_appointment') {
      const index = nextState.appointments.findIndex((item) => normalizeCode(item.code) === normalizeCode(action.code));
      if (index === -1) { effectsTextLines.push(`Not found: ${action.code}`); appliedAll = false; continue; }
      const [removed] = nextState.appointments.splice(index, 1); effectsTextLines.push(`Deleted ${removed.code} — ${removed.title}`); continue;
    }

    if (action.type === 'update_appointment_desc' || action.type === 'set_appointment_desc' || action.type === 'reschedule_appointment' || action.type === 'set_appointment_date' || action.type === 'set_appointment_start_time' || action.type === 'set_appointment_duration' || action.type === 'set_appointment_location' || action.type === 'set_appointment_notes' || action.type === 'add_people_to_appointment' || action.type === 'remove_people_from_appointment' || action.type === 'replace_people_on_appointment' || action.type === 'clear_people_on_appointment') {
      const appointment = findAppointmentByCode(nextState, 'code' in action ? action.code : '');
      if (!appointment) { effectsTextLines.push(`Not found: ${'code' in action ? action.code : ''}`); appliedAll = false; continue; }

      if (action.type === 'update_appointment_desc' || action.type === 'set_appointment_desc') { appointment.updatedAt = new Date().toISOString(); appointment.title = action.desc.trim(); effectsTextLines.push(`Updated ${appointment.code} — ${appointment.title}`); continue; }
      if (action.type === 'reschedule_appointment') { const timezone = action.timezone ?? context.timezoneName; const resolved = resolveAppointmentTimes(action.date, action.startTime, action.durationMins, timezone); appointment.schemaVersion = 2; appointment.time = fromTimedFieldsToTimeSpec(action.date, action.startTime, action.durationMins, timezone); appointment.updatedAt = new Date().toISOString(); appointment.date = action.date; appointment.startTime = action.startTime; appointment.durationMins = action.startTime ? action.durationMins : undefined; appointment.timezone = timezone; appointment.isAllDay = resolved.isAllDay; appointment.start = resolved.startIso; appointment.end = resolved.endIso; effectsTextLines.push(`Rescheduled ${appointment.code} — ${appointment.title} to ${describeTime(action.date, action.startTime, action.durationMins)}`); continue; }
      if (action.type === 'set_appointment_date') { const timezone = appointment.time?.resolved?.timezone ?? appointment.timezone ?? context.timezoneName; appointment.schemaVersion = 2; appointment.time = parseTimeSpec({ originalText: action.date, timezone }); appointment.updatedAt = new Date().toISOString(); appointment.date = action.date; appointment.startTime = undefined; appointment.durationMins = undefined; appointment.start = appointment.time.resolved?.startUtc; appointment.end = appointment.time.resolved?.endUtc; appointment.isAllDay = appointment.time.intent.status === 'resolved'; effectsTextLines.push(`Set date for ${appointment.code} to ${action.date}.`); continue; }
      if (action.type === 'set_appointment_start_time') { const timezone = appointment.time?.resolved?.timezone ?? appointment.timezone ?? context.timezoneName; const date = (appointment.time?.resolved?.startUtc ?? appointment.start)?.slice(0, 10) ?? appointment.date ?? todayIsoDate(); const duration = appointment.durationMins; appointment.schemaVersion = 2; appointment.time = fromTimedFieldsToTimeSpec(date, action.startTime, duration, timezone); appointment.updatedAt = new Date().toISOString(); appointment.date = date; appointment.startTime = action.startTime; appointment.durationMins = action.startTime ? duration : undefined; appointment.start = appointment.time.resolved?.startUtc; appointment.end = appointment.time.resolved?.endUtc; appointment.isAllDay = !action.startTime; effectsTextLines.push(`Set start time for ${appointment.code}.`); continue; }
      if (action.type === 'set_appointment_duration') { const timezone = appointment.time?.resolved?.timezone ?? appointment.timezone ?? context.timezoneName; const date = (appointment.time?.resolved?.startUtc ?? appointment.start)?.slice(0, 10) ?? appointment.date ?? todayIsoDate(); const startTime = appointment.time?.resolved?.startUtc ? appointment.time.resolved.startUtc.slice(11,16) : appointment.startTime; appointment.schemaVersion = 2; appointment.time = fromTimedFieldsToTimeSpec(date, startTime, action.durationMins, timezone); appointment.updatedAt = new Date().toISOString(); appointment.date = date; appointment.startTime = startTime; appointment.durationMins = action.durationMins; appointment.start = appointment.time.resolved?.startUtc; appointment.end = appointment.time.resolved?.endUtc; appointment.isAllDay = !startTime; effectsTextLines.push(`Set duration for ${appointment.code}.`); continue; }
      if (action.type === 'set_appointment_location') { await applyAppointmentLocation(appointment, action.locationRaw ?? action.location ?? ''); effectsTextLines.push('Set location updated.'); continue; }
      if (action.type === 'set_appointment_notes') { appointment.notes = action.notes.trim(); effectsTextLines.push('Set notes updated.'); continue; }

      if (action.type === 'clear_people_on_appointment') {
        appointment.people = []; appointment.assigned = []; effectsTextLines.push(`Clear people on ${appointment.code} — ${appointment.title}.`); continue;
      }

      const refs = action.type === 'replace_people_on_appointment' ? action.people : action.people;
      const resolvedPeople = resolvePeopleRefs(nextState, refs);
      if (action.type === 'replace_people_on_appointment') appointment.people = resolvedPeople.ids;
      if (action.type === 'add_people_to_appointment') appointment.people = [...new Set([...appointment.people, ...resolvedPeople.ids])];
      if (action.type === 'remove_people_from_appointment') appointment.people = appointment.people.filter((id) => !resolvedPeople.ids.some((candidate) => normalizeName(candidate) === normalizeName(id)));
      appointment.assigned = [...appointment.people];

      const warningPeople = appointment.people
        .map((personId) => ({ personId, status: computePersonStatusForInterval(personId, { date: appointment.date ?? '', startTime: appointment.startTime, durationMins: appointment.durationMins }, nextState.rules), name: findPersonById(nextState, personId)?.name ?? personId }))
        .filter((entry) => entry.status.status === 'unavailable');
      effectsTextLines.push(`Set people on ${appointment.code} — ${appointment.title}.`);
      warningPeople.forEach((entry) => effectsTextLines.push(`Warning: ${entry.name} is marked UNAVAILABLE during this appointment.`));
      continue;
    }

    if (action.type === 'set_identity') {
      const person = findPersonByName(nextState, action.name);
      if (!person) { effectsTextLines.push(`Unknown person for identity: ${action.name}`); appliedAll = false; continue; }
      nextActivePersonId = person.personId; effectsTextLines.push(`Got it. You are ${person.name}.`); continue;
    }

    if (action.type === 'list_appointments') { effectsTextLines.push(nextState.appointments.length > 0 ? nextState.appointments.map((a) => `${a.code} — ${a.title}`).join('\n') : '(none)'); continue; }
    if (action.type === 'show_appointment') { const appointment = findAppointmentByCode(nextState, action.code); effectsTextLines.push(appointment ? `${appointment.code} — ${appointment.title}` : `Not found: ${action.code}`); continue; }
    if (action.type === 'list_people') { effectsTextLines.push(nextState.people.length ? nextState.people.map((p) => `${p.personId} — ${p.name} (${p.status})`).join('\n') : '(none)'); continue; }
    if (action.type === 'show_person') { const person = findPersonById(nextState, action.personId); effectsTextLines.push(person ? `${person.personId} — ${person.name}` : `Not found: ${action.personId}`); continue; }
    if (action.type === 'list_rules') { const rules = action.personId ? nextState.rules.filter((r) => r.personId === action.personId) : nextState.rules; effectsTextLines.push(rules.length ? rules.map((r) => `${r.code} — ${r.personId} ${r.kind} ${describeTime(r.date, r.startTime, r.durationMins)}`).join('\n') : '(none)'); continue; }
    if (action.type === 'show_rule') { const rule = findRuleByCode(nextState, action.code); effectsTextLines.push(rule ? `${rule.code} — ${rule.kind}` : `Not found: ${action.code}`); continue; }
    if (action.type === 'help') { effectsTextLines.push('Try commands: add person, add appointment, add rule, list appointments, list people.'); continue; }
  }

  return { nextState: normalizeAppState(nextState), effectsTextLines, appliedAll, nextActivePersonId };
};
