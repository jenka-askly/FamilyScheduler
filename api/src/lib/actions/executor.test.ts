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
  assert.equal(appt.notes, '');
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
  state.appointments.push({ id: 'appt-1', code: 'APPT-1', title: 'Dentist', date: '2026-03-01', startTime: '09:00', durationMins: 60, start: '2026-03-01T09:00:00-08:00', end: '2026-03-01T10:00:00-08:00', assigned: [], people: [], location: '', notes: '' });
  const result = executeActions(state, [{ type: 'reschedule_appointment', code: 'APPT-1', date: '2026-03-05' }], { activePersonId: null, timezoneName: 'America/Los_Angeles' });
  const appt = result.nextState.appointments[0];
  assert.equal(appt.date, '2026-03-05');
  assert.equal(appt.isAllDay, true);
  assert.equal(appt.start, undefined);
});

test('D: people operations + idempotency + location/notes set-clear', () => {
  const state = createEmptyAppState();
  state.appointments.push({ id: 'appt-1', code: 'APPT-1', title: 'Dentist', assigned: [], people: [], location: '', notes: '' });

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

  result = executeActions(result.nextState, [{ type: 'set_appointment_notes', code: 'APPT-1', notes: ' Bring insurance card ' }], { activePersonId: null, timezoneName: 'America/Los_Angeles' });
  assert.equal(result.nextState.appointments[0].notes, 'Bring insurance card');

  result = executeActions(result.nextState, [{ type: 'set_appointment_notes', code: 'APPT-1', notes: '' }], { activePersonId: null, timezoneName: 'America/Los_Angeles' });
  assert.equal(result.nextState.appointments[0].notes, '');
});

test('resolveAppointmentTimes ignores duration when startTime missing', () => {
  const resolved = resolveAppointmentTimes('2026-03-03', undefined, 45, 'America/Los_Angeles');
  assert.equal(resolved.isAllDay, true);
  assert.equal(resolved.startIso, undefined);
});

test('E: add_rule removes overlapping opposite-kind conflicts and keeps new rule', () => {
  const state = createEmptyAppState();
  state.people.push({ personId: 'P-1', name: 'Jay Yap', cellE164: '+15555550123', cellDisplay: '+1 555 555 0123', status: 'active', timezone: 'America/Los_Angeles', notes: '' });
  state.rules.push({ code: 'RULE-1', personId: 'P-1', kind: 'unavailable', date: '2026-02-19', startTime: '09:00', durationMins: 60, timezone: 'America/Los_Angeles', desc: '' });

  const result = executeActions(state, [{ type: 'add_rule', personId: 'P-1', kind: 'available', date: '2026-02-19', startTime: '09:30', durationMins: 60 }], { activePersonId: null, timezoneName: 'America/Los_Angeles' });

  assert.equal(result.nextState.rules.length, 1);
  assert.equal(result.nextState.rules[0].kind, 'available');
  assert.equal(result.effectsTextLines[0], 'This will remove 1 conflicting rule(s).');
  assert.equal(result.effectsTextLines.some((line) => line.includes('Remove conflicting UNAVAILABLE rule RULE-1')), true);
});

test('F: add_rule allows overlapping same-kind rules', () => {
  const state = createEmptyAppState();
  state.people.push({ personId: 'P-1', name: 'Jay Yap', cellE164: '+15555550123', cellDisplay: '+1 555 555 0123', status: 'active', timezone: 'America/Los_Angeles', notes: '' });
  state.rules.push({ code: 'RULE-1', personId: 'P-1', kind: 'unavailable', date: '2026-02-19', startTime: '09:00', durationMins: 60, timezone: 'America/Los_Angeles', desc: '' });

  const result = executeActions(state, [{ type: 'add_rule', personId: 'P-1', kind: 'unavailable', date: '2026-02-19', startTime: '09:30', durationMins: 60 }], { activePersonId: null, timezoneName: 'America/Los_Angeles' });

  assert.equal(result.nextState.rules.length, 2);
  assert.equal(result.effectsTextLines.some((line) => line.includes('conflicting rule')), false);
});

test('G: add unavailable rule removes overlapping available rules', () => {
  const state = createEmptyAppState();
  state.people.push({ personId: 'P-1', name: 'Jay Yap', cellE164: '+15555550123', cellDisplay: '+1 555 555 0123', status: 'active', timezone: 'America/Los_Angeles', notes: '' });
  state.rules.push({ code: 'RULE-1', personId: 'P-1', kind: 'available', date: '2026-02-19', startTime: '09:00', durationMins: 60, timezone: 'America/Los_Angeles', desc: '' });

  const result = executeActions(state, [{ type: 'add_rule', personId: 'P-1', kind: 'unavailable', date: '2026-02-19', startTime: '09:30', durationMins: 60 }], { activePersonId: null, timezoneName: 'America/Los_Angeles' });

  assert.equal(result.nextState.rules.length, 1);
  assert.equal(result.nextState.rules[0].kind, 'unavailable');
  assert.equal(result.effectsTextLines.some((line) => line.includes('Remove conflicting AVAILABLE rule RULE-1')), true);
});


test('H: create blank appointment uses defaults and next code', () => {
  const state = createEmptyAppState();
  state.appointments.push({ id: 'appt-1', code: 'APPT-2', title: 'Existing', assigned: [], people: [], location: '', notes: '' });
  const result = executeActions(state, [{ type: 'create_blank_appointment' }], { activePersonId: null, timezoneName: 'America/Los_Angeles' });
  const appt = result.nextState.appointments[1];
  assert.equal(appt.code, 'APPT-3');
  assert.equal(appt.title, '');
  assert.equal(appt.location, '');
  assert.equal(appt.notes, '');
  assert.deepEqual(appt.people, []);
});

test('I: set appointment date and start time clear keeps timing consistency', () => {
  const state = createEmptyAppState();
  state.appointments.push({ id: 'appt-1', code: 'APPT-1', title: 'Dentist', date: '2026-03-01', startTime: '09:00', durationMins: 30, start: '2026-03-01T09:00:00-08:00', end: '2026-03-01T09:30:00-08:00', isAllDay: false, timezone: 'America/Los_Angeles', assigned: [], people: [], location: '', notes: '' });

  let result = executeActions(state, [{ type: 'set_appointment_date', code: 'APPT-1', date: '2026-03-10' }], { activePersonId: null, timezoneName: 'America/Los_Angeles' });
  let appt = result.nextState.appointments[0];
  assert.equal(appt.date, '2026-03-10');
  assert.equal(appt.isAllDay, false);
  assert.equal(typeof appt.start, 'string');

  result = executeActions(result.nextState, [{ type: 'set_appointment_start_time', code: 'APPT-1', startTime: '' }], { activePersonId: null, timezoneName: 'America/Los_Angeles' });
  appt = result.nextState.appointments[0];
  assert.equal(appt.startTime, undefined);
  assert.equal(appt.durationMins, undefined);
  assert.equal(appt.isAllDay, true);
  assert.equal(appt.start, undefined);
  assert.equal(appt.end, undefined);
});
