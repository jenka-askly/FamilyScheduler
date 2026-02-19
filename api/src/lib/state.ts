export type Person = {
  personId: string;
  name: string;
  cellE164: string;
  cellDisplay?: string;
  status: 'active' | 'inactive';
  timezone?: string;
  notes?: string;
};

export type Appointment = {
  id: string;
  code: string;
  title: string;
  start?: string;
  end?: string;
  date?: string;
  startTime?: string;
  durationMins?: number;
  timezone?: string;
  isAllDay?: boolean;
  assigned: string[];
  people: string[];
  location: string;
  notes: string;
};

export type AvailabilityRule = {
  code: string;
  personId: string;
  kind: 'available' | 'unavailable';
  date: string;
  startTime?: string;
  durationMins?: number;
  timezone?: string;
  desc?: string;
};

export type AppState = {
  version: number;
  people: Person[];
  appointments: Appointment[];
  rules: AvailabilityRule[];
  history: string[];
};

const DEFAULT_TZ = 'America/Los_Angeles';

export const createEmptyAppState = (): AppState => ({
  version: 2,
  people: [],
  appointments: [],
  rules: [],
  history: []
});

const normalizeText = (value: string): string => value.trim().replace(/\s+/g, ' ');
const normalizePeople = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const person = normalizeText(item);
    if (!person) continue;
    const key = person.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(person);
  }
  return normalized;
};

const toPersonId = (name: string, index: number): string => {
  const token = normalizeText(name).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `P-${token || index + 1}`;
};

const normalizePeopleCollection = (value: unknown): Person[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const people: Person[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const raw = value[i] as Record<string, unknown>;
    const name = typeof raw?.name === 'string' ? normalizeText(raw.name) : '';
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const legacyId = typeof raw?.id === 'string' ? raw.id : undefined;
    const personId = typeof raw?.personId === 'string' ? raw.personId : legacyId ? `P-${legacyId.replace(/^person-/i, '').toUpperCase()}` : toPersonId(name, i);
    const status = raw?.status === 'inactive' ? 'inactive' : 'active';
    const cellE164 = typeof raw?.cellE164 === 'string' && raw.cellE164.trim() ? raw.cellE164.trim() : '+10000000000';
    const cellDisplay = typeof raw?.cellDisplay === 'string' && raw.cellDisplay.trim() ? raw.cellDisplay.trim() : cellE164;
    const timezone = typeof raw?.timezone === 'string' && raw.timezone.trim() ? raw.timezone.trim() : DEFAULT_TZ;
    const notes = typeof raw?.notes === 'string' ? raw.notes.trim().slice(0, 500) : '';

    people.push({ personId, name, cellE164, cellDisplay, status, timezone, notes });
  }
  return people;
};

const normalizeRulesCollection = (stateLike: Record<string, unknown>, people: Person[]): AvailabilityRule[] => {
  const rawRules = Array.isArray(stateLike.rules) ? stateLike.rules : [];
  const legacyAvailability = Array.isArray(stateLike.availability) ? stateLike.availability : [];
  const merged = [...rawRules, ...legacyAvailability];
  const rules: AvailabilityRule[] = [];

  merged.forEach((entry, index) => {
    const raw = entry as Record<string, unknown>;
    const code = typeof raw.code === 'string' && raw.code.trim() ? raw.code.trim() : `RULE-${index + 1}`;
    const kind: 'available' | 'unavailable' = raw.kind === 'available' ? 'available' : 'unavailable';
    const date = typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : '';
    if (!date) return;

    let personId = typeof raw.personId === 'string' ? raw.personId : '';
    if (!personId && typeof raw.personName === 'string') {
      const personName = normalizeText(raw.personName);
      personId = people.find((person) => person.name.toLowerCase() === personName.toLowerCase())?.personId ?? '';
    }
    if (!personId && typeof raw.personId === 'string') personId = raw.personId;
    if (!personId) return;

    const startTime = typeof raw.startTime === 'string' && /^\d{2}:\d{2}$/.test(raw.startTime) ? raw.startTime : undefined;
    const durationMins = typeof raw.durationMins === 'number' && Number.isInteger(raw.durationMins) && raw.durationMins > 0 ? raw.durationMins : undefined;
    const timezone = typeof raw.timezone === 'string' && raw.timezone.trim() ? raw.timezone.trim() : DEFAULT_TZ;
    const desc = typeof raw.desc === 'string' ? raw.desc.trim() : typeof raw.reason === 'string' ? raw.reason.trim() : '';
    rules.push({ code, personId, kind, date, startTime, durationMins: startTime ? durationMins : undefined, timezone, desc });
  });

  return rules;
};

export const normalizeAppState = (state: AppState): AppState => {
  const stateLike = structuredClone(state) as unknown as Record<string, unknown>;
  const people = normalizePeopleCollection(stateLike.people);
  const normalizedAppointments = (Array.isArray(stateLike.appointments) ? stateLike.appointments : []).map((appointment, idx) => {
    const raw = appointment as Record<string, unknown>;
    const assigned = Array.isArray(raw.assigned) ? raw.assigned.filter((item): item is string => typeof item === 'string') : [];
    const peopleSource = Array.isArray(raw.people)
      ? raw.people
      : assigned.map((personId) => people.find((person) => person.personId === personId)?.name ?? personId);

    return {
      id: typeof raw.id === 'string' ? raw.id : `appt-${idx + 1}`,
      code: typeof raw.code === 'string' ? raw.code : `APPT-${idx + 1}`,
      title: typeof raw.title === 'string' ? normalizeText(raw.title) : '',
      start: typeof raw.start === 'string' ? raw.start : undefined,
      end: typeof raw.end === 'string' ? raw.end : undefined,
      date: typeof raw.date === 'string' ? raw.date : undefined,
      startTime: typeof raw.startTime === 'string' ? raw.startTime : undefined,
      durationMins: typeof raw.durationMins === 'number' ? raw.durationMins : undefined,
      timezone: typeof raw.timezone === 'string' ? raw.timezone : DEFAULT_TZ,
      isAllDay: Boolean(raw.isAllDay),
      assigned,
      people: normalizePeople(peopleSource),
      location: typeof raw.location === 'string' ? normalizeText(raw.location) : '',
      notes: typeof raw.notes === 'string' ? raw.notes.trim().slice(0, 500) : ''
    };
  });

  return {
    version: typeof stateLike.version === 'number' ? stateLike.version : 2,
    people,
    appointments: normalizedAppointments,
    rules: normalizeRulesCollection(stateLike, people),
    history: Array.isArray(stateLike.history) ? stateLike.history.filter((item): item is string => typeof item === 'string') : []
  };
};
