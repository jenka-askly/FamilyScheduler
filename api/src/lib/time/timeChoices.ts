import type { TimeIntent } from '../../../../packages/shared/src/types.js';

export type TimeChoice = {
  id: 'today' | 'next' | 'appointment';
  label: string;
  dateLocal: string;
  startUtc: string;
  endUtc: string;
  timezone: string;
};

type BuildTimeChoicesArgs = {
  whenText: string;
  timezone: string;
  nowIso: string;
  appointmentDateLocal?: string;
};

const AM_PM_TIME = /\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i;
const TWENTY_FOUR_HOUR_TIME = /\b([01]?\d|2[0-3]):([0-5]\d)\b/;
const EXPLICIT_DATE_ANCHOR = /\b(today|tomorrow|tonight|next\s+(?:week|month|year|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)|this\s+(?:week|weekend|month|year)|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{4}-\d{2}-\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2})\b/i;

const DATE_FORMATTER = (timezone: string): Intl.DateTimeFormat => new Intl.DateTimeFormat('en-CA', {
  timeZone: timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const toLocalDate = (date: Date, timezone: string): string => DATE_FORMATTER(timezone).format(date);

const parseTimeOfDay = (whenText: string): { hour: number; minute: number } | null => {
  const meridiem = whenText.match(AM_PM_TIME);
  if (meridiem) {
    const hourPart = Number(meridiem[1]);
    const minutePart = Number(meridiem[2] ?? '0');
    const marker = meridiem[3].toLowerCase();
    let hour = hourPart;
    if (marker === 'pm' && hour < 12) hour += 12;
    if (marker === 'am' && hour === 12) hour = 0;
    return { hour, minute: minutePart };
  }

  const twentyFour = whenText.match(TWENTY_FOUR_HOUR_TIME);
  if (twentyFour) {
    return { hour: Number(twentyFour[1]), minute: Number(twentyFour[2]) };
  }

  return null;
};

const parseDateLocal = (dateLocal: string): { year: number; month: number; day: number } => {
  const [year, month, day] = dateLocal.split('-').map(Number);
  return { year, month, day };
};

const localDatePlusDays = (dateLocal: string, days: number): string => {
  const { year, month, day } = parseDateLocal(dateLocal);
  const next = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0, 0));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
};

const timezoneOffsetMinutes = (utcDate: Date, timezone: string): number => {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });
  const parts = dtf.formatToParts(utcDate);
  const lookup = (type: string): number => Number(parts.find((part) => part.type === type)?.value ?? '0');
  const asUtc = Date.UTC(lookup('year'), lookup('month') - 1, lookup('day'), lookup('hour'), lookup('minute'), lookup('second'));
  return (asUtc - utcDate.getTime()) / 60_000;
};

const localDateTimeToUtc = (dateLocal: string, hour: number, minute: number, timezone: string): Date => {
  const { year, month, day } = parseDateLocal(dateLocal);
  let utcMillis = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  for (let index = 0; index < 4; index += 1) {
    const offset = timezoneOffsetMinutes(new Date(utcMillis), timezone);
    const nextUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0) - (offset * 60_000);
    if (nextUtc === utcMillis) break;
    utcMillis = nextUtc;
  }
  return new Date(utcMillis);
};

const buildChoice = (id: TimeChoice['id'], label: string, dateLocal: string, hour: number, minute: number, timezone: string): TimeChoice => {
  const start = localDateTimeToUtc(dateLocal, hour, minute, timezone);
  const end = new Date(start.getTime() + 60 * 60_000);
  return { id, label, dateLocal, startUtc: start.toISOString(), endUtc: end.toISOString(), timezone };
};

export const isTimeOnlyMissingDateIntent = (intent: TimeIntent, whenText: string): boolean => {
  if (intent.status !== 'unresolved') return false;
  if (!intent.missing?.includes('date')) return false;
  if (!parseTimeOfDay(whenText)) return false;
  if (EXPLICIT_DATE_ANCHOR.test(whenText)) return false;
  return true;
};

export const buildTimeChoices = ({ whenText, timezone, nowIso, appointmentDateLocal }: BuildTimeChoicesArgs): TimeChoice[] => {
  const parsedTime = parseTimeOfDay(whenText);
  if (!parsedTime) return [];

  const now = new Date(nowIso);
  const todayDateLocal = toLocalDate(now, timezone);
  const tomorrowDateLocal = localDatePlusDays(todayDateLocal, 1);
  const choices: TimeChoice[] = [];

  const todayChoice = buildChoice('today', 'Today', todayDateLocal, parsedTime.hour, parsedTime.minute, timezone);
  if (Date.parse(todayChoice.startUtc) > now.getTime()) {
    choices.push(todayChoice);
  }

  const nextDateLocal = choices.some((choice) => choice.id === 'today') ? tomorrowDateLocal : todayDateLocal;
  choices.push(buildChoice('next', 'Next available', nextDateLocal, parsedTime.hour, parsedTime.minute, timezone));

  const appointmentAnchor = appointmentDateLocal && /^\d{4}-\d{2}-\d{2}$/.test(appointmentDateLocal)
    ? appointmentDateLocal
    : nextDateLocal;
  choices.push(buildChoice('appointment', 'On appointment date', appointmentAnchor, parsedTime.hour, parsedTime.minute, timezone));

  return choices;
};
