import type { AvailabilityRule } from '../state.js';

import { intervalBounds, overlaps, type Interval } from './interval.js';

type StatusReason = { ruleCode: string; kind: 'available' | 'unavailable'; desc?: string; interval: string };


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
