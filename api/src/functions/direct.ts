import { randomUUID } from 'node:crypto';
import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { executeActions } from '../lib/actions/executor.js';
import type { Action } from '../lib/actions/schema.js';
import { MissingConfigError } from '../lib/errors/configError.js';
import { type AppState } from '../lib/state.js';
import { errorResponse, logConfigMissing } from '../lib/http/errorResponse.js';
import { ConflictError, GroupNotFoundError } from '../lib/storage/storage.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import type { StorageAdapter } from '../lib/storage/storage.js';
import { findActivePersonByPhone, validateJoinRequest } from '../lib/groupAuth.js';
import { ensureTraceId, logAuth } from '../lib/logging/authLogs.js';
import { PhoneValidationError, validateAndNormalizePhone } from '../lib/validation/phone.js';

type ResponseSnapshot = {
  appointments: Array<{ code: string; desc: string; date: string; startTime?: string; durationMins?: number; isAllDay: boolean; people: string[]; peopleDisplay: string[]; location: string; locationRaw: string; locationDisplay: string; locationMapQuery: string; locationName: string; locationAddress: string; locationDirections: string; notes: string }>;
  people: Array<{ personId: string; name: string; cellDisplay: string; cellE164: string; status: 'active' | 'removed'; timezone?: string; notes?: string }>;
  rules: Array<{ code: string; personId: string; kind: 'available' | 'unavailable'; date: string; startTime?: string; durationMins?: number; timezone?: string; desc?: string }>;
  historyCount?: number;
};

type DirectBody = { action?: unknown; groupId?: unknown; phone?: unknown; traceId?: unknown };

type DirectAction =
  | { type: 'create_blank_appointment' }
  | { type: 'delete_appointment'; code: string }
  | { type: 'set_appointment_date'; code: string; date: string }
  | { type: 'set_appointment_start_time'; code: string; startTime?: string }
  | { type: 'set_appointment_location'; code: string; location?: string; locationRaw?: string }
  | { type: 'set_appointment_notes'; code: string; notes: string }
  | { type: 'set_appointment_desc'; code: string; desc: string }
  | { type: 'set_appointment_duration'; code: string; durationMins?: number }
  | { type: 'create_blank_person' }
  | { type: 'update_person'; personId: string; name?: string; phone?: string }
  | { type: 'delete_person'; personId: string };

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^\d{2}:\d{2}$/;

const deriveDateTimeParts = (start?: string, end?: string): { date: string; startTime?: string; durationMins?: number; isAllDay: boolean } => {
  if (!start || !end) return { date: start?.slice(0, 10) ?? '', isAllDay: true };
  const startDate = new Date(start); const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return { date: start.slice(0, 10), isAllDay: true };
  const durationMins = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
  return { date: start.slice(0, 10), startTime: start.match(/T(\d{2}:\d{2})/)?.[1], durationMins, isAllDay: false };
};

const toResponseSnapshot = (state: AppState): ResponseSnapshot => ({
  appointments: state.appointments.map((appointment) => {
    const derived = deriveDateTimeParts(appointment.start, appointment.end);
    return {
      code: appointment.code,
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
      notes: appointment.notes ?? ''
    };
  }),
  people: state.people.map((person) => ({ personId: person.personId, name: person.name, cellDisplay: person.cellDisplay ?? person.cellE164, cellE164: person.cellE164, status: person.status === 'active' ? 'active' : 'removed', timezone: person.timezone, notes: person.notes ?? '' })),
  rules: state.rules.map((rule) => ({ code: rule.code, personId: rule.personId, kind: rule.kind, date: rule.date, startTime: rule.startTime, durationMins: rule.durationMins, timezone: rule.timezone, desc: rule.desc })),
  historyCount: Array.isArray(state.history) ? state.history.length : undefined
});

const badRequest = (message: string, traceId: string): HttpResponseInit => ({ status: 400, jsonBody: { ok: false, message, traceId } });
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const asString = (value: unknown): string | null => typeof value === 'string' ? value.trim() : null;
const nextPersonId = (state: AppState): string => `P-${state.people.reduce((max, person) => {
  const match = person.personId.match(/^P-(\d+)$/i);
  return match ? Math.max(max, Number(match[1])) : max;
}, 0) + 1}`;

const parseDirectAction = (value: unknown): DirectAction => {
  if (!isRecord(value)) throw new Error('action must be an object');
  const type = asString(value.type);
  if (!type) throw new Error('action.type is required');

  if (type === 'create_blank_appointment') return { type };
  if (type === 'delete_appointment') {
    const code = asString(value.code);
    if (!code) throw new Error('code is required');
    return { type, code };
  }
  if (type === 'set_appointment_date') {
    const code = asString(value.code);
    const date = asString(value.date);
    if (!code || !date) throw new Error('code and date are required');
    if (!datePattern.test(date)) throw new Error('date must be YYYY-MM-DD');
    return { type, code, date };
  }
  if (type === 'set_appointment_start_time') {
    const code = asString(value.code);
    if (!code) throw new Error('code is required');
    const startTimeRaw = value.startTime;
    const startTime = typeof startTimeRaw === 'string' ? startTimeRaw.trim() : undefined;
    if (startTime !== undefined && startTime !== '' && !timePattern.test(startTime)) throw new Error('startTime must be HH:MM');
    return { type, code, startTime: startTime || undefined };
  }
  if (type === 'set_appointment_location') {
    const code = asString(value.code);
    if (!code) throw new Error('code is required');
    return { type, code, locationRaw: typeof value.locationRaw === 'string' ? value.locationRaw : (typeof value.location === 'string' ? value.location : ''), location: typeof value.location === 'string' ? value.location : undefined };
  }
  if (type === 'set_appointment_notes') {
    const code = asString(value.code);
    if (!code) throw new Error('code is required');
    return { type, code, notes: typeof value.notes === 'string' ? value.notes : '' };
  }
  if (type === 'set_appointment_desc') {
    const code = asString(value.code);
    if (!code) throw new Error('code is required');
    return { type, code, desc: typeof value.desc === 'string' ? value.desc : '' };
  }
  if (type === 'set_appointment_duration') {
    const code = asString(value.code);
    if (!code) throw new Error('code is required');
    if (value.durationMins === undefined || value.durationMins === null || value.durationMins === '') return { type, code, durationMins: undefined };
    if (typeof value.durationMins !== 'number' || !Number.isInteger(value.durationMins) || value.durationMins < 1 || value.durationMins > 24 * 60) throw new Error('durationMins must be an integer between 1 and 1440');
    return { type, code, durationMins: value.durationMins };
  }
  if (type === 'create_blank_person') return { type };
  if (type === 'update_person') {
    const personId = asString(value.personId);
    if (!personId) throw new Error('personId is required');
    const name = typeof value.name === 'string' ? value.name : undefined;
    const phone = typeof value.phone === 'string' ? value.phone : undefined;
    return { type, personId, name, phone };
  }
  if (type === 'delete_person') {
    const personId = asString(value.personId);
    if (!personId) throw new Error('personId is required');
    return { type, personId };
  }

  throw new Error(`unsupported action type: ${type}`);
};

export async function direct(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const fallbackTraceId = randomUUID();
  const body = await request.json() as DirectBody;
  const traceId = ensureTraceId(body.traceId) || fallbackTraceId;
  const identity = validateJoinRequest(body.groupId, body.phone);
  if (!identity.ok) {
    return {
      ...identity.response,
      jsonBody: { ...(identity.response.jsonBody as Record<string, unknown>), traceId }
    };
  }
  logAuth({ traceId, stage: 'gate_in', groupId: identity.groupId, phone: identity.phoneE164 });

  let directAction: DirectAction;
  try {
    directAction = parseDirectAction(body.action);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'invalid action', traceId);
  }

  let storage: StorageAdapter;
  try {
    storage = createStorageAdapter();
  } catch (error) {
    if (error instanceof MissingConfigError) {
      logConfigMissing('direct', traceId, error.missing);
      return errorResponse(500, 'CONFIG_MISSING', error.message, traceId, { missing: error.missing });
    }
    throw error;
  }
  let loaded;
  try {
    loaded = await storage.load(identity.groupId);
  } catch (error) {
    if (error instanceof MissingConfigError) {
      logConfigMissing('direct', traceId, error.missing);
      return errorResponse(500, 'CONFIG_MISSING', error.message, traceId, { missing: error.missing });
    }
    if (error instanceof GroupNotFoundError) return errorResponse(404, 'group_not_found', 'Group not found', traceId);
    throw error;
  }
  const allowed = findActivePersonByPhone(loaded.state, identity.phoneE164);
  if (!allowed) {
    logAuth({ traceId, stage: 'gate_denied', reason: 'not_allowed' });
    return errorResponse(403, 'not_allowed', 'Not allowed', traceId);
  }
  logAuth({ traceId, stage: 'gate_allowed', personId: allowed.personId });
  const execution = await executeActions(loaded.state, [directAction as Action], { activePersonId: null, timezoneName: process.env.TZ ?? 'America/Los_Angeles' });
  if (directAction.type === 'create_blank_person') {
    const personId = nextPersonId(loaded.state);
    loaded.state.people.push({ personId, name: '', cellE164: '', cellDisplay: '', status: 'active', timezone: process.env.TZ ?? 'America/Los_Angeles', notes: '' });
    try {
      const written = await storage.save(identity.groupId, loaded.state, loaded.etag);
      return { status: 200, jsonBody: { ok: true, snapshot: toResponseSnapshot(written.state), personId } };
    } catch (error) {
      if (error instanceof MissingConfigError) {
        logConfigMissing('direct', traceId, error.missing);
        return errorResponse(500, 'CONFIG_MISSING', error.message, traceId, { missing: error.missing });
      }
      if (error instanceof ConflictError) return { status: 409, jsonBody: { ok: false, message: 'State changed. Retry.', traceId } };
      throw error;
    }
  }

  if (directAction.type === 'update_person') {
    const person = loaded.state.people.find((entry) => entry.personId === directAction.personId);
    if (!person) return badRequest('Person not found', traceId);
    const nextName = directAction.name === undefined ? person.name : directAction.name.trim();
    const nextPhoneRaw = directAction.phone === undefined ? person.cellDisplay ?? person.cellE164 : directAction.phone;

    if (!nextName) return badRequest('Name is required', traceId);
    if (!nextPhoneRaw?.trim()) return badRequest('Invalid phone number', traceId);

    try {
      const normalizedPhone = validateAndNormalizePhone(nextPhoneRaw);
      const duplicate = loaded.state.people.find((entry) => entry.status === 'active' && entry.personId !== person.personId && entry.cellE164 === normalizedPhone.e164);
      if (duplicate) return badRequest(`That phone is already used by ${duplicate.name || duplicate.personId}`, traceId);
      person.name = nextName;
      person.cellE164 = normalizedPhone.e164;
      person.cellDisplay = normalizedPhone.display;
      try {
        const written = await storage.save(identity.groupId, loaded.state, loaded.etag);
        return { status: 200, jsonBody: { ok: true, snapshot: toResponseSnapshot(written.state) } };
      } catch (error) {
        if (error instanceof MissingConfigError) {
          logConfigMissing('direct', traceId, error.missing);
          return errorResponse(500, 'CONFIG_MISSING', error.message, traceId, { missing: error.missing });
        }
        if (error instanceof ConflictError) return { status: 409, jsonBody: { ok: false, message: 'State changed. Retry.', traceId } };
        throw error;
      }
    } catch (error) {
      if (error instanceof PhoneValidationError) return badRequest('Invalid phone number', traceId);
      throw error;
    }
  }

  if (directAction.type === 'delete_person') {
    const person = loaded.state.people.find((entry) => entry.personId === directAction.personId);
    if (!person) return badRequest('Person not found', traceId);
    person.status = 'removed';
    try {
      const written = await storage.save(identity.groupId, loaded.state, loaded.etag);
      return { status: 200, jsonBody: { ok: true, snapshot: toResponseSnapshot(written.state) } };
    } catch (error) {
      if (error instanceof MissingConfigError) {
        logConfigMissing('direct', traceId, error.missing);
        return errorResponse(500, 'CONFIG_MISSING', error.message, traceId, { missing: error.missing });
      }
      if (error instanceof ConflictError) return { status: 409, jsonBody: { ok: false, message: 'State changed. Retry.', traceId } };
      throw error;
    }
  }

  if (!execution.appliedAll) return { status: 400, jsonBody: { ok: false, message: execution.effectsTextLines[0] ?? 'Action could not be applied', traceId } };

  try {
    const written = await storage.save(identity.groupId, execution.nextState, loaded.etag);
    return { status: 200, jsonBody: { ok: true, snapshot: toResponseSnapshot(written.state) } };
  } catch (error) {
    if (error instanceof MissingConfigError) {
      logConfigMissing('direct', traceId, error.missing);
      return errorResponse(500, 'CONFIG_MISSING', error.message, traceId, { missing: error.missing });
    }
    if (error instanceof ConflictError) return { status: 409, jsonBody: { ok: false, message: 'State changed. Retry.', traceId } };
    throw error;
  }
}
