import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotificationSnapshot, snapshotToIcs } from './notificationSnapshot.js';

test('creates snapshot with defaults', () => {
  const snap = createNotificationSnapshot({
    groupId: 'g1', appointmentId: 'a1', title: 'Dentist',
    time: { startUtc: '2026-01-01T17:00:00.000Z', endUtc: '2026-01-01T18:00:00.000Z' },
    location: 'Clinic', reconciliation: { status: 'reconciled', reasons: [] }, deepLink: '/#/g/g1/app?appointmentId=a1', actorEmail: 'a@example.com'
  });
  assert.ok(snap.snapshotId);
  assert.ok(snap.tsUtc);
});

test('renders ICS from snapshot', () => {
  const snap = createNotificationSnapshot({
    snapshotId: 'snap-1',
    tsUtc: '2026-01-01T10:00:00.000Z',
    groupId: 'g1', appointmentId: 'a1', title: 'Dentist',
    time: { startUtc: '2026-01-01T17:00:00.000Z', endUtc: '2026-01-01T18:00:00.000Z' },
    location: 'Clinic', reconciliation: { status: 'unreconciled', reasons: ['Time is required.'] }, deepLink: '/#/g/g1/app?appointmentId=a1', actorEmail: 'a@example.com'
  });
  const ics = snapshotToIcs(snap);
  assert.equal(ics.filename.includes('snap-1'), true);
  assert.match(ics.content, /BEGIN:VCALENDAR/);
  assert.match(ics.content, /SUMMARY:Dentist/);
  assert.match(ics.content, /DTSTART:20260101T170000Z/);
});
