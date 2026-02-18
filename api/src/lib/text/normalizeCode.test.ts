import test from 'node:test';
import assert from 'node:assert/strict';
import { looksLikeSingleCodeToken, normalizeAppointmentCode, normalizeAvailabilityCode } from './normalizeCode.js';

test('normalizeAppointmentCode handles mixed casing and separators', () => {
  assert.equal(normalizeAppointmentCode('appt1'), 'APPT-1');
  assert.equal(normalizeAppointmentCode('APPT1'), 'APPT-1');
  assert.equal(normalizeAppointmentCode('ApPt-1'), 'APPT-1');
  assert.equal(normalizeAppointmentCode('APPT 1'), 'APPT-1');
  assert.equal(normalizeAppointmentCode('APPT-0'), null);
});

test('normalizeAvailabilityCode accepts strict and relaxed suffix formatting', () => {
  assert.equal(normalizeAvailabilityCode('AVL-JOE-1'), 'AVL-JOE-1');
  assert.equal(normalizeAvailabilityCode('avl-joe1'), 'AVL-JOE-1');
  assert.equal(normalizeAvailabilityCode('AVL-JOE-0'), null);
});

test('looksLikeSingleCodeToken detects APPT/AVL-like tokens', () => {
  assert.equal(looksLikeSingleCodeToken('APPt1'), true);
  assert.equal(looksLikeSingleCodeToken('avl-joe1'), true);
  assert.equal(looksLikeSingleCodeToken('delete appt1'), false);
});
