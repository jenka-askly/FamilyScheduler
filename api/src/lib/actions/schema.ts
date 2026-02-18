export const ActionSchemaVersion = 1;

export type Action =
  | { type: 'add_appointment'; title: string; start?: string; end?: string }
  | { type: 'delete_appointment'; code: string }
  | { type: 'update_appointment_title'; code: string; title: string }
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
  kind: 'query' | 'mutation' | 'clarify';
  actions: Action[];
  clarificationQuestion?: string;
  assumptions?: string[];
};

const appointmentCodePattern = /^APPT-\d+$/;
const availabilityCodePattern = /^AVL-[A-Z0-9_-]+-\d+$/;
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
  assertKeys(value, ['type', 'title', 'start', 'end', 'code', 'personName', 'reason', 'name', 'month']);
  const type = assertString(value.type, 'type') as Action['type'];

  if (type === 'add_appointment') {
    return { type, title: assertString(value.title, 'title'), start: typeof value.start === 'string' ? value.start : undefined, end: typeof value.end === 'string' ? value.end : undefined };
  }
  if (type === 'delete_appointment') {
    const code = assertString(value.code, 'code');
    if (!appointmentCodePattern.test(code)) throw new Error('Invalid appointment code');
    return { type, code };
  }
  if (type === 'update_appointment_title') {
    const code = assertString(value.code, 'code');
    if (!appointmentCodePattern.test(code)) throw new Error('Invalid appointment code');
    return { type, code, title: assertString(value.title, 'title') };
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
    if (!availabilityCodePattern.test(code)) throw new Error('Invalid availability code');
    return { type, code };
  }
  if (type === 'set_identity') return { type, name: assertString(value.name, 'name') };
  if (type === 'reset_state') return { type };
  if (type === 'list_appointments') return { type };
  if (type === 'show_appointment') {
    const code = assertString(value.code, 'code');
    if (!appointmentCodePattern.test(code)) throw new Error('Invalid appointment code');
    return { type, code };
  }
  if (type === 'list_availability') return { type, personName: typeof value.personName === 'string' ? assertString(value.personName, 'personName') : undefined };
  if (type === 'show_availability') {
    const code = assertString(value.code, 'code');
    if (!availabilityCodePattern.test(code)) throw new Error('Invalid availability code');
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
    assertKeys(value, ['kind', 'actions', 'clarificationQuestion', 'assumptions']);

    if (value.kind !== 'query' && value.kind !== 'mutation' && value.kind !== 'clarify') {
      throw new Error('Invalid kind');
    }

    if (!Array.isArray(value.actions)) throw new Error('actions must be an array');
    const actions = value.actions.map((item) => parseAction(item));

    const clarificationQuestion = typeof value.clarificationQuestion === 'string' ? value.clarificationQuestion : undefined;
    if (value.kind === 'clarify' && (!clarificationQuestion || clarificationQuestion.trim().length === 0)) {
      throw new Error('clarificationQuestion is required when kind=clarify');
    }

    let assumptions: string[] | undefined;
    if (value.assumptions !== undefined) {
      if (!Array.isArray(value.assumptions) || value.assumptions.some((item) => typeof item !== 'string')) {
        throw new Error('assumptions must be string[]');
      }
      assumptions = value.assumptions;
    }

    return { kind: value.kind, actions, clarificationQuestion, assumptions };
  }
};
