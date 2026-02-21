export const ACTION_SCHEMA_VERSION = 5;

export type TimedActionFields = {
  date: string;
  startTime?: string;
  durationMins?: number;
  timezone?: string;
};

export type Action =
  | { type: 'create_blank_appointment' }
  | ({ type: 'add_appointment'; desc: string; people?: string[]; location?: string } & TimedActionFields)
  | ({ type: 'reschedule_appointment'; code: string } & TimedActionFields)
  | { type: 'update_appointment_desc'; code: string; desc: string }
  | { type: 'set_appointment_date'; code: string; date: string }
  | { type: 'set_appointment_start_time'; code: string; startTime?: string }
  | { type: 'set_appointment_desc'; code: string; desc: string }
  | { type: 'set_appointment_duration'; code: string; durationMins?: number }
  | { type: 'delete_appointment'; code: string }
  | { type: 'add_people_to_appointment'; code: string; people: string[] }
  | { type: 'remove_people_from_appointment'; code: string; people: string[] }
  | { type: 'replace_people_on_appointment'; code: string; people: string[] }
  | { type: 'clear_people_on_appointment'; code: string }
  | { type: 'set_appointment_location'; code: string; location?: string; locationRaw?: string }
  | { type: 'set_appointment_notes'; code: string; notes: string }
  | { type: 'add_person'; name: string; cell: string; timezone?: string; notes?: string }
  | { type: 'update_person'; personId: string; name?: string; cell?: string; timezone?: string; notes?: string }
  | { type: 'deactivate_person'; personId: string }
  | { type: 'reactivate_person'; personId: string }
  | ({ type: 'add_rule'; personId: string; kind: 'available' | 'unavailable'; desc?: string } & TimedActionFields)
  | { type: 'delete_rule'; code: string }
  | { type: 'set_identity'; name: string }
  | { type: 'reset_state' }
  | { type: 'list_appointments' }
  | { type: 'show_appointment'; code: string }
  | { type: 'list_people' }
  | { type: 'show_person'; personId: string }
  | { type: 'list_rules'; personId?: string }
  | { type: 'show_rule'; code: string }
  | { type: 'help' };

export type ParsedModelResponse = {
  kind: 'reply' | 'proposal' | 'question';
  message: string;
  actions?: Action[];
  confidence?: number;
  options?: Array<{ label: string; value: string; style?: 'primary' | 'secondary' | 'danger' }>;
  allowFreeText?: boolean;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const startTimePattern = /^\d{2}:\d{2}$/;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const assertKeys = (value: Record<string, unknown>, allowed: string[]): void => { for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Unknown field: ${key}`); };
const normalizeText = (value: string): string => value.trim().replace(/\s+/g, ' ');
const assertString = (value: unknown, field: string): string => { if (typeof value !== 'string' || !value.trim()) throw new Error(`Invalid ${field}`); return normalizeText(value); };
const assertDate = (value: unknown): string => { const date = assertString(value, 'date'); if (!datePattern.test(date)) throw new Error('Invalid date'); return date; };
const parseOptionalStartTime = (value: unknown): string | undefined => { if (value === undefined) return undefined; const startTime = assertString(value, 'startTime'); if (!startTimePattern.test(startTime)) throw new Error('Invalid startTime'); return startTime; };
const parseOptionalDuration = (value: unknown): number | undefined => { if (value === undefined) return undefined; if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > (24 * 60)) throw new Error('Invalid durationMins'); return value; };
const parseTimedFields = (value: Record<string, unknown>): TimedActionFields => ({ date: assertDate(value.date), startTime: parseOptionalStartTime(value.startTime), durationMins: parseOptionalDuration(value.durationMins), timezone: typeof value.timezone === 'string' ? assertString(value.timezone, 'timezone') : undefined });
const assertPeopleArray = (value: unknown, field: string, minItems: number, maxItems: number): string[] => {
  if (!Array.isArray(value) || value.length < minItems || value.length > maxItems) throw new Error(`Invalid ${field}`);
  return value.map((person) => assertString(person, field));
};

const parseAction = (value: unknown): Action => {
  if (!isRecord(value)) throw new Error('Action must be an object');
  assertKeys(value, ['type', 'code', 'desc', 'date', 'startTime', 'durationMins', 'timezone', 'people', 'name', 'month', 'start', 'end', 'location', 'locationRaw', 'notes', 'personId', 'cell', 'kind']);
  const type = assertString(value.type, 'type') as Action['type'];

  if (type === 'create_blank_appointment') return { type };
  if (type === 'add_appointment') return { type, desc: assertString(value.desc, 'desc'), ...parseTimedFields(value), people: value.people === undefined ? undefined : assertPeopleArray(value.people, 'people', 1, 20), location: typeof value.location === 'string' ? normalizeText(value.location) : undefined };
  if (type === 'reschedule_appointment') return { type, code: assertString(value.code, 'code'), ...parseTimedFields(value) };
  if (type === 'update_appointment_desc') return { type, code: assertString(value.code, 'code'), desc: assertString(value.desc, 'desc') };
  if (type === 'set_appointment_date') return { type, code: assertString(value.code, 'code'), date: assertDate(value.date) };
  if (type === 'set_appointment_start_time') return { type, code: assertString(value.code, 'code'), startTime: parseOptionalStartTime(value.startTime) };
  if (type === 'set_appointment_desc') return { type, code: assertString(value.code, 'code'), desc: typeof value.desc === 'string' ? value.desc.trim() : '' };
  if (type === 'set_appointment_duration') return { type, code: assertString(value.code, 'code'), durationMins: parseOptionalDuration(value.durationMins) };
  if (type === 'delete_appointment') return { type, code: assertString(value.code, 'code') };
  if (type === 'add_people_to_appointment') return { type, code: assertString(value.code, 'code'), people: assertPeopleArray(value.people, 'people', 1, 20) };
  if (type === 'remove_people_from_appointment') return { type, code: assertString(value.code, 'code'), people: assertPeopleArray(value.people, 'people', 1, 20) };
  if (type === 'replace_people_on_appointment') return { type, code: assertString(value.code, 'code'), people: assertPeopleArray(value.people, 'people', 0, 20) };
  if (type === 'clear_people_on_appointment') return { type, code: assertString(value.code, 'code') };
  if (type === 'set_appointment_location') return { type, code: assertString(value.code, 'code'), locationRaw: typeof value.locationRaw === 'string' ? value.locationRaw : (typeof value.location === 'string' ? value.location : ''), location: typeof value.location === 'string' ? value.location : undefined };
  if (type === 'set_appointment_notes') { const notes = typeof value.notes === 'string' ? value.notes.trim() : ''; if (notes.length > 500) throw new Error('Invalid notes'); return { type, code: assertString(value.code, 'code'), notes }; }
  if (type === 'add_person') return { type, name: assertString(value.name, 'name'), cell: assertString(value.cell, 'cell'), timezone: typeof value.timezone === 'string' ? assertString(value.timezone, 'timezone') : undefined, notes: typeof value.notes === 'string' ? value.notes.trim() : undefined };
  if (type === 'update_person') return { type, personId: assertString(value.personId, 'personId'), name: typeof value.name === 'string' ? assertString(value.name, 'name') : undefined, cell: typeof value.cell === 'string' ? assertString(value.cell, 'cell') : undefined, timezone: typeof value.timezone === 'string' ? assertString(value.timezone, 'timezone') : undefined, notes: typeof value.notes === 'string' ? value.notes.trim() : undefined };
  if (type === 'deactivate_person') return { type, personId: assertString(value.personId, 'personId') };
  if (type === 'reactivate_person') return { type, personId: assertString(value.personId, 'personId') };
  if (type === 'add_rule') {
    const kind = assertString(value.kind, 'kind');
    if (kind !== 'available' && kind !== 'unavailable') throw new Error('Invalid kind');
    return { type, personId: assertString(value.personId, 'personId'), kind, ...parseTimedFields(value), desc: typeof value.desc === 'string' ? value.desc.trim() : undefined };
  }
  if (type === 'delete_rule') return { type, code: assertString(value.code, 'code') };
  if (type === 'set_identity') return { type, name: assertString(value.name, 'name') };
  if (type === 'reset_state' || type === 'list_appointments' || type === 'list_people' || type === 'help') return { type };
  if (type === 'show_appointment') return { type, code: assertString(value.code, 'code') };
  if (type === 'show_person') return { type, personId: assertString(value.personId, 'personId') };
  if (type === 'list_rules') return { type, personId: typeof value.personId === 'string' ? assertString(value.personId, 'personId') : undefined };
  if (type === 'show_rule') return { type, code: assertString(value.code, 'code') };

  throw new Error(`Unsupported action type: ${type}`);
};

export const ParsedModelResponseSchema = {
  parse(value: unknown): ParsedModelResponse {
    if (!isRecord(value)) throw new Error('Response must be an object');
    assertKeys(value, ['kind', 'message', 'actions', 'confidence', 'options', 'allowFreeText']);
    if (value.kind !== 'reply' && value.kind !== 'proposal' && value.kind !== 'question' && value.kind !== 'clarify') throw new Error('Invalid kind');
    const message = assertString(value.message, 'message');
    const actions = value.actions === undefined ? undefined : (Array.isArray(value.actions) ? value.actions.map((item) => parseAction(item)) : (() => { throw new Error('actions must be an array'); })());
    const confidence = typeof value.confidence === 'number' ? value.confidence : undefined;
    const options = value.options === undefined
      ? undefined
      : (Array.isArray(value.options)
        ? value.options.map((item) => {
          if (!isRecord(item)) throw new Error('question option must be an object');
          assertKeys(item, ['label', 'value', 'style']);
          const styleRaw = item.style === undefined ? undefined : assertString(item.style, 'style');
          if (styleRaw !== undefined && styleRaw !== 'primary' && styleRaw !== 'secondary' && styleRaw !== 'danger') throw new Error('Invalid option style');
          const style = styleRaw as ('primary' | 'secondary' | 'danger' | undefined);
          return { label: assertString(item.label, 'label'), value: assertString(item.value, 'value'), style };
        })
        : (() => { throw new Error('options must be an array'); })());
    if (options && options.length > 5) throw new Error('options must have at most 5 items');
    const allowFreeText = value.allowFreeText === undefined ? undefined : (() => {
      if (typeof value.allowFreeText !== 'boolean') throw new Error('allowFreeText must be a boolean');
      return value.allowFreeText;
    })();
    if (confidence !== undefined && (Number.isNaN(confidence) || confidence < 0 || confidence > 1)) throw new Error('confidence must be a number between 0 and 1');
    return {
      kind: value.kind === 'clarify' ? 'question' : value.kind,
      message,
      actions,
      confidence,
      options,
      allowFreeText: (value.kind === 'clarify' && allowFreeText === undefined) ? true : allowFreeText
    };
  }
};
