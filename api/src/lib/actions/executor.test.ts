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
  state.appointments.push({ id: 'appt-1', code: 'APPT-1', title: 'Dentist', date: '2026-03-01', startTime: '09:00', durationMins: 60, start: '2026-03-01T09:00:00-08:00', end: '2026-03-01T10:00:00-08:00', assigned: [] });
  const result = executeActions(state, [{ type: 'reschedule_appointment', code: 'APPT-1', date: '2026-03-05' }], { activePersonId: null, timezoneName: 'America/Los_Angeles' });
  const appt = result.nextState.appointments[0];
  assert.equal(appt.date, '2026-03-05');
  assert.equal(appt.isAllDay, true);
  assert.equal(appt.start, undefined);
});

test('resolveAppointmentTimes ignores duration when startTime missing', () => {
  const resolved = resolveAppointmentTimes('2026-03-03', undefined, 45, 'America/Los_Angeles');
  assert.equal(resolved.isAllDay, true);
  assert.equal(resolved.startIso, undefined);
});
