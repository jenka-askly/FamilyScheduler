import { randomUUID } from 'node:crypto';
import type { AppState, Appointment } from '../state.js';
import type { StorageAdapter } from '../storage/storage.js';
import { normalizeLocation } from '../location/normalize.js';
import { parseAppointmentFromImage, type ParsedAppointmentFromImage } from '../ai/parseAppointmentFromImage.js';

export const MAX_SCAN_BYTES = 3 * 1024 * 1024;
export const scanMimeToExt = (mime: string): 'jpg' | 'png' | 'webp' => (mime === 'image/png' ? 'png' : (mime === 'image/webp' ? 'webp' : 'jpg'));
export const scanBlobKey = (groupId: string, appointmentId: string, mime: string): string => `familyscheduler/groups/${groupId}/appointments/${appointmentId}/scan/scan.${scanMimeToExt(mime)}`;

export const decodeImageBase64 = (value: string): Buffer => {
  const cleaned = value.replace(/\s+/g, '');
  const bytes = Buffer.from(cleaned, 'base64');
  if (!bytes.length || bytes.toString('base64') !== cleaned.replace(/=+$/, (m) => '='.repeat(m.length))) throw new Error('invalid_image_base64');
  if (bytes.length > MAX_SCAN_BYTES) throw new Error('image_too_large');
  return bytes;
};

export const createScannedAppointment = (state: AppState, timezone: string): Appointment => {
  const nextNum = state.appointments.reduce((m, a) => {
    const k = a.code.match(/^APPT-(\d+)$/i);
    return k ? Math.max(m, Number(k[1])) : m;
  }, 0) + 1;
  const code = `APPT-${nextNum}`;
  return {
    id: `${Date.now()}-${randomUUID()}`,
    code,
    title: 'Scanned item',
    schemaVersion: 2,
    updatedAt: new Date().toISOString(),
    assigned: [],
    people: [],
    location: '', locationRaw: '', locationDisplay: '', locationMapQuery: '', locationName: '', locationAddress: '', locationDirections: '',
    notes: '',
    timezone,
    date: new Date().toISOString().slice(0, 10),
    isAllDay: true,
    scanStatus: 'pending',
    scanImageKey: null,
    scanImageMime: null,
    scanCapturedAt: new Date().toISOString()
  };
};

export const applyParsedFields = (appointment: Appointment, parsed: ParsedAppointmentFromImage, mode: 'initial' | 'rescan'): void => {
  const take = (curr: string | undefined, next: string | null): string => (mode === 'rescan' ? (next ?? '') : (curr?.trim() ? curr : (next ?? '')));
  appointment.title = take(appointment.title, parsed.title) || appointment.title;
  appointment.date = mode === 'rescan' ? (parsed.date ?? appointment.date ?? new Date().toISOString().slice(0, 10)) : (appointment.date || parsed.date || appointment.date);
  appointment.startTime = mode === 'rescan' ? (parsed.startTime ?? undefined) : (appointment.startTime ?? parsed.startTime ?? undefined);
  appointment.durationMins = mode === 'rescan' ? (parsed.durationMins ?? undefined) : (appointment.durationMins ?? parsed.durationMins ?? undefined);
  appointment.timezone = mode === 'rescan' ? (parsed.timezone ?? appointment.timezone) : (appointment.timezone ?? parsed.timezone ?? appointment.timezone);
  appointment.notes = take(appointment.notes, parsed.notes);
  const locationValue = take(appointment.locationRaw, parsed.location);
  const loc = normalizeLocation(locationValue);
  appointment.locationRaw = locationValue;
  appointment.locationDisplay = loc.display;
  appointment.locationMapQuery = loc.mapQuery;
  appointment.location = loc.display;
  appointment.locationName = '';
  appointment.locationAddress = '';
  appointment.locationDirections = '';
};

export const parseAndApplyScan = async (storage: StorageAdapter, state: AppState, groupId: string, appointment: Appointment, imageBase64: string, imageMime: 'image/jpeg' | 'image/png' | 'image/webp', timezone: string | undefined, mode: 'initial' | 'rescan', traceId: string): Promise<void> => {
  try {
    const parsed = await parseAppointmentFromImage({ imageBase64, imageMime, timezone, traceId });
    applyParsedFields(appointment, parsed, mode);
    appointment.scanStatus = 'parsed';
  } catch (error) {
    appointment.scanStatus = 'failed';
    console.warn(JSON.stringify({ traceId, stage: 'scan_parse_failed', groupId, appointmentId: appointment.id, message: error instanceof Error ? error.message : String(error) }));
  }
};
