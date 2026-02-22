import type { TimeSpec } from '../../../packages/shared/src/types.js';
import { normalizeLocation } from './location/normalize.js';

export type Person = {
  personId: string;
  name: string;
  cellE164: string;
  cellDisplay?: string;
  status: 'active' | 'removed';
  createdAt?: string;
  lastSeen?: string;
  timezone?: string;
  notes?: string;
};

export type Appointment = {
  schemaVersion?: number;
  updatedAt?: string;
  time?: TimeSpec;
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
  locationRaw: string;
  locationDisplay: string;
  locationMapQuery: string;
  locationName: string;
  locationAddress: string;
  locationDirections: string;
  notes: string;
};

export type AvailabilityRule = {
  schemaVersion?: number;
  time?: TimeSpec;
  code: string;
  personId: string;
  kind: 'available' | 'unavailable';
  date: string;
  startTime?: string;
  durationMins?: number;
  timezone?: string;
  desc?: string;
  status?: 'available' | 'unavailable';
  startUtc?: string;
  endUtc?: string;
  promptId?: string;
  originalPrompt?: string;
  assumptions?: string[];
};

export type AppState = {
  schemaVersion: number;
  groupId: string;
  groupName: string;
  createdAt: string;
  updatedAt: string;
  people: Person[];
  appointments: Appointment[];
  rules: AvailabilityRule[];
  history: string[];
};

const DEFAULT_TZ = 'America/Los_Angeles';

export const createEmptyAppState = (groupId = 'default', groupName = 'Family Scheduler'): AppState => {
  const now = new Date().toISOString();
  return {
    schemaVersion: 3,
    groupId,
    groupName,
    createdAt: now,
    updatedAt: now,
    people: [],
    appointments: [],
    rules: [],
    history: []
  };
};

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
    const legacyId = typeof raw?.id === 'string' ? raw.id : undefined;
    const personId = typeof raw?.personId === 'string' ? raw.personId : legacyId ? `P-${legacyId.replace(/^person-/i, '').toUpperCase()}` : toPersonId(name || `person-${i + 1}`, i);
    const key = name ? name.toLowerCase() : personId.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const status = raw?.status === 'removed' || raw?.status === 'inactive' ? 'removed' : 'active';
    const cellE164 = typeof raw?.cellE164 === 'string' ? raw.cellE164.trim() : '';
    const cellDisplay = typeof raw?.cellDisplay === 'string' ? raw.cellDisplay.trim() : cellE164;
    const createdAt = typeof raw?.createdAt === 'string' && raw.createdAt.trim() ? raw.createdAt.trim() : undefined;
    const lastSeen = typeof raw?.lastSeen === 'string' && raw.lastSeen.trim() ? raw.lastSeen.trim() : createdAt;
    const timezone = typeof raw?.timezone === 'string' && raw.timezone.trim() ? raw.timezone.trim() : DEFAULT_TZ;
    const notes = typeof raw?.notes === 'string' ? raw.notes.trim().slice(0, 500) : '';

    people.push({ personId, name, cellE164, cellDisplay, status, createdAt, lastSeen, timezone, notes });
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
    const status = raw.status === 'available' || raw.status === 'unavailable' ? raw.status : undefined;
    const startUtc = typeof raw.startUtc === 'string' && raw.startUtc.trim() ? raw.startUtc.trim() : undefined;
    const endUtc = typeof raw.endUtc === 'string' && raw.endUtc.trim() ? raw.endUtc.trim() : undefined;
    const promptId = typeof raw.promptId === 'string' && raw.promptId.trim() ? raw.promptId.trim() : undefined;
    const originalPrompt = typeof raw.originalPrompt === 'string' ? raw.originalPrompt.trim() : undefined;
    const assumptions = Array.isArray(raw.assumptions) ? raw.assumptions.filter((item): item is string => typeof item === 'string') : undefined;
    const time = (raw.time && typeof raw.time === 'object') ? raw.time as TimeSpec : undefined;
    const schemaVersion = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : undefined;
    rules.push({ code, schemaVersion, time, personId, kind, date, startTime, durationMins: startTime ? durationMins : undefined, timezone, desc, status, startUtc, endUtc, promptId, originalPrompt, assumptions });
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

    const legacyLocation = typeof raw.location === 'string' ? raw.location : '';
    const locationRaw = typeof raw.locationRaw === 'string' ? raw.locationRaw : legacyLocation;
    const normalizedLocation = normalizeLocation(locationRaw);
    const locationDisplay = typeof raw.locationDisplay === 'string' && raw.locationDisplay.trim()
      ? raw.locationDisplay.trim()
      : normalizedLocation.display;
    const locationMapQuery = typeof raw.locationMapQuery === 'string' && raw.locationMapQuery.trim()
      ? raw.locationMapQuery.trim()
      : normalizedLocation.mapQuery;
    const locationName = typeof raw.locationName === 'string' ? raw.locationName.trim().slice(0, 200) : '';
    const locationAddress = typeof raw.locationAddress === 'string' ? raw.locationAddress.trim().slice(0, 300) : '';
    const locationDirections = typeof raw.locationDirections === 'string' ? raw.locationDirections.trim().slice(0, 300) : '';

    return {
      id: typeof raw.id === 'string' ? raw.id : `appt-${idx + 1}`,
      schemaVersion: typeof raw.schemaVersion === 'number' ? raw.schemaVersion : undefined,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
      time: (raw.time && typeof raw.time === 'object') ? raw.time as TimeSpec : undefined,
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
      location: locationDisplay,
      locationRaw,
      locationDisplay,
      locationMapQuery,
      locationName,
      locationAddress,
      locationDirections,
      notes: typeof raw.notes === 'string' ? raw.notes.trim().slice(0, 500) : ''
    };
  });

  const now = new Date().toISOString();
  const createdAt = typeof stateLike.createdAt === 'string' && stateLike.createdAt.trim() ? stateLike.createdAt : now;
  const updatedAt = typeof stateLike.updatedAt === 'string' && stateLike.updatedAt.trim() ? stateLike.updatedAt : createdAt;

  return {
    schemaVersion: typeof stateLike.schemaVersion === 'number' ? stateLike.schemaVersion : (typeof stateLike.version === 'number' ? stateLike.version : 3),
    groupId: typeof stateLike.groupId === 'string' && stateLike.groupId.trim() ? stateLike.groupId : 'default',
    groupName: typeof stateLike.groupName === 'string' && stateLike.groupName.trim() ? normalizeText(stateLike.groupName) : 'Family Scheduler',
    createdAt,
    updatedAt,
    people,
    appointments: normalizedAppointments,
    rules: normalizeRulesCollection(stateLike, people),
    history: Array.isArray(stateLike.history) ? stateLike.history.filter((item): item is string => typeof item === 'string') : []
  };
};
