import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeChoices, isTimeOnlyMissingDateIntent } from './timeChoices.js';

test('isTimeOnlyMissingDateIntent detects unresolved time-only phrases', () => {
  assert.equal(isTimeOnlyMissingDateIntent({ status: 'unresolved', originalText: 'set time to 8pm', missing: ['date'] }, 'set time to 8pm'), true);
  assert.equal(isTimeOnlyMissingDateIntent({ status: 'resolved', originalText: 'tomorrow at 8pm' }, 'tomorrow at 8pm'), false);
  assert.equal(isTimeOnlyMissingDateIntent({ status: 'unresolved', originalText: 'tomorrow at 8pm', missing: ['date'] }, 'tomorrow at 8pm'), false);
});

test('buildTimeChoices returns today/next/appointment when today time is still future', () => {
  const choices = buildTimeChoices({
    whenText: 'set time to 8pm',
    timezone: 'America/Los_Angeles',
    nowIso: '2026-03-01T20:00:00.000Z',
    appointmentDateLocal: '2026-03-10'
  });

  assert.equal(choices.length, 3);
  assert.deepEqual(choices.map((choice) => choice.id), ['today', 'next', 'appointment']);
  assert.equal(choices[2]?.dateLocal, '2026-03-10');
});

test('buildTimeChoices omits today when time already passed and falls back appointment to next', () => {
  const choices = buildTimeChoices({
    whenText: 'set time to 8pm',
    timezone: 'America/Los_Angeles',
    nowIso: '2026-03-02T05:00:00.000Z',
    appointmentDateLocal: undefined
  });

  assert.equal(choices.length, 2);
  assert.deepEqual(choices.map((choice) => choice.id), ['next', 'appointment']);
  assert.equal(choices[0]?.dateLocal, '2026-03-02');
  assert.equal(choices[1]?.dateLocal, choices[0]?.dateLocal);
});
