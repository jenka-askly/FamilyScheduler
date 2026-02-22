import type { TimeIntentMissing, TimeSpec } from '../../../../packages/shared/src/types.js';

type ParseArgs = { originalText: string; timezone: string; now?: Date; evidenceSnippets?: string[] };

type LegacyInput = {
  date?: string;
  startTime?: string;
  durationMins?: number;
  timezone?: string;
  start?: string;
  end?: string;
  isAllDay?: boolean;
  originalText?: string;
  evidenceSnippets?: string[];
};

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_DAY = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:,?\s*(\d{4}))?$/i;
const RANGE = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[–—-]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;


const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const NEXT_WEEKDAY = /\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i;
const SINGLE_TIME = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;

const capEvidence = (snippets?: string[]): string[] | undefined => {
  if (!snippets?.length) return undefined;
  const bounded: string[] = [];
  let total = 0;
  for (const item of snippets) {
    const clean = item.trim();
    if (!clean) continue;
    const next = clean.slice(0, 220);
    if (total + next.length > 800) break;
    bounded.push(next);
    total += next.length;
    if (bounded.length >= 5) break;
  }
  return bounded.length ? bounded : undefined;
};

const toIso = (y: number, m: number, d: number, hh: number, mm: number): string => new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();

const parseHour = (h: string, m: string | undefined, meridiem?: string): { hour: number; minute: number } => {
  let hour = Number(h);
  const minute = Number(m ?? '0');
  if (meridiem) {
    const low = meridiem.toLowerCase();
    if (low === 'pm' && hour < 12) hour += 12;
    if (low === 'am' && hour === 12) hour = 0;
  }
  return { hour: Math.max(0, Math.min(23, hour)), minute: Math.max(0, Math.min(59, minute)) };
};

const fuzzyWindow = (text: string): { start: [number, number]; end: [number, number]; label: string } | null => {
  const lowered = text.toLowerCase();
  if (lowered.includes('early morning')) return { start: [5, 0], end: [8, 0], label: 'Mapped early morning to 05:00–08:00.' };
  if (lowered.includes('morning')) return { start: [8, 0], end: [12, 0], label: 'Mapped morning to 08:00–12:00.' };
  if (lowered.includes('afternoon')) return { start: [12, 0], end: [17, 0], label: 'Mapped afternoon to 12:00–17:00.' };
  if (lowered.includes('evening')) return { start: [17, 0], end: [21, 0], label: 'Mapped evening to 17:00–21:00.' };
  if (lowered.includes('night')) return { start: [21, 0], end: [24, 0], label: 'Mapped night to 21:00–24:00.' };
  return null;
};

const mondayStart = (date: Date): Date => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
};

export const parseTimeSpec = ({ originalText, timezone, now = new Date(), evidenceSnippets }: ParseArgs): TimeSpec => {
  const text = originalText.trim();
  const assumptions: string[] = [];
  const missing: TimeIntentMissing[] = [];
  const boundedEvidence = capEvidence(evidenceSnippets);
  const intentBase = { originalText: text, assumptions: assumptions.length ? assumptions : undefined, evidenceSnippets: boundedEvidence };
  if (!text) return { intent: { ...intentBase, status: 'unresolved', missing: ['date'] } };

  const lower = text.toLowerCase();
  let base = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (lower.includes('this weekend')) {
    const monday = mondayStart(now);
    const saturday = new Date(monday); saturday.setDate(monday.getDate() + 5);
    const mondayAfter = new Date(saturday); mondayAfter.setDate(saturday.getDate() + 2);
    return { intent: { ...intentBase, status: 'resolved' }, resolved: { timezone, startUtc: saturday.toISOString(), endUtc: mondayAfter.toISOString() } };
  }
  if (lower.includes('next week') || lower.includes('this week')) {
    const monday = mondayStart(now);
    if (lower.includes('next week')) monday.setDate(monday.getDate() + 7);
    const end = new Date(monday); end.setDate(monday.getDate() + 7);
    return { intent: { ...intentBase, status: 'resolved' }, resolved: { timezone, startUtc: monday.toISOString(), endUtc: end.toISOString() } };
  }
  if (lower.includes('next month')) {
    const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 2, 1);
    return { intent: { ...intentBase, status: 'resolved' }, resolved: { timezone, startUtc: start.toISOString(), endUtc: end.toISOString() } };
  }


  const nextWeekday = text.match(NEXT_WEEKDAY);
  if (nextWeekday) {
    const targetName = nextWeekday[1].toLowerCase() as (typeof WEEKDAYS)[number];
    const targetDay = WEEKDAYS.indexOf(targetName);
    const start = new Date(base);
    const dayDiff = (targetDay - start.getDay() + 7) % 7;
    const offsetDays = dayDiff === 0 ? 7 : dayDiff;
    start.setDate(start.getDate() + offsetDays);

    const rangeOnDay = text.match(RANGE);
    if (rangeOnDay) {
      const [_, sh, sm, sa, eh, em, ea] = rangeOnDay;
      const startParsed = parseHour(sh, sm, sa || ea);
      const endParsed = parseHour(eh, em, ea || sa);
      start.setHours(startParsed.hour, startParsed.minute, 0, 0);
      const end = new Date(start);
      end.setHours(endParsed.hour, endParsed.minute, 0, 0);
      if (end <= start) end.setDate(end.getDate() + 1);
      assumptions.push(`Mapped next ${targetName} to ${start.toDateString()}.`);
      return { intent: { ...intentBase, assumptions, status: 'resolved', evidenceSnippets: boundedEvidence }, resolved: { timezone, startUtc: start.toISOString(), endUtc: end.toISOString() } };
    }

    const singleTime = text.match(SINGLE_TIME);
    if (singleTime) {
      const [_, h, m, meridiem] = singleTime;
      const parsed = parseHour(h, m, meridiem);
      start.setHours(parsed.hour, parsed.minute, 0, 0);
      assumptions.push(`Mapped next ${targetName} to ${start.toDateString()}.`);
      assumptions.push('Interpreted single-point time as a 1-minute interval.');
      const end = new Date(start.getTime() + 60_000);
      return { intent: { ...intentBase, assumptions, status: 'resolved', evidenceSnippets: boundedEvidence }, resolved: { timezone, startUtc: start.toISOString(), endUtc: end.toISOString() } };
    }

    missing.push('startTime');
    assumptions.push(`Mapped next ${targetName} to ${start.toDateString()}.`);
    return { intent: { ...intentBase, status: 'partial', missing, assumptions, evidenceSnippets: boundedEvidence } };
  }

  const exactDate = text.match(DATE_ONLY);
  if (exactDate) {
    const [, y, m, d] = exactDate;
    const start = new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0);
    const end = new Date(start); end.setDate(start.getDate() + 1);
    return { intent: { ...intentBase, status: 'resolved' }, resolved: { timezone, startUtc: start.toISOString(), endUtc: end.toISOString() } };
  }

  const md = text.match(MONTH_DAY);
  if (md) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const month = months.indexOf(md[1].slice(0, 3).toLowerCase()) + 1;
    const day = Number(md[2]);
    const year = md[3] ? Number(md[3]) : now.getFullYear();
    base = new Date(year, month - 1, day, 0, 0, 0, 0);
    const window = fuzzyWindow(text);
    if (window) {
      assumptions.push(window.label);
      const endDate = new Date(base);
      const [eh, em] = window.end;
      if (eh === 24) { endDate.setDate(endDate.getDate() + 1); endDate.setHours(0, 0, 0, 0); }
      else endDate.setHours(eh, em, 0, 0);
      const startDate = new Date(base); startDate.setHours(window.start[0], window.start[1], 0, 0);
      return { intent: { ...intentBase, assumptions, status: 'resolved', evidenceSnippets: boundedEvidence }, resolved: { timezone, startUtc: startDate.toISOString(), endUtc: endDate.toISOString() } };
    }
    const wholeDayEnd = new Date(base); wholeDayEnd.setDate(base.getDate() + 1);
    return { intent: { ...intentBase, status: 'resolved' }, resolved: { timezone, startUtc: base.toISOString(), endUtc: wholeDayEnd.toISOString() } };
  }

  const range = text.match(RANGE);
  if (range) {
    const [_, sh, sm, sa, eh, em, ea] = range;
    const startParsed = parseHour(sh, sm, sa || ea);
    const endParsed = parseHour(eh, em, ea || sa);
    let start = new Date(base); start.setHours(startParsed.hour, startParsed.minute, 0, 0);
    let end = new Date(base); end.setHours(endParsed.hour, endParsed.minute, 0, 0);
    if (end <= start) {
      if (text.includes('–') || text.includes('-') || text.includes('—')) {
        end.setDate(end.getDate() + 1);
      } else {
        [start, end] = [end, start];
        assumptions.push('Swapped start/end because end was before start.');
      }
    }
    return { intent: { ...intentBase, status: 'resolved', assumptions: assumptions.length ? assumptions : undefined, evidenceSnippets: boundedEvidence }, resolved: { timezone, startUtc: start.toISOString(), endUtc: end.toISOString() } };
  }

  if (fuzzyWindow(text)) {
    missing.push('date');
    return { intent: { ...intentBase, status: 'partial', missing, assumptions: assumptions.length ? assumptions : undefined } };
  }

  missing.push('date');
  return { intent: { ...intentBase, status: 'unresolved', missing, assumptions: assumptions.length ? assumptions : undefined } };
};

export const deriveTimeSpecFromLegacy = (legacy: LegacyInput, timezoneFallback: string): TimeSpec => {
  const timezone = legacy.timezone || timezoneFallback;
  if (legacy.start && legacy.end) {
    return { intent: { status: 'resolved', originalText: legacy.originalText ?? `${legacy.start} to ${legacy.end}`, evidenceSnippets: capEvidence(legacy.evidenceSnippets) }, resolved: { startUtc: legacy.start, endUtc: legacy.end, timezone } };
  }
  if (legacy.date && !legacy.startTime) {
    return parseTimeSpec({ originalText: legacy.originalText ?? legacy.date, timezone, evidenceSnippets: legacy.evidenceSnippets });
  }
  if (legacy.date && legacy.startTime && legacy.durationMins) {
    const [y, m, d] = legacy.date.split('-').map(Number);
    const [hh, mm] = legacy.startTime.split(':').map(Number);
    const start = toIso(y, m, d, hh, mm);
    const end = new Date(Date.parse(start) + legacy.durationMins * 60_000).toISOString();
    return { intent: { status: 'resolved', originalText: legacy.originalText ?? `${legacy.date} ${legacy.startTime} ${legacy.durationMins}m`, evidenceSnippets: capEvidence(legacy.evidenceSnippets) }, resolved: { startUtc: start, endUtc: end, timezone } };
  }
  return { intent: { status: 'unresolved', originalText: legacy.originalText ?? '', missing: ['date'], evidenceSnippets: capEvidence(legacy.evidenceSnippets) } };
};

export const getTimeSpec = (entry: { schemaVersion?: number; time?: TimeSpec } & LegacyInput, timezoneFallback: string): TimeSpec => {
  if (entry.schemaVersion === 2 && entry.time) return entry.time;
  return deriveTimeSpecFromLegacy(entry, timezoneFallback);
};
