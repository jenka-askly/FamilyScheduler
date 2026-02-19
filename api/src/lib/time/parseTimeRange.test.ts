import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTimeRange } from './parseTimeRange.js';

test('parseTimeRange supports 12-hour and 24-hour ranges', () => {
  assert.deepEqual(parseTimeRange('9am to 10am'), { startHHMM: '09:00', endHHMM: '10:00' });
  assert.deepEqual(parseTimeRange('9am-10am'), { startHHMM: '09:00', endHHMM: '10:00' });
  assert.deepEqual(parseTimeRange('09:00-10:00'), { startHHMM: '09:00', endHHMM: '10:00' });
  assert.deepEqual(parseTimeRange('9:30am to 10:15am'), { startHHMM: '09:30', endHHMM: '10:15' });
});

test('parseTimeRange rejects invalid ranges', () => {
  assert.equal(parseTimeRange('10am to 9am'), null);
  assert.equal(parseTimeRange('noon'), null);
});
