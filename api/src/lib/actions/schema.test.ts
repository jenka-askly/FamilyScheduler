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

test('rejects invalid month format', () => {
  assert.throws(() => ParsedModelResponseSchema.parse({
    kind: 'reply',
    message: 'availability',
    actions: [{ type: 'who_is_available', month: '2026/03' }]
  }));
});

test('requires message', () => {
  assert.throws(() => ParsedModelResponseSchema.parse({ kind: 'clarify', actions: [] }));
});

test('parses update_appointment_schedule action', () => {
  const parsed = ParsedModelResponseSchema.parse({
    kind: 'proposal',
    message: 'reschedule',
    actions: [{ type: 'update_appointment_schedule', code: 'APPT-1', start: '2026-03-10T09:00:00-08:00', end: '2026-03-10T12:00:00-08:00', isAllDay: true }]
  });
  assert.equal(parsed.actions?.[0].type, 'update_appointment_schedule');
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

test('rejects invalid confidence', () => {
  assert.throws(() => ParsedModelResponseSchema.parse({
    kind: 'reply',
    message: 'help',
    actions: [{ type: 'help' }],
    confidence: 2
  }));
});
