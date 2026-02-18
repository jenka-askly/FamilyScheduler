import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyAppState } from '../state.js';
import { executeActions } from './executor.js';

test('add_availability uses explicit person name and creates code', () => {
  const state = createEmptyAppState();
  const result = executeActions(state, [{
    type: 'add_availability',
    personName: 'Joe',
    start: '2026-03-10T09:00:00-08:00',
    end: '2026-03-10T13:00:00-08:00',
    reason: 'out of town'
  }], { activePersonId: null, timezoneName: 'America/Los_Angeles' });

  assert.equal(result.nextState.availability.length, 1);
  assert.match(result.nextState.availability[0].code, /^AVL-JOE-\d+$/);
});

test('query action does not mutate state', () => {
  const state = createEmptyAppState();
  const before = JSON.stringify(state);
  const result = executeActions(state, [{ type: 'list_appointments' }], { activePersonId: null, timezoneName: 'America/Los_Angeles' });
  assert.equal(JSON.stringify(state), before);
  assert.equal(result.effectsTextLines[0], '(none)');
});
