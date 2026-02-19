import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLocation } from './normalize.js';

test('normalizeLocation formats tabs, newlines, spaces, and commas', () => {
  const normalized = normalizeLocation('  Kaiser\tRedwood\nCity,,   CA  ');
  assert.equal(normalized.display, 'Kaiser, Redwood, City, CA');
  assert.equal(normalized.mapQuery, 'Kaiser, Redwood, City, CA');
});

test('normalizeLocation returns empty fields for empty values', () => {
  const normalized = normalizeLocation('   ,,,   ');
  assert.equal(normalized.display, '');
  assert.equal(normalized.mapQuery, '');
});
