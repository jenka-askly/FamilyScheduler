export const ACTION_SCHEMA_VERSION = 4;

export type TimedActionFields = {
  date: string;
  startTime?: string;
  durationMins?: number;
  timezone?: string;
};

export type Action =
  | ({ type: 'add_appointment'; desc: string; people?: string[]; location?: string } & TimedActionFields)
  | ({ type: 'reschedule_appointment'; code: string } & TimedActionFields)
  | { type: 'update_appointment_desc'; code: string; desc: string }
  | { type: 'delete_appointment'; code: string }
  | { type: 'add_people_to_appointment'; code: string; people: string[] }
  | { type: 'remove_people_from_appointment'; code: string; people: string[] }
  | { type: 'replace_people_on_appointment'; code: string; people: string[] }
  | { type: 'clear_people_on_appointment'; code: string }
  | { type: 'set_appointment_location'; code: string; location: string }
  | { type: 'set_appointment_notes'; code: string; notes: string }
  | ({ type: 'add_availability'; personName: string; desc: string } & TimedActionFields)
  | { type: 'delete_availability'; code: string }
  | { type: 'set_identity'; name: string }
  | { type: 'reset_state' }
  | { type: 'list_appointments' }
  | { type: 'show_appointment'; code: string }
  | { type: 'list_availability'; personName?: string }
  | { type: 'show_availability'; code: string }
  | { type: 'who_is_available'; month?: string; start?: string; end?: string }
  | { type: 'help' };

export type ParsedModelResponse = {
  kind: 'reply' | 'proposal' | 'clarify';
  message: string;
  actions?: Action[];
  confidence?: number;
};

const yearMonthPattern = /^\d{4}-\d{2}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const startTimePattern = /^\d{2}:\d{2}$/;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const assertKeys = (value: Record<string, unknown>, allowed: string[]): void => {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new Error(`Unknown field: ${key}`);
  }
};
const normalizeText = (value: string): string => value.trim().replace(/\s+/g, ' ');
const assertString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`Invalid ${field}`);
  return normalizeText(value);
};
const assertDate = (value: unknown): string => {
  const date = assertString(value, 'date');
  if (!datePattern.test(date)) throw new Error('Invalid date');
  return date;
};
const parseOptionalStartTime = (value: unknown): string | undefined => {
  if (value === undefined) return undefined;
  const startTime = assertString(value, 'startTime');
  if (!startTimePattern.test(startTime)) throw new Error('Invalid startTime');
  return startTime;
};
const parseOptionalDuration = (value: unknown): number | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > (24 * 60)) throw new Error('Invalid durationMins');
  return value;
};

const parseTimedFields = (value: Record<string, unknown>): TimedActionFields => ({
  date: assertDate(value.date),
  startTime: parseOptionalStartTime(value.startTime),
  durationMins: parseOptionalDuration(value.durationMins),
  timezone: typeof value.timezone === 'string' ? assertString(value.timezone, 'timezone') : undefined
});

const assertLocation = (value: unknown): string => {
  if (typeof value !== 'string') throw new Error('Invalid location');
  const location = normalizeText(value);
  if (location.length > 200) throw new Error('Invalid location');
  return location;
};


const assertNotes = (value: unknown): string => {
  if (typeof value !== 'string') throw new Error('Invalid notes');
  const notes = value.trim();
  if (notes.length > 500) throw new Error('Invalid notes');
  return notes;
};

const assertPeopleArray = (value: unknown, field: string, minItems: number, maxItems: number): string[] => {
  if (!Array.isArray(value)) throw new Error(`Invalid ${field}`);
  if (value.length < minItems || value.length > maxItems) throw new Error(`Invalid ${field}`);
  return value.map((person) => assertString(person, field));
};

const parseAction = (value: unknown): Action => {
  if (!isRecord(value)) throw new Error('Action must be an object');
  assertKeys(value, ['type', 'code', 'desc', 'date', 'startTime', 'durationMins', 'timezone', 'people', 'personName', 'name', 'month', 'start', 'end', 'location', 'notes']);
  const type = assertString(value.type, 'type') as Action['type'];

  if (type === 'add_appointment') {
    const people = value.people === undefined ? undefined : assertPeopleArray(value.people, 'people', 1, 20);
    const location = value.location === undefined ? undefined : assertLocation(value.location);
    return { type, desc: assertString(value.desc, 'desc'), ...parseTimedFields(value), people, location };
  }
  if (type === 'reschedule_appointment') {
    return { type, code: assertString(value.code, 'code'), ...parseTimedFields(value) };
  }
  if (type === 'update_appointment_desc') {
    return { type, code: assertString(value.code, 'code'), desc: assertString(value.desc, 'desc') };
  }
  if (type === 'delete_appointment') {
    return { type, code: assertString(value.code, 'code') };
  }
  if (type === 'add_people_to_appointment') {
    return { type, code: assertString(value.code, 'code'), people: assertPeopleArray(value.people, 'people', 1, 20) };
  }
  if (type === 'remove_people_from_appointment') {
    return { type, code: assertString(value.code, 'code'), people: assertPeopleArray(value.people, 'people', 1, 20) };
  }
  if (type === 'replace_people_on_appointment') {
    return { type, code: assertString(value.code, 'code'), people: assertPeopleArray(value.people, 'people', 0, 20) };
  }
  if (type === 'clear_people_on_appointment') {
    return { type, code: assertString(value.code, 'code') };
  }
  if (type === 'set_appointment_location') {
    return { type, code: assertString(value.code, 'code'), location: assertLocation(value.location) };
  }
  if (type === 'set_appointment_notes') {
    return { type, code: assertString(value.code, 'code'), notes: assertNotes(value.notes) };
  }
  if (type === 'add_availability') {
    return { type, personName: assertString(value.personName, 'personName'), desc: assertString(value.desc, 'desc'), ...parseTimedFields(value) };
  }
  if (type === 'delete_availability') {
    return { type, code: assertString(value.code, 'code') };
  }
  if (type === 'set_identity') return { type, name: assertString(value.name, 'name') };
  if (type === 'reset_state') return { type };
  if (type === 'list_appointments') return { type };
  if (type === 'show_appointment') return { type, code: assertString(value.code, 'code') };
  if (type === 'list_availability') return { type, personName: typeof value.personName === 'string' ? assertString(value.personName, 'personName') : undefined };
  if (type === 'show_availability') return { type, code: assertString(value.code, 'code') };
  if (type === 'who_is_available') {
    const month = typeof value.month === 'string' ? value.month : undefined;
    const start = typeof value.start === 'string' ? value.start : undefined;
    const end = typeof value.end === 'string' ? value.end : undefined;
    if (month && !yearMonthPattern.test(month)) throw new Error('Invalid month');
    if (start && !datePattern.test(start)) throw new Error('Invalid start date');
    if (end && !datePattern.test(end)) throw new Error('Invalid end date');
    return { type, month, start, end };
  }
  if (type === 'help') return { type };

  throw new Error(`Unsupported action type: ${type}`);
};

export const ParsedModelResponseSchema = {
  parse(value: unknown): ParsedModelResponse {
    if (!isRecord(value)) throw new Error('Response must be an object');
    assertKeys(value, ['kind', 'message', 'actions', 'confidence']);

    if (value.kind !== 'reply' && value.kind !== 'proposal' && value.kind !== 'clarify') {
      throw new Error('Invalid kind');
    }

    const message = assertString(value.message, 'message');
    const actions = value.actions === undefined ? undefined : (Array.isArray(value.actions) ? value.actions.map((item) => parseAction(item)) : (() => { throw new Error('actions must be an array'); })());

    const confidence = typeof value.confidence === 'number' ? value.confidence : undefined;
    if (confidence !== undefined && (Number.isNaN(confidence) || confidence < 0 || confidence > 1)) {
      throw new Error('confidence must be a number between 0 and 1');
    }

    return { kind: value.kind, message, actions, confidence };
  }
};
