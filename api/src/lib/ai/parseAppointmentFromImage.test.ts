import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeParsedAppointmentsFromImage } from './parseAppointmentFromImage.js';

test('normalizeParsedAppointmentsFromImage accepts legacy single object', () => {
  const items = normalizeParsedAppointmentsFromImage(JSON.stringify({
    title: 'Flight to NYC',
    date: '2026-06-10',
    startTime: '08:30',
    endTime: null,
    durationMins: 180,
    timezone: 'America/Los_Angeles',
    location: 'LAX',
    notes: 'Outbound flight'
  }), 'America/Los_Angeles');

  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Flight to NYC');
});

test('normalizeParsedAppointmentsFromImage accepts envelope appointment list', () => {
  const items = normalizeParsedAppointmentsFromImage(JSON.stringify({
    appointments: [
      { title: 'Outbound', date: '2026-06-10', startTime: '08:30' },
      { title: 'Return', date: '2026-06-14', startTime: '18:00' }
    ]
  }), 'America/Los_Angeles');

  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Outbound');
  assert.equal(items[1].title, 'Return');
});

test('normalizeParsedAppointmentsFromImage returns empty array when none found', () => {
  const items = normalizeParsedAppointmentsFromImage(JSON.stringify({ appointments: [] }), 'America/Los_Angeles');
  assert.deepEqual(items, []);
});
