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

test('validates people operation cardinality and normalization', () => {
  assert.throws(() => ParsedModelResponseSchema.parse({ kind: 'proposal', message: 'x', actions: [{ type: 'add_people_to_appointment', code: 'APPT-1', people: [] }] }));
  const parsed = ParsedModelResponseSchema.parse({
    kind: 'proposal',
    message: 'x',
    actions: [{ type: 'replace_people_on_appointment', code: 'APPT-1', people: ['  Joe  Smith  ', 'Sam'] }]
  });
  assert.deepEqual((parsed.actions?.[0] as any).people, ['Joe Smith', 'Sam']);
});

test('validates appointment location constraints', () => {
  const parsed = ParsedModelResponseSchema.parse({
    kind: 'proposal',
    message: 'loc',
    actions: [{ type: 'set_appointment_location', code: 'APPT-1', location: '  Kaiser Redwood City  ' }]
  });
  assert.equal((parsed.actions?.[0] as any).location, 'Kaiser Redwood City');
  assert.throws(() => ParsedModelResponseSchema.parse({
    kind: 'proposal',
    message: 'loc',
    actions: [{ type: 'set_appointment_location', code: 'APPT-1', location: 'x'.repeat(201) }]
  }));
});

test('requires message', () => {
  assert.throws(() => ParsedModelResponseSchema.parse({ kind: 'question', actions: [] }));
});

test('maps clarify to question for backward compatibility', () => {
  const parsed = ParsedModelResponseSchema.parse({ kind: 'clarify', message: 'Need input' });
  assert.equal(parsed.kind, 'question');
  assert.equal(parsed.allowFreeText, true);
});

test('accepts question options and allowFreeText', () => {
  const parsed = ParsedModelResponseSchema.parse({
    kind: 'question',
    message: 'Update or create?',
    options: [
      { label: 'Update APPT-6', value: 'Update APPT-6 with these details', style: 'primary' },
      { label: 'Create new', value: 'Create a new appointment with these details', style: 'secondary' }
    ],
    allowFreeText: false
  });
  assert.equal(parsed.kind, 'question');
  assert.equal(parsed.options?.length, 2);
  assert.equal(parsed.allowFreeText, false);
});

test('rejects too many question options', () => {
  assert.throws(() => ParsedModelResponseSchema.parse({
    kind: 'question',
    message: 'Pick one',
    options: [1, 2, 3, 4, 5, 6].map((index) => ({ label: `L${index}`, value: `V${index}` }))
  }));
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


test('validates appointment notes constraints', () => {
  const parsed = ParsedModelResponseSchema.parse({
    kind: 'proposal',
    message: 'notes',
    actions: [{ type: 'set_appointment_notes', code: 'APPT-1', notes: '  Bring insurance card  ' }]
  });
  assert.equal((parsed.actions?.[0] as any).notes, 'Bring insurance card');
  assert.throws(() => ParsedModelResponseSchema.parse({
    kind: 'proposal',
    message: 'notes',
    actions: [{ type: 'set_appointment_notes', code: 'APPT-1', notes: 'x'.repeat(501) }]
  }));
});
