import { randomUUID } from 'node:crypto';

const esc = (v: string): string => v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
const fmtUtc = (iso: string): string => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

export type NotificationSnapshot = {
  snapshotId: string;
  tsUtc: string;
  groupId: string;
  appointmentId: string;
  title: string;
  time: { startUtc: string; endUtc: string; timezone?: string; durationMins?: number };
  location: string;
  reconciliation: { status: 'reconciled' | 'unreconciled'; reasons: string[] };
  deepLink: string;
  actorEmail: string;
};

export const createNotificationSnapshot = (input: Omit<NotificationSnapshot, 'snapshotId' | 'tsUtc'> & { snapshotId?: string; tsUtc?: string }): NotificationSnapshot => ({
  ...input,
  snapshotId: input.snapshotId ?? randomUUID(),
  tsUtc: input.tsUtc ?? new Date().toISOString()
});

export const snapshotToIcs = (snapshot: NotificationSnapshot): { filename: string; content: string } => {
  const uid = `${snapshot.snapshotId}@yapper`;
  const dtStart = fmtUtc(snapshot.time.startUtc);
  const endUtc = snapshot.time.endUtc || new Date(new Date(snapshot.time.startUtc).getTime() + ((snapshot.time.durationMins ?? 60) * 60000)).toISOString();
  const dtEnd = fmtUtc(endUtc);
  const desc = [
    `Status: ${snapshot.reconciliation.status}`,
    ...snapshot.reconciliation.reasons.map((r) => `- ${r}`),
    `Open: ${snapshot.deepLink}`
  ].join('\n');
  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Yapper//Appointments//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${esc(uid)}`,
    `DTSTAMP:${fmtUtc(snapshot.tsUtc)}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${esc(snapshot.title || 'Appointment')}`,
    `LOCATION:${esc(snapshot.location || '')}`,
    `DESCRIPTION:${esc(desc)}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  return { filename: `appointment-${snapshot.appointmentId}-${snapshot.snapshotId}.ics`, content: `${content}\r\n` };
};
