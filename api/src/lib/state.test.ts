import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAppState, type AppState } from './state.js';

test('normalizes legacy appointments without notes to empty string', () => {
  const legacy = {
    version: 1,
    people: [{ id: 'person-joe', name: 'Joe' }],
    appointments: [{ id: 'appt-1', code: 'APPT-1', title: 'Dentist', assigned: [], people: [], location: '  Kaiser  ' }],
    availability: [],
    history: []
  } as unknown as AppState;

  const normalized = normalizeAppState(legacy);
  assert.equal(normalized.appointments[0].notes, '');
  assert.equal(normalized.appointments[0].locationRaw, '  Kaiser  ');
  assert.equal(normalized.appointments[0].locationDisplay, 'Kaiser');
  assert.equal(normalized.appointments[0].locationMapQuery, 'Kaiser');
  assert.equal(normalized.appointments[0].location, 'Kaiser');
  assert.equal(normalized.appointments[0].locationName, '');
  assert.equal(normalized.appointments[0].locationAddress, '');
  assert.equal(normalized.appointments[0].locationDirections, '');
});
