import { createEmptyAppState, type AppState, type Appointment, type AvailabilityRule, type Person, normalizeAppState } from '../state.js';
import { computePersonStatusForInterval } from '../availability/computeStatus.js';
import { intervalBounds, overlaps } from '../availability/interval.js';
import { PhoneValidationError, validateAndNormalizePhone } from '../validation/phone.js';
import type { Action } from './schema.js';
import { normalizeLocation } from '../location/normalize.js';

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
  const startIso = buildIsoAtZone(date, startTime, timezone);
  const endIso = new Date(new Date(startIso).getTime() + (durationMins ?? 60) * 60_000).toISOString();
  return { startIso, endIso, isAllDay: false };
};
const describeTime = (date: string, startTime?: string, durationMins?: number): string => (!startTime ? `${date} (all day)` : `${date} ${startTime} (${durationMins ?? 60}m)`);
const todayIsoDate = (): string => new Date().toISOString().slice(0, 10);

const applyAppointmentLocation = (appointment: Appointment, locationRawInput: string): void => {
  const locationRaw = locationRawInput;
  const normalized = normalizeLocation(locationRaw);
  appointment.locationRaw = locationRaw;
  appointment.locationDisplay = normalized.display;
  appointment.locationMapQuery = normalized.mapQuery;
  appointment.location = normalized.display;
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

export const executeActions = (state: AppState, actions: Action[], context: ExecutionContext): ExecuteActionsResult => {
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
      person.status = action.type === 'deactivate_person' ? 'inactive' : 'active';
      effectsTextLines.push(`${action.type === 'deactivate_person' ? 'Deactivate' : 'Reactivate'} person ${person.name}.`);
      continue;
    }

    if (action.type === 'add_rule') {
      const person = findPersonById(nextState, action.personId);
      if (!person) { effectsTextLines.push(`Not found: ${action.personId}`); appliedAll = false; continue; }
      const timezone = action.timezone ?? person.timezone ?? context.timezoneName;
      const newRule = { personId: action.personId, kind: action.kind, date: action.date, startTime: action.startTime, durationMins: action.startTime ? (action.durationMins ?? 60) : undefined, timezone, desc: (action.desc ?? '').trim() };
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
      nextState.appointments.push({ id: `${Date.now()}-${code}`, code, title: '', start: undefined, end: undefined, isAllDay: true, date, startTime: undefined, durationMins: undefined, timezone: context.timezoneName, assigned: [], people: [], location: '', locationRaw: '', locationDisplay: '', locationMapQuery: '', notes: '' });
      effectsTextLines.push(`Added ${code} — blank appointment on ${date} (all day)`);
      continue;
    }

    if (action.type === 'add_appointment') {
      const code = getNextAppointmentCode(nextState); const timezone = action.timezone ?? context.timezoneName; const resolved = resolveAppointmentTimes(action.date, action.startTime, action.durationMins, timezone);
      const resolvedPeople = resolvePeopleRefs(nextState, action.people ?? []);
      nextState.appointments.push({ id: `${Date.now()}-${code}`, code, title: action.desc, start: resolved.startIso, end: resolved.endIso, isAllDay: resolved.isAllDay, date: action.date, startTime: action.startTime, durationMins: action.startTime ? (action.durationMins ?? 60) : undefined, timezone, assigned: resolvedPeople.ids, people: resolvedPeople.ids, location: '', locationRaw: '', locationDisplay: '', locationMapQuery: '', notes: '' });
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

      if (action.type === 'update_appointment_desc' || action.type === 'set_appointment_desc') { appointment.title = action.desc.trim(); effectsTextLines.push(`Updated ${appointment.code} — ${appointment.title}`); continue; }
      if (action.type === 'reschedule_appointment') { const timezone = action.timezone ?? context.timezoneName; const resolved = resolveAppointmentTimes(action.date, action.startTime, action.durationMins, timezone); appointment.date = action.date; appointment.startTime = action.startTime; appointment.durationMins = action.startTime ? (action.durationMins ?? 60) : undefined; appointment.timezone = timezone; appointment.isAllDay = resolved.isAllDay; appointment.start = resolved.startIso; appointment.end = resolved.endIso; effectsTextLines.push(`Rescheduled ${appointment.code} — ${appointment.title} to ${describeTime(action.date, action.startTime, action.durationMins)}`); continue; }
      if (action.type === 'set_appointment_date') { const resolved = resolveAppointmentTimes(action.date, appointment.startTime, appointment.durationMins, appointment.timezone ?? context.timezoneName); appointment.date = action.date; appointment.isAllDay = resolved.isAllDay; appointment.start = resolved.startIso; appointment.end = resolved.endIso; effectsTextLines.push(`Set date for ${appointment.code} to ${action.date}.`); continue; }
      if (action.type === 'set_appointment_start_time') { const resolved = resolveAppointmentTimes(appointment.date ?? todayIsoDate(), action.startTime, appointment.durationMins, appointment.timezone ?? context.timezoneName); appointment.startTime = action.startTime; appointment.durationMins = action.startTime ? (appointment.durationMins ?? 60) : undefined; appointment.isAllDay = resolved.isAllDay; appointment.start = resolved.startIso; appointment.end = resolved.endIso; effectsTextLines.push(`Set start time for ${appointment.code}.`); continue; }
      if (action.type === 'set_appointment_duration') { const duration = appointment.startTime ? action.durationMins : undefined; const resolved = resolveAppointmentTimes(appointment.date ?? todayIsoDate(), appointment.startTime, duration, appointment.timezone ?? context.timezoneName); appointment.durationMins = duration; appointment.isAllDay = resolved.isAllDay; appointment.start = resolved.startIso; appointment.end = resolved.endIso; effectsTextLines.push(`Set duration for ${appointment.code}.`); continue; }
      if (action.type === 'set_appointment_location') { applyAppointmentLocation(appointment, action.locationRaw ?? action.location ?? ''); effectsTextLines.push('Set location updated.'); continue; }
      if (action.type === 'set_appointment_notes') { appointment.notes = action.notes.trim(); effectsTextLines.push('Set notes updated.'); continue; }

      if (action.type === 'clear_people_on_appointment') {
        appointment.people = []; appointment.assigned = []; effectsTextLines.push(`Clear people on ${appointment.code} — ${appointment.title}.`); continue;
      }

      const refs = action.type === 'replace_people_on_appointment' ? action.people : action.people;
      const resolvedPeople = resolvePeopleRefs(nextState, refs);
      if (action.type === 'replace_people_on_appointment') appointment.people = resolvedPeople.ids;
      if (action.type === 'add_people_to_appointment') appointment.people = [...new Set([...appointment.people, ...resolvedPeople.ids])];
      if (action.type === 'remove_people_from_appointment') appointment.people = appointment.people.filter((id) => !resolvedPeople.ids.includes(id));
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
