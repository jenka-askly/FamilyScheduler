import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFlexibleDate } from './parseDate.js';

test('parseFlexibleDate supports required formats', () => {
  assert.equal(parseFlexibleDate('2026-03-28'), '2026-03-28');
  assert.equal(parseFlexibleDate('28-03-2026'), '2026-03-28');
  assert.equal(parseFlexibleDate('March 28 2026'), '2026-03-28');
  assert.equal(parseFlexibleDate('Feb 19 2026'), '2026-02-19');
});
