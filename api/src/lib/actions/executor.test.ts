import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyAppState } from '../state.js';
import { executeActions, resolveAppointmentTimes } from './executor.js';

test('A: add appointment date+desc only creates all-day', () => {
  const result = executeActions(createEmptyAppState(), [{ type: 'add_appointment', date: '2026-03-03', desc: 'Dentist' }], { activePersonId: null, timezoneName: 'America/Los_Angeles' });
  const appt = result.nextState.appointments[0];
  assert.equal(appt.date, '2026-03-03');
  assert.equal(appt.isAllDay, true);
  assert.equal(appt.start, undefined);
  assert.deepEqual(appt.people, []);
  assert.equal(appt.location, '');
});

test('B: add appointment with startTime+duration stores timed range', () => {
  const result = executeActions(createEmptyAppState(), [{ type: 'add_appointment', date: '2026-03-03', desc: 'Dentist', startTime: '10:00', durationMins: 60 }], { activePersonId: null, timezoneName: 'America/Los_Angeles' });
  const appt = result.nextState.appointments[0];
  assert.equal(appt.startTime, '10:00');
  assert.equal(appt.durationMins, 60);
  assert.equal(appt.isAllDay, false);
});

test('C: reschedule date-only sets all-day', () => {
  const state = createEmptyAppState();
  state.appointments.push({ id: 'appt-1', code: 'APPT-1', title: 'Dentist', date: '2026-03-01', startTime: '09:00', durationMins: 60, start: '2026-03-01T09:00:00-08:00', end: '2026-03-01T10:00:00-08:00', assigned: [], people: [], location: '' });
  const result = executeActions(state, [{ type: 'reschedule_appointment', code: 'APPT-1', date: '2026-03-05' }], { activePersonId: null, timezoneName: 'America/Los_Angeles' });
  const appt = result.nextState.appointments[0];
  assert.equal(appt.date, '2026-03-05');
  assert.equal(appt.isAllDay, true);
  assert.equal(appt.start, undefined);
});

test('D: people operations + idempotency + location set/clear', () => {
  const state = createEmptyAppState();
  state.appointments.push({ id: 'appt-1', code: 'APPT-1', title: 'Dentist', assigned: [], people: [], location: '' });

  let result = executeActions(state, [{ type: 'add_people_to_appointment', code: 'APPT-1', people: [' Joe ', 'Sam'] }], { activePersonId: null, timezoneName: 'America/Los_Angeles' });
  assert.deepEqual(result.nextState.appointments[0].people, ['Joe', 'Sam']);

  result = executeActions(result.nextState, [{ type: 'add_people_to_appointment', code: 'APPT-1', people: ['joe'] }], { activePersonId: null, timezoneName: 'America/Los_Angeles' });
  assert.deepEqual(result.nextState.appointments[0].people, ['Joe', 'Sam']);

  result = executeActions(result.nextState, [{ type: 'replace_people_on_appointment', code: 'APPT-1', people: ['Sam'] }], { activePersonId: null, timezoneName: 'America/Los_Angeles' });
  assert.deepEqual(result.nextState.appointments[0].people, ['Sam']);

  result = executeActions(result.nextState, [{ type: 'remove_people_from_appointment', code: 'APPT-1', people: ['sam'] }], { activePersonId: null, timezoneName: 'America/Los_Angeles' });
  assert.deepEqual(result.nextState.appointments[0].people, []);

  result = executeActions(result.nextState, [{ type: 'set_appointment_location', code: 'APPT-1', location: ' Kaiser Redwood City ' }], { activePersonId: null, timezoneName: 'America/Los_Angeles' });
  assert.equal(result.nextState.appointments[0].location, 'Kaiser Redwood City');

  result = executeActions(result.nextState, [{ type: 'set_appointment_location', code: 'APPT-1', location: '' }], { activePersonId: null, timezoneName: 'America/Los_Angeles' });
  assert.equal(result.nextState.appointments[0].location, '');
});

test('resolveAppointmentTimes ignores duration when startTime missing', () => {
  const resolved = resolveAppointmentTimes('2026-03-03', undefined, 45, 'America/Los_Angeles');
  assert.equal(resolved.isAllDay, true);
  assert.equal(resolved.startIso, undefined);
});
