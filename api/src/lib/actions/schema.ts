export const ActionSchemaVersion = 2;

export type Action =
  | { type: 'add_appointment'; title: string; start?: string; end?: string }
  | { type: 'delete_appointment'; code: string }
  | { type: 'update_appointment_title'; code: string; title: string }
  | { type: 'update_appointment_schedule'; code: string; start: string; end: string; isAllDay?: boolean }
  | { type: 'reschedule_appointment'; code: string; start: string; end: string; timezone?: string; isAllDay?: boolean }
  | { type: 'add_availability'; personName?: string; start: string; end: string; reason?: string }
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

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const assertKeys = (value: Record<string, unknown>, allowed: string[]): void => {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new Error(`Unknown field: ${key}`);
  }
};
const assertString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`Invalid ${field}`);
  return value;
};

const parseAction = (value: unknown): Action => {
  if (!isRecord(value)) throw new Error('Action must be an object');
  assertKeys(value, ['type', 'title', 'start', 'end', 'code', 'personName', 'reason', 'name', 'month', 'isAllDay', 'timezone']);
  const type = assertString(value.type, 'type') as Action['type'];

  if (type === 'add_appointment') {
    return { type, title: assertString(value.title, 'title'), start: typeof value.start === 'string' ? value.start : undefined, end: typeof value.end === 'string' ? value.end : undefined };
  }
  if (type === 'delete_appointment') {
    const code = assertString(value.code, 'code');
    return { type, code };
  }
  if (type === 'update_appointment_title') {
    const code = assertString(value.code, 'code');
    return { type, code, title: assertString(value.title, 'title') };
  }
  if (type === 'update_appointment_schedule' || type === 'reschedule_appointment') {
    const code = assertString(value.code, 'code');
    const start = assertString(value.start, 'start');
    const end = assertString(value.end, 'end');
    return { type, code, start, end, timezone: typeof value.timezone === 'string' ? assertString(value.timezone, 'timezone') : undefined, isAllDay: value.isAllDay === true ? true : undefined } as Action;
  }
  if (type === 'add_availability') {
    return {
      type,
      personName: typeof value.personName === 'string' ? assertString(value.personName, 'personName') : undefined,
      start: assertString(value.start, 'start'),
      end: assertString(value.end, 'end'),
      reason: typeof value.reason === 'string' ? assertString(value.reason, 'reason') : undefined
    };
  }
  if (type === 'delete_availability') {
    const code = assertString(value.code, 'code');
    return { type, code };
  }
  if (type === 'set_identity') return { type, name: assertString(value.name, 'name') };
  if (type === 'reset_state') return { type };
  if (type === 'list_appointments') return { type };
  if (type === 'show_appointment') {
    const code = assertString(value.code, 'code');
    return { type, code };
  }
  if (type === 'list_availability') return { type, personName: typeof value.personName === 'string' ? assertString(value.personName, 'personName') : undefined };
  if (type === 'show_availability') {
    const code = assertString(value.code, 'code');
    return { type, code };
  }
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
