import { createHash } from 'node:crypto';

export type AppointmentSnapshot = {
  v: 1;
  title?: string;
  startIso?: string;
  endIso?: string;
  tz?: string;
  location?: string;
  status?: string;
  notesHash?: string;
};

export type AppointmentDiffItem =
  | { field: 'title'; from?: string; to?: string }
  | { field: 'time'; from?: { startIso?: string; endIso?: string; tz?: string }; to?: { startIso?: string; endIso?: string; tz?: string } }
  | { field: 'location'; from?: string; to?: string }
  | { field: 'status'; from?: string; to?: string }
  | { field: 'notes'; changed: true };

const normalize = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const normalizeIso = (value: unknown): string | undefined => {
  const text = normalize(value);
  if (!text) return undefined;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
};

const buildIsoFromDateAndTime = (dateText?: string, timeText?: string): string | undefined => {
  if (!dateText) return undefined;
  if (!timeText) return normalizeIso(`${dateText}T00:00:00.000Z`);
  return normalizeIso(`${dateText}T${timeText}:00.000Z`);
};

const extractTimeBlock = (appt: any): { startIso?: string; endIso?: string; tz?: string } => {
  const resolved = (appt?.time && typeof appt.time === 'object' && appt.time.resolved && typeof appt.time.resolved === 'object') ? appt.time.resolved : null;
  const tz = normalize(appt?.timezone) ?? normalize(appt?.tz) ?? normalize(resolved?.timezone);
  const startIso = normalizeIso(resolved?.startUtc) ?? normalizeIso(appt?.start) ?? buildIsoFromDateAndTime(normalize(appt?.date), normalize(appt?.startTime));
  const endIso = normalizeIso(resolved?.endUtc) ?? normalizeIso(appt?.end);
  return { startIso, endIso, tz };
};

const hashNotes = (notes: string): string => createHash('sha256').update(notes).digest('hex').slice(0, 12);

export const buildAppointmentSnapshot = (appt: any): AppointmentSnapshot => {
  const time = extractTimeBlock(appt);
  const notes = normalize(appt?.notes);
  return {
    v: 1,
    title: normalize(appt?.title) ?? normalize(appt?.desc),
    startIso: time.startIso,
    endIso: time.endIso,
    tz: time.tz,
    location: normalize(appt?.locationDisplay) ?? normalize(appt?.location),
    status: normalize(appt?.status),
    ...(notes ? { notesHash: hashNotes(notes) } : {})
  };
};

export const diffAppointmentSnapshots = (prev?: AppointmentSnapshot, cur?: AppointmentSnapshot): AppointmentDiffItem[] => {
  if (!prev || !cur) return [];
  const items: AppointmentDiffItem[] = [];

  if ((prev.status ?? undefined) !== (cur.status ?? undefined)) {
    items.push({ field: 'status', from: prev.status, to: cur.status });
  }

  if (
    (prev.startIso ?? undefined) !== (cur.startIso ?? undefined)
    || (prev.endIso ?? undefined) !== (cur.endIso ?? undefined)
    || (prev.tz ?? undefined) !== (cur.tz ?? undefined)
  ) {
    items.push({
      field: 'time',
      from: { startIso: prev.startIso, endIso: prev.endIso, tz: prev.tz },
      to: { startIso: cur.startIso, endIso: cur.endIso, tz: cur.tz }
    });
  }

  if ((prev.location ?? undefined) !== (cur.location ?? undefined)) {
    items.push({ field: 'location', from: prev.location, to: cur.location });
  }

  if ((prev.title ?? undefined) !== (cur.title ?? undefined)) {
    items.push({ field: 'title', from: prev.title, to: cur.title });
  }

  if ((prev.notesHash ?? undefined) !== (cur.notesHash ?? undefined)) {
    items.push({ field: 'notes', changed: true });
  }

  return items;
};
