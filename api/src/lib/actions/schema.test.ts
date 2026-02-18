import test from 'node:test';
import assert from 'node:assert/strict';
import { ParsedModelResponseSchema } from './schema.js';

test('rejects unknown fields in action', () => {
  assert.throws(() => ParsedModelResponseSchema.parse({
    kind: 'mutation',
    actions: [{ type: 'delete_appointment', code: 'APPT-1', extra: true }]
  }));
});

test('rejects invalid codes', () => {
  assert.throws(() => ParsedModelResponseSchema.parse({
    kind: 'mutation',
    actions: [{ type: 'delete_appointment', code: 'bad' }]
  }));
});

test('requires clarify question', () => {
  assert.throws(() => ParsedModelResponseSchema.parse({ kind: 'clarify', actions: [] }));
});
