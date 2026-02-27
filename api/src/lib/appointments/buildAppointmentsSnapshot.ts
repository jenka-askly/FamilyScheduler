import type { TimeSpec } from '../../../../packages/shared/src/types.js';
import type { Person } from '../state.js';
import { getTimeSpec } from '../time/timeSpec.js';
import { getAppointmentJson } from '../tables/appointments.js';
import { listAppointmentIndexesForGroup } from '../tables/entities.js';

export type AppointmentSnapshotItem = {
  id: string;
  code: string;
  desc: string;
  schemaVersion?: number;
  updatedAt?: string;
  time: ReturnType<typeof getTimeSpec>;
  date: string;
  startTime?: string;
  durationMins?: number;
  isAllDay: boolean;
  people: string[];
  peopleDisplay: string[];
  location: string;
  locationRaw: string;
  locationDisplay: string;
  locationMapQuery: string;
  locationName: string;
  locationAddress: string;
  locationDirections: string;
  notes: string;
  scanStatus: 'pending' | 'parsed' | 'failed' | 'deleted' | null;
  scanImageKey: string | null;
  scanImageMime: string | null;
  scanCapturedAt: string | null;
};

type ResponseAppointment = AppointmentSnapshotItem;

const deriveDateTimeParts = (start?: string, end?: string): { date: string; startTime?: string; durationMins?: number; isAllDay: boolean } => {
  if (!start || !end) return { date: start?.slice(0, 10) ?? '', isAllDay: true };
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return { date: start.slice(0, 10), isAllDay: true };
  const durationMins = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
  return { date: start.slice(0, 10), startTime: start.match(/T(\d{2}:\d{2})/)?.[1], durationMins, isAllDay: false };
};

export const buildAppointmentsSnapshot = async (
  groupId: string,
  timezone: string,
  people: Person[],
  traceId = 'unknown'
): Promise<ResponseAppointment[]> => {
  const indexes = await listAppointmentIndexesForGroup(groupId);
  const peopleById = new Map(people.map((person) => [person.personId, person.name]));
  const appointments: AppointmentSnapshotItem[] = [];

  for (const index of indexes) {
    const doc = await getAppointmentJson(groupId, index.appointmentId);
    if (!doc) {
      console.warn(JSON.stringify({ traceId, stage: 'appointments_snapshot_missing_blob', groupId, appointmentId: index.appointmentId }));
      continue;
    }

    const id = typeof doc.id === 'string' && doc.id.trim() ? doc.id.trim() : index.appointmentId;
    const code = typeof doc.code === 'string' && doc.code.trim() ? doc.code.trim() : `APPT-${index.appointmentId.slice(-6).toUpperCase()}`;
    const start = typeof doc.start === 'string' ? doc.start : undefined;
    const end = typeof doc.end === 'string' ? doc.end : undefined;
    const derived = deriveDateTimeParts(start, end);
    const peopleIds = Array.isArray(doc.people) ? doc.people.filter((item): item is string => typeof item === 'string') : [];
    const scanStatus = doc.scanStatus === 'pending' || doc.scanStatus === 'parsed' || doc.scanStatus === 'failed' || doc.scanStatus === 'deleted'
      ? doc.scanStatus
      : null;

    const legacyInput: Parameters<typeof getTimeSpec>[0] = {
      schemaVersion: typeof doc.schemaVersion === 'number' ? doc.schemaVersion : undefined,
      date: typeof doc.date === 'string' ? doc.date : undefined,
      startTime: typeof doc.startTime === 'string' ? doc.startTime : undefined,
      durationMins: typeof doc.durationMins === 'number' ? doc.durationMins : undefined,
      timezone: typeof doc.timezone === 'string' ? doc.timezone : timezone,
      isAllDay: typeof doc.isAllDay === 'boolean' ? doc.isAllDay : undefined,
      time: (doc.time && typeof doc.time === 'object' ? doc.time as TimeSpec : undefined),
      start,
      end
    };
    const appt = getTimeSpec(legacyInput, typeof doc.timezone === 'string' ? doc.timezone : timezone);

    const snapshotAppt: ResponseAppointment = {
      id,
      code,
      desc: typeof doc.title === 'string' ? doc.title : '',
      schemaVersion: typeof doc.schemaVersion === 'number' ? doc.schemaVersion : undefined,
      updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : undefined,
      time: appt,
      date: typeof doc.date === 'string' ? doc.date : derived.date,
      startTime: typeof doc.startTime === 'string' ? doc.startTime : derived.startTime,
      durationMins: typeof doc.durationMins === 'number' ? doc.durationMins : derived.durationMins,
      isAllDay: typeof doc.isAllDay === 'boolean' ? doc.isAllDay : derived.isAllDay,
      people: peopleIds,
      peopleDisplay: peopleIds.map((personId) => peopleById.get(personId) ?? personId),
      location: typeof doc.locationDisplay === 'string' ? doc.locationDisplay : (typeof doc.location === 'string' ? doc.location : ''),
      locationRaw: typeof doc.locationRaw === 'string' ? doc.locationRaw : '',
      locationDisplay: typeof doc.locationDisplay === 'string' ? doc.locationDisplay : (typeof doc.location === 'string' ? doc.location : ''),
      locationMapQuery: typeof doc.locationMapQuery === 'string' ? doc.locationMapQuery : (typeof doc.locationAddress === 'string' ? doc.locationAddress : (typeof doc.locationDisplay === 'string' ? doc.locationDisplay : (typeof doc.location === 'string' ? doc.location : ''))),
      locationName: typeof doc.locationName === 'string' ? doc.locationName : '',
      locationAddress: typeof doc.locationAddress === 'string' ? doc.locationAddress : '',
      locationDirections: typeof doc.locationDirections === 'string' ? doc.locationDirections : '',
      notes: typeof doc.notes === 'string' ? doc.notes : '',
      scanStatus,
      scanImageKey: typeof doc.scanImageKey === 'string' ? doc.scanImageKey : null,
      scanImageMime: typeof doc.scanImageMime === 'string' ? doc.scanImageMime : null,
      scanCapturedAt: typeof doc.scanCapturedAt === 'string' ? doc.scanCapturedAt : null
    };

    appointments.push(snapshotAppt);
  }

  return appointments;
};
