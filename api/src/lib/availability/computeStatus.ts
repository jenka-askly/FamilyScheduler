import type { AvailabilityRule } from '../state.js';

export type Interval = { date: string; startTime?: string; durationMins?: number };

type StatusReason = { ruleCode: string; kind: 'available' | 'unavailable'; desc?: string; interval: string };

const toMinutes = (time?: string): number => {
  if (!time) return 0;
  const [hh, mm] = time.split(':').map(Number);
  return (hh * 60) + mm;
};

const intervalBounds = (input: Interval): { start: number; end: number } => {
  if (!input.startTime) return { start: 0, end: 24 * 60 };
  const start = toMinutes(input.startTime);
  return { start, end: Math.min(24 * 60, start + (input.durationMins ?? 60)) };
};

const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }): boolean => a.start < b.end && a.end > b.start;

export const computePersonStatusForInterval = (
  personId: string,
  interval: Interval,
  rules: AvailabilityRule[]
): { status: 'available' | 'unavailable' | 'unknown'; reasons: StatusReason[] } => {
  const appointmentBounds = intervalBounds(interval);
  const matches = rules
    .filter((rule) => rule.personId === personId && rule.date === interval.date)
    .filter((rule) => overlaps(appointmentBounds, intervalBounds({ date: rule.date, startTime: rule.startTime, durationMins: rule.startTime ? rule.durationMins : undefined })))
    .map((rule) => ({
      ruleCode: rule.code,
      kind: rule.kind,
      desc: rule.desc,
      interval: rule.startTime ? `${rule.date} ${rule.startTime} (${rule.durationMins ?? 60}m)` : `${rule.date} (all day)`
    }));

  if (matches.some((match) => match.kind === 'unavailable')) {
    return { status: 'unavailable', reasons: matches.filter((match) => match.kind === 'unavailable') };
  }
  if (matches.some((match) => match.kind === 'available')) {
    return { status: 'available', reasons: matches.filter((match) => match.kind === 'available') };
  }
  return { status: 'unknown', reasons: [] };
};
