import { createEmptyAppState, type AppState, type Appointment, type AvailabilityBlock, type Person, normalizeAppState } from '../state.js';
import type { Action } from './schema.js';

export type ExecutionContext = {
  activePersonId: string | null;
  timezoneName: string;
};

export type ExecuteActionsResult = {
  nextState: AppState;
  effectsTextLines: string[];
  appliedAll: boolean;
  nextActivePersonId: string | null;
};

export type ResolvedAppointmentTimes = {
  startIso?: string;
  endIso?: string;
  isAllDay: boolean;
};

const normalizeCode = (value: string): string => value.trim().toUpperCase();
const normalizeName = (value: string): string => value.trim().replace(/\s+/g, ' ').toLowerCase();
const normalizePersonValue = (value: string): string => value.trim().replace(/\s+/g, ' ');
const parseStoredDateTime = (value: string): Date => new Date(value);

const findAppointmentByCode = (state: AppState, inputCode: string): Appointment | undefined => state.appointments.find((item) => normalizeCode(item.code) === normalizeCode(inputCode));
const findAvailabilityByCode = (state: AppState, inputCode: string): AvailabilityBlock | undefined => state.availability.find((item) => normalizeCode(item.code) === normalizeCode(inputCode));
const findPersonByName = (state: AppState, name: string): Person | undefined => state.people.find((person) => normalizeName(person.name) === normalizeName(name));

const ensurePersonByName = (state: AppState, name: string): Person => {
  const existing = findPersonByName(state, name);
  if (existing) return existing;
  const normalized = normalizePersonValue(name);
  const idToken = normalizeName(name).replace(/\s+/g, '-');
  const created: Person = { id: `person-${idToken}`, name: normalized };
  state.people.push(created);
  return created;
};

const getPersonDisplayName = (state: AppState, personId: string): string => state.people.find((person) => person.id === personId)?.name ?? personId;
const formatDate = (value: string): string => {
  const date = parseStoredDateTime(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
};
const formatTime = (value: string): string => {
  const match = value.match(/T(\d{2}:\d{2})/);
  if (match) return match[1];
  const date = parseStoredDateTime(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`;
};
const formatDateTimeRange = (start: string, end: string): string => `${formatDate(start)} ${formatTime(start)}–${formatTime(end)}`;
const overlaps = (startA: Date, endA: Date, startB: Date, endB: Date): boolean => startA < endB && endA > startB;

const getNextAppointmentCode = (state: AppState): string => `APPT-${state.appointments.reduce((max, appointment) => {
  const match = appointment.code.match(/^APPT-(\d+)$/i);
  return match ? Math.max(max, Number(match[1])) : max;
}, 0) + 1}`;

const createAvailabilityCode = (state: AppState, name: string): string => {
  const nameToken = name.toUpperCase().replace(/[^A-Z0-9]+/g, '') || 'PERSON';
  const maxCodeValue = state.availability.reduce((maxValue, block) => {
    const match = block.code.match(new RegExp(`^AVL-${nameToken}-(\\d+)$`, 'i'));
    return match ? Math.max(maxValue, Number(match[1])) : maxValue;
  }, 0);
  return `AVL-${nameToken}-${maxCodeValue + 1}`;
};

const parseWhoIsAvailableRange = (action: Extract<Action, { type: 'who_is_available' }>): { start: Date; end: Date } | null => {
  if (action.month) {
    const [year, month] = action.month.split('-').map(Number);
    return { start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)), end: new Date(Date.UTC(year, month, 0, 23, 59, 59)) };
  }
  if (action.start && action.end) {
    const start = new Date(`${action.start}T00:00:00-08:00`);
    const end = new Date(`${action.end}T23:59:59-08:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return null;
    return { start, end };
  }
  return null;
};

const getTimeZoneOffset = (date: Date, timeZone: string): string => {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' });
  const zonePart = formatter.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value ?? 'GMT-08:00';
  const match = zonePart.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return '-08:00';
  return `${match[1]}${match[2].padStart(2, '0')}:${(match[3] ?? '00').padStart(2, '0')}`;
};

const buildIsoAtZone = (date: string, startTime: string, timezone: string): string => {
  const asUtc = new Date(`${date}T${startTime}:00Z`);
  return `${date}T${startTime}:00${getTimeZoneOffset(asUtc, timezone)}`;
};

export const resolveAppointmentTimes = (date: string, startTime?: string, durationMins?: number, timezone = 'America/Los_Angeles'): ResolvedAppointmentTimes => {
  if (!startTime) return { isAllDay: true };
  const startIso = buildIsoAtZone(date, startTime, timezone);
  const endIso = new Date(new Date(startIso).getTime() + (durationMins ?? 60) * 60_000).toISOString();
  return { startIso, endIso, isAllDay: false };
};

const describeTime = (date: string, startTime?: string, durationMins?: number): string => (!startTime ? `${date} (all day)` : `${date} ${startTime} (${durationMins ?? 60}m)`);

const toUniquePeople = (people: string[]): string[] => {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const raw of people) {
    const person = normalizePersonValue(raw);
    const key = person.toLowerCase();
    if (!person || seen.has(key)) continue;
    seen.add(key);
    unique.push(person);
  }
  return unique;
};

export const executeActions = (state: AppState, actions: Action[], context: ExecutionContext): ExecuteActionsResult => {
  const nextState = normalizeAppState(structuredClone(state));
  const effectsTextLines: string[] = [];
  let appliedAll = true;
  let nextActivePersonId = context.activePersonId;

  for (const action of actions) {
    if (action.type === 'reset_state') {
      const reset = createEmptyAppState();
      nextState.people = reset.people;
      nextState.appointments = reset.appointments;
      nextState.availability = reset.availability;
      nextActivePersonId = null;
      effectsTextLines.push('State reset.');
      continue;
    }

    if (action.type === 'add_appointment') {
      const code = getNextAppointmentCode(nextState);
      const timezone = action.timezone ?? context.timezoneName;
      const resolved = resolveAppointmentTimes(action.date, action.startTime, action.durationMins, timezone);
      nextState.appointments.push({
        id: `${Date.now()}-${code}`,
        code,
        title: action.desc,
        start: resolved.startIso,
        end: resolved.endIso,
        isAllDay: resolved.isAllDay,
        date: action.date,
        startTime: action.startTime,
        durationMins: action.startTime ? (action.durationMins ?? 60) : undefined,
        timezone,
        assigned: [],
        people: toUniquePeople(action.people ?? []),
        location: (action.location ?? '').trim()
      });
      effectsTextLines.push(`Added ${code} — ${action.desc} on ${describeTime(action.date, action.startTime, action.durationMins)}`);
      continue;
    }

    if (action.type === 'delete_appointment') {
      const index = nextState.appointments.findIndex((item) => normalizeCode(item.code) === normalizeCode(action.code));
      if (index === -1) {
        effectsTextLines.push(`Not found: ${action.code}`);
        appliedAll = false;
        continue;
      }
      const [removed] = nextState.appointments.splice(index, 1);
      effectsTextLines.push(`Deleted ${removed.code} — ${removed.title}`);
      continue;
    }

    if (action.type === 'update_appointment_desc') {
      const appointment = findAppointmentByCode(nextState, action.code);
      if (!appointment) {
        effectsTextLines.push(`Not found: ${action.code}`);
        appliedAll = false;
        continue;
      }
      appointment.title = action.desc;
      effectsTextLines.push(`Updated ${appointment.code} — ${appointment.title}`);
      continue;
    }

    if (action.type === 'reschedule_appointment') {
      const appointment = findAppointmentByCode(nextState, action.code);
      if (!appointment) {
        effectsTextLines.push(`Not found: ${action.code}`);
        appliedAll = false;
        continue;
      }
      const timezone = action.timezone ?? context.timezoneName;
      const resolved = resolveAppointmentTimes(action.date, action.startTime, action.durationMins, timezone);
      appointment.date = action.date;
      appointment.startTime = action.startTime;
      appointment.durationMins = action.startTime ? (action.durationMins ?? 60) : undefined;
      appointment.timezone = timezone;
      appointment.isAllDay = resolved.isAllDay;
      appointment.start = resolved.startIso;
      appointment.end = resolved.endIso;
      effectsTextLines.push(`Rescheduled ${appointment.code} — ${appointment.title} to ${describeTime(action.date, action.startTime, action.durationMins)}`);
      continue;
    }

    if (action.type === 'add_people_to_appointment' || action.type === 'remove_people_from_appointment' || action.type === 'replace_people_on_appointment' || action.type === 'clear_people_on_appointment') {
      const appointment = findAppointmentByCode(nextState, action.code);
      if (!appointment) {
        effectsTextLines.push(`Not found: ${action.code}`);
        appliedAll = false;
        continue;
      }

      if (action.type === 'add_people_to_appointment') {
        appointment.people = appointment.people ?? [];
        const existing = new Set(appointment.people.map((person) => person.toLowerCase()));
        const additions: string[] = [];
        for (const person of toUniquePeople(action.people)) {
          if (existing.has(person.toLowerCase())) continue;
          appointment.people.push(person);
          additions.push(person);
          existing.add(person.toLowerCase());
        }
        effectsTextLines.push(`Add people [${toUniquePeople(action.people).join(', ')}] to ${appointment.code} — ${appointment.title}.`);
        continue;
      }

      if (action.type === 'remove_people_from_appointment') {
        const toRemove = new Set(toUniquePeople(action.people).map((person) => person.toLowerCase()));
        appointment.people = appointment.people.filter((person) => !toRemove.has(person.toLowerCase()));
        effectsTextLines.push(`Remove people [${toUniquePeople(action.people).join(', ')}] from ${appointment.code} — ${appointment.title}.`);
        continue;
      }

      if (action.type === 'replace_people_on_appointment') {
        const nextPeople = toUniquePeople(action.people);
        appointment.people = nextPeople;
        effectsTextLines.push(nextPeople.length > 0
          ? `Set people on ${appointment.code} — ${appointment.title} to [${nextPeople.join(', ')}].`
          : `Clear people on ${appointment.code} — ${appointment.title}.`);
        continue;
      }

      appointment.people = [];
      effectsTextLines.push(`Clear people on ${appointment.code} — ${appointment.title}.`);
      continue;
    }

    if (action.type === 'set_appointment_location') {
      const appointment = findAppointmentByCode(nextState, action.code);
      if (!appointment) {
        effectsTextLines.push(`Not found: ${action.code}`);
        appliedAll = false;
        continue;
      }
      appointment.location = action.location.trim();
      effectsTextLines.push(appointment.location
        ? `Set location on ${appointment.code} — ${appointment.title} to “${appointment.location}”.`
        : `Clear location on ${appointment.code} — ${appointment.title}.`);
      continue;
    }

    if (action.type === 'add_availability') {
      const person = ensurePersonByName(nextState, action.personName);
      const code = createAvailabilityCode(nextState, person.name);
      const timezone = action.timezone ?? context.timezoneName;
      const resolved = resolveAppointmentTimes(action.date, action.startTime, action.durationMins, timezone);
      nextState.availability.push({
        id: `${Date.now()}-${code}`,
        code,
        personId: person.id,
        start: resolved.startIso,
        end: resolved.endIso,
        date: action.date,
        startTime: action.startTime,
        durationMins: action.startTime ? (action.durationMins ?? 60) : undefined,
        timezone,
        isAllDay: resolved.isAllDay,
        reason: action.desc
      });
      effectsTextLines.push(`Added ${code} — ${person.name} ${describeTime(action.date, action.startTime, action.durationMins)} (${action.desc})`);
      continue;
    }

    if (action.type === 'delete_availability') {
      const index = nextState.availability.findIndex((item) => normalizeCode(item.code) === normalizeCode(action.code));
      if (index === -1) {
        effectsTextLines.push(`Not found: ${action.code}`);
        appliedAll = false;
        continue;
      }
      const [removed] = nextState.availability.splice(index, 1);
      effectsTextLines.push(`Deleted ${removed.code} — ${getPersonDisplayName(nextState, removed.personId)} ${removed.date ?? formatDateTimeRange(removed.start ?? '', removed.end ?? '')}`);
      continue;
    }

    if (action.type === 'set_identity') {
      const person = ensurePersonByName(nextState, action.name);
      nextActivePersonId = person.id;
      effectsTextLines.push(`Got it. You are ${person.name}.`);
      continue;
    }

    if (action.type === 'list_appointments') {
      effectsTextLines.push(nextState.appointments.length > 0 ? nextState.appointments.map((appointment) => `${appointment.code} — ${appointment.title}`).join('\n') : '(none)');
      continue;
    }

    if (action.type === 'show_appointment') {
      const appointment = findAppointmentByCode(nextState, action.code);
      effectsTextLines.push(appointment
        ? `${appointment.code} — ${appointment.title}\nid: ${appointment.id}\nstart: ${appointment.start ?? '(none)'}\nend: ${appointment.end ?? '(none)'}\npeople: ${appointment.people.length > 0 ? appointment.people.join(', ') : '(none)'}\nlocation: ${appointment.location || '(none)'}`
        : `Not found: ${action.code}`);
      continue;
    }

    if (action.type === 'list_availability') {
      const person = action.personName ? findPersonByName(nextState, action.personName) : undefined;
      const blocks = person ? nextState.availability.filter((block) => block.personId === person.id) : nextState.availability;
      effectsTextLines.push(blocks.length > 0
        ? blocks.sort((a, b) => parseStoredDateTime(a.start ?? '').getTime() - parseStoredDateTime(b.start ?? '').getTime()).map((block) => `${block.code} — ${getPersonDisplayName(nextState, block.personId)} ${block.date ?? formatDateTimeRange(block.start ?? '', block.end ?? '')}${block.reason ? ` (${block.reason})` : ''}`).join('\n')
        : '(none)');
      continue;
    }

    if (action.type === 'show_availability') {
      const block = findAvailabilityByCode(nextState, action.code);
      effectsTextLines.push(block ? `${block.code} — ${getPersonDisplayName(nextState, block.personId)}\nid: ${block.id}\nstart: ${block.start ?? '(none)'}\nend: ${block.end ?? '(none)'}\nreason: ${block.reason ?? '(none)'}` : `Not found: ${action.code}`);
      continue;
    }

    if (action.type === 'who_is_available') {
      const range = parseWhoIsAvailableRange(action);
      if (!range) {
        effectsTextLines.push('Please provide month (YYYY-MM) or start/end dates (YYYY-MM-DD).');
        appliedAll = false;
        continue;
      }
      const lines: string[] = [];
      nextState.people.forEach((person) => {
        const blocks = nextState.availability.filter((block) => block.personId === person.id).filter((block) => block.start && block.end).filter((block) => overlaps(parseStoredDateTime(block.start as string), parseStoredDateTime(block.end as string), range.start, range.end));
        lines.push(`${person.name}: ${blocks.length} unavailable block(s)`);
      });
      effectsTextLines.push(lines.length > 0 ? lines.join('\n') : '(none)');
      continue;
    }

    if (action.type === 'help') effectsTextLines.push('Try commands: add appt <desc> <date>, list appointments, list availability, show <CODE>, delete <CODE>.');
  }

  return { nextState: normalizeAppState(nextState), effectsTextLines, appliedAll, nextActivePersonId };
};
