import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeChoicesForUnresolvedTimeOnly, isTimeOnlyMissingDateIntent } from './timeChoices.js';

test('isTimeOnlyMissingDateIntent detects unresolved time-only phrases', () => {
  assert.equal(isTimeOnlyMissingDateIntent({ status: 'unresolved', originalText: 'set time to 8pm', missing: ['date'] }, 'set time to 8pm'), true);
  assert.equal(isTimeOnlyMissingDateIntent({ status: 'partial', originalText: 'set time to 8pm', missing: ['date'] }, 'set time to 8pm'), true);
  assert.equal(isTimeOnlyMissingDateIntent({ status: 'resolved', originalText: 'tomorrow at 8pm' }, 'tomorrow at 8pm'), false);
  assert.equal(isTimeOnlyMissingDateIntent({ status: 'unresolved', originalText: 'tomorrow at 8pm', missing: ['date'] }, 'tomorrow at 8pm'), false);
});

test('buildTimeChoicesForUnresolvedTimeOnly returns deterministic three choices with timezone-correct UTCs', () => {
  const choices = buildTimeChoicesForUnresolvedTimeOnly({
    whenText: '8pm',
    timezone: 'America/Los_Angeles',
    nowIso: '2026-02-27T06:58:00.809Z'
  });

  assert.equal(choices.length, 3);
  assert.deepEqual(choices.map((choice) => choice.id), ['today', 'tomorrow', 'appointment']);
  assert.equal(choices[0]?.dateLocal, '2026-02-26');
  assert.equal(choices[0]?.startUtc, '2026-02-27T04:00:00.000Z');
  assert.equal(choices[1]?.dateLocal, '2026-02-27');
  assert.equal(choices[1]?.startUtc, '2026-02-28T04:00:00.000Z');
  assert.equal(choices[2]?.dateLocal, '2026-02-26');
  assert.equal(choices[0]?.isPast, true);
});

test('buildTimeChoicesForUnresolvedTimeOnly keeps appointment date when provided', () => {
  const choices = buildTimeChoicesForUnresolvedTimeOnly({
    whenText: 'set time to 8pm',
    timezone: 'America/Los_Angeles',
    nowIso: '2026-03-02T05:00:00.000Z',
    appointmentDateLocal: '2026-03-10'
  });

  assert.equal(choices.length, 3);
  assert.deepEqual(choices.map((choice) => choice.id), ['today', 'tomorrow', 'appointment']);
  assert.equal(choices[2]?.dateLocal, '2026-03-10');
});
