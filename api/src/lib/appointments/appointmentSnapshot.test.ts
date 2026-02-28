import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAppointmentSnapshot, diffAppointmentSnapshots } from './appointmentSnapshot.js';

test('buildAppointmentSnapshot hashes notes and omits plain notes', () => {
  const snapshot = buildAppointmentSnapshot({
    desc: 'Checkup',
    date: '2026-02-27',
    startTime: '10:15',
    timezone: 'America/New_York',
    locationDisplay: 'Clinic',
    notes: 'bring insurance card'
  });

  assert.equal(snapshot.v, 1);
  assert.equal(snapshot.title, 'Checkup');
  assert.equal(snapshot.tz, 'America/New_York');
  assert.equal(snapshot.location, 'Clinic');
  assert.equal(typeof snapshot.notesHash, 'string');
  assert.equal(snapshot.notesHash?.length, 12);
  assert.equal('notes' in (snapshot as Record<string, unknown>), false);
});

test('diffAppointmentSnapshots is deterministic and includes notes changes', () => {
  const prev = {
    v: 1 as const,
    title: 'Visit',
    startIso: '2026-02-27T10:15:00.000Z',
    endIso: '2026-02-27T11:15:00.000Z',
    tz: 'America/New_York',
    location: 'Room 1',
    status: 'tentative',
    notesHash: 'aaaaaaaaaaaa'
  };
  const cur = {
    ...prev,
    title: 'Updated Visit',
    startIso: '2026-02-27T11:15:00.000Z',
    endIso: '2026-02-27T12:15:00.000Z',
    location: 'Room 2',
    status: 'confirmed',
    notesHash: 'bbbbbbbbbbbb'
  };

  const diff = diffAppointmentSnapshots(prev, cur);
  assert.deepEqual(diff.map((item) => item.field), ['status', 'time', 'location', 'title', 'notes']);
  assert.equal(diff[4]?.field, 'notes');
});
