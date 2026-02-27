import test from 'node:test';
import assert from 'node:assert/strict';
import { activeSuggestionsByField, ensureAppointmentDoc, evaluateReconciliation, newSuggestion, removeConstraintForMember, upsertConstraintForMember } from './appointmentDomain.js';

test('suggestion cap helper scenario has at least three active by proposer', () => {
  const base = ensureAppointmentDoc({}, 'person@example.com');
  const a = newSuggestion({ proposerEmail: 'person@example.com', field: 'title', value: 'A' });
  const b = newSuggestion({ proposerEmail: 'person@example.com', field: 'title', value: 'B' });
  const c = newSuggestion({ proposerEmail: 'person@example.com', field: 'title', value: 'C' });
  const doc = { ...base, suggestions: { byField: { title: [a, b, c] } } } as Record<string, unknown>;
  assert.equal(activeSuggestionsByField(doc, 'title').length, 3);
});

test('constraint add/edit/remove updates reconciliation status', () => {
  const base = ensureAppointmentDoc({ title: 'Lunch' }, 'person@example.com');
  const add = upsertConstraintForMember(base, 'person@example.com', { field: 'title', operator: 'equals', value: 'Dinner' });
  const unreconciled = evaluateReconciliation(add.doc, 'person@example.com');
  assert.equal(unreconciled.status, 'unreconciled');
  const edit = upsertConstraintForMember(unreconciled.doc, 'person@example.com', { constraintId: add.added.id, field: 'title', operator: 'equals', value: 'Lunch' });
  const reconciled = evaluateReconciliation(edit.doc, 'person@example.com');
  assert.equal(reconciled.status, 'reconciled');
  const removed = removeConstraintForMember(reconciled.doc, 'person@example.com', add.added.id);
  assert.ok(removed.removed);
});
