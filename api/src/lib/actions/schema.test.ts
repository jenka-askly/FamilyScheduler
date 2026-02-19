import test from 'node:test';
import assert from 'node:assert/strict';
import { ParsedModelResponseSchema } from './schema.js';

test('rejects unknown fields in action', () => {
  assert.throws(() => ParsedModelResponseSchema.parse({
    kind: 'proposal',
    message: 'delete',
    actions: [{ type: 'delete_appointment', code: 'APPT-1', extra: true }]
  }));
});

test('validates date/startTime/durationMins', () => {
  assert.throws(() => ParsedModelResponseSchema.parse({ kind: 'proposal', message: 'x', actions: [{ type: 'add_appointment', desc: 'Dentist', date: '2026/03/03' }] }));
  assert.throws(() => ParsedModelResponseSchema.parse({ kind: 'proposal', message: 'x', actions: [{ type: 'add_appointment', desc: 'Dentist', date: '2026-03-03', startTime: '9:00' }] }));
  assert.throws(() => ParsedModelResponseSchema.parse({ kind: 'proposal', message: 'x', actions: [{ type: 'add_appointment', desc: 'Dentist', date: '2026-03-03', durationMins: 0 }] }));
});

test('accepts all-day add appointment with duration present', () => {
  const parsed = ParsedModelResponseSchema.parse({
    kind: 'proposal',
    message: 'add',
    actions: [{ type: 'add_appointment', desc: 'Dentist', date: '2026-03-03', durationMins: 30 }]
  });
  assert.equal(parsed.actions?.[0].type, 'add_appointment');
});

test('requires message', () => {
  assert.throws(() => ParsedModelResponseSchema.parse({ kind: 'clarify', actions: [] }));
});

test('parses confidence', () => {
  const parsed = ParsedModelResponseSchema.parse({
    kind: 'proposal',
    message: 'set identity',
    actions: [{ type: 'set_identity', name: 'Joe' }],
    confidence: 0.75
  });
  assert.equal(parsed.confidence, 0.75);
});
