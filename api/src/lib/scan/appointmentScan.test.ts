import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeImageBase64, applyParsedFields, hasMeaningfulParsedContent } from './appointmentScan.js';
import type { Appointment } from '../state.js';

const makeAppointment = (): Appointment => ({
  id: 'appt-1',
  code: 'APPT-1',
  title: 'Scanning…',
  schemaVersion: 2,
  updatedAt: new Date().toISOString(),
  assigned: [],
  people: [],
  location: '',
  locationRaw: '',
  locationDisplay: '',
  locationMapQuery: '',
  locationName: '',
  locationAddress: '',
  locationDirections: '',
  notes: '',
  timezone: 'America/Los_Angeles',
  date: '',
  isAllDay: false,
  scanStatus: 'pending',
  scanImageKey: null,
  scanImageMime: null,
  scanCapturedAt: new Date().toISOString(),
  scanAutoDate: true
});

test('decodeImageBase64 accepts raw base64 payloads', () => {
  const buffer = decodeImageBase64(Buffer.from('hello world').toString('base64'));
  assert.equal(buffer.toString('utf8'), 'hello world');
});

test('decodeImageBase64 accepts data URLs', () => {
  const base64 = Buffer.from('image-bytes').toString('base64');
  const buffer = decodeImageBase64(`data:image/jpeg;base64,${base64}`);
  assert.equal(buffer.toString('utf8'), 'image-bytes');
});

test('decodeImageBase64 rejects malformed base64', () => {
  assert.throws(() => decodeImageBase64('abc'), /invalid_image_base64/);
});

test('applyParsedFields replaces scanning placeholder title', () => {
  const appointment = makeAppointment();
  applyParsedFields(appointment, {
    title: null,
    date: '2026-03-10',
    startTime: '09:00',
    endTime: null,
    durationMins: 30,
    timezone: 'America/Los_Angeles',
    location: 'Victor clinic',
    notes: 'Follow-up with pediatrician.'
  }, 'initial');

  assert.notEqual(appointment.title, 'Scanning…');
  assert.equal(appointment.title, 'Follow-up with pediatrician');
});

test('hasMeaningfulParsedContent requires extracted fields', () => {
  assert.equal(hasMeaningfulParsedContent({ title: null, date: null, startTime: null, endTime: null, durationMins: null, timezone: null, location: null, notes: null }), false);
  assert.equal(hasMeaningfulParsedContent({ title: null, date: '2026-03-10', startTime: null, endTime: null, durationMins: null, timezone: null, location: null, notes: null }), true);
});
