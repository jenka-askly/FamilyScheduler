import test from 'node:test';
import assert from 'node:assert/strict';
import { TABLE_KEY_SEP, validateTableKey } from './tableKeys.js';
import { rowKeyFromIso } from './entities.js';

test('TABLE_KEY_SEP is pipe', () => {
  assert.equal(TABLE_KEY_SEP, '|');
});

test('validateTableKey rejects Azure-invalid characters', () => {
  assert.throws(() => validateTableKey('user#2026-01-01'));
  assert.throws(() => validateTableKey('user/2026-01-01'));
  assert.throws(() => validateTableKey('user\\2026-01-01'));
  assert.throws(() => validateTableKey('user?2026-01-01'));
  assert.throws(() => validateTableKey(`user${String.fromCharCode(10)}2026-01-01`));
});

test('rowKeyFromIso uses TABLE_KEY_SEP instead of hash', () => {
  const rowKey = rowKeyFromIso('2026-01-02T03:04:05.000Z', 'apt-123');
  assert.equal(rowKey, `20260102T030405Z${TABLE_KEY_SEP}apt-123`);
  assert.equal(rowKey.includes('#'), false);
});
