import { randomUUID } from 'node:crypto';
import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { executeActions } from '../lib/actions/executor.js';
import type { Action } from '../lib/actions/schema.js';
import { type AppState } from '../lib/state.js';
import { ConflictError } from '../lib/storage/storage.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';

type ResponseSnapshot = {
  appointments: Array<{ code: string; desc: string; date: string; startTime?: string; durationMins?: number; isAllDay: boolean; people: string[]; peopleDisplay: string[]; location: string; locationRaw: string; locationDisplay: string; locationMapQuery: string; locationName: string; locationAddress: string; locationDirections: string; notes: string }>;
  people: Array<{ personId: string; name: string; cellDisplay: string; status: 'active' | 'inactive'; timezone?: string; notes?: string }>;
  rules: Array<{ code: string; personId: string; kind: 'available' | 'unavailable'; date: string; startTime?: string; durationMins?: number; timezone?: string; desc?: string }>;
  historyCount?: number;
};

type DirectBody = { action?: unknown };

type DirectAction =
  | { type: 'create_blank_appointment' }
  | { type: 'delete_appointment'; code: string }
  | { type: 'set_appointment_date'; code: string; date: string }
  | { type: 'set_appointment_start_time'; code: string; startTime?: string }
  | { type: 'set_appointment_location'; code: string; location?: string; locationRaw?: string }
  | { type: 'set_appointment_notes'; code: string; notes: string }
  | { type: 'set_appointment_desc'; code: string; desc: string }
  | { type: 'set_appointment_duration'; code: string; durationMins?: number };

const storage = createStorageAdapter();
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
  people: state.people.map((person) => ({ personId: person.personId, name: person.name, cellDisplay: person.cellDisplay ?? person.cellE164, status: person.status, timezone: person.timezone, notes: person.notes ?? '' })),
  rules: state.rules.map((rule) => ({ code: rule.code, personId: rule.personId, kind: rule.kind, date: rule.date, startTime: rule.startTime, durationMins: rule.durationMins, timezone: rule.timezone, desc: rule.desc })),
  historyCount: Array.isArray(state.history) ? state.history.length : undefined
});

const badRequest = (message: string, traceId: string): HttpResponseInit => ({ status: 400, jsonBody: { ok: false, message, traceId } });
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const asString = (value: unknown): string | null => typeof value === 'string' ? value.trim() : null;

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

  throw new Error(`unsupported action type: ${type}`);
};

export async function direct(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = randomUUID();
  await storage.initIfMissing();
  const body = await request.json() as DirectBody;

  let directAction: DirectAction;
  try {
    directAction = parseDirectAction(body.action);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'invalid action', traceId);
  }

  const loaded = await storage.getState();
  const execution = await executeActions(loaded.state, [directAction as Action], { activePersonId: null, timezoneName: process.env.TZ ?? 'America/Los_Angeles' });
  if (!execution.appliedAll) return { status: 400, jsonBody: { ok: false, message: execution.effectsTextLines[0] ?? 'Action could not be applied', traceId } };

  try {
    const written = await storage.putState(execution.nextState, loaded.etag);
    return { status: 200, jsonBody: { ok: true, snapshot: toResponseSnapshot(written.state) } };
  } catch (error) {
    if (error instanceof ConflictError) return { status: 409, jsonBody: { ok: false, message: 'State changed. Retry.', traceId } };
    throw error;
  }
}
