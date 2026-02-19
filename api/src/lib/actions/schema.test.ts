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

test('parses update_appointment_schedule action', () => {
  const parsed = ParsedModelResponseSchema.parse({
    kind: 'mutation',
    actions: [{ type: 'update_appointment_schedule', code: 'APPT-1', start: '2026-03-10T09:00:00-08:00', end: '2026-03-10T12:00:00-08:00', isAllDay: true }]
  });
  assert.equal(parsed.actions[0].type, 'update_appointment_schedule');
});

test('parses reschedule_appointment action', () => {
  const parsed = ParsedModelResponseSchema.parse({
    kind: 'mutation',
    actions: [{ type: 'reschedule_appointment', code: 'APPT-1', start: '2026-03-11T09:00:00-08:00', end: '2026-03-11T10:00:00-08:00', timezone: 'America/Los_Angeles' }]
  });
  assert.equal(parsed.actions[0].type, 'reschedule_appointment');
});


test('parses confidence and needsConfirmation', () => {
  const parsed = ParsedModelResponseSchema.parse({
    kind: 'mutation',
    actions: [{ type: 'set_identity', name: 'Joe' }],
    confidence: 0.75,
    needsConfirmation: false
  });
  assert.equal(parsed.confidence, 0.75);
  assert.equal(parsed.needsConfirmation, false);
});

test('rejects invalid confidence', () => {
  assert.throws(() => ParsedModelResponseSchema.parse({
    kind: 'query',
    actions: [{ type: 'help' }],
    confidence: 2
  }));
});
