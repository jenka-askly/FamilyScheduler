import type { TimeSpec } from '../../../../packages/shared/src/types.js';

export type SuggestionDirectAction =
  | { type: 'set_appointment_desc'; code: string; desc: string }
  | { type: 'set_appointment_start_time'; code: string; startTime: string }
  | { type: 'set_appointment_date'; code: string; date: string }
  | { type: 'set_appointment_location'; code: string; locationRaw: string }
  | { type: 'add_constraint'; appointmentId: string; memberEmail: string; field: 'general'; operator: 'not_contains'; value: string; clientRequestId: string };

export type SuggestionCandidate = {
  id: string;
  kind: 'direct_action';
  label: string;
  action: SuggestionDirectAction;
};

export type AppointmentSuggestionContext = {
  appointmentId: string;
  appointmentCode: string;
};

type ResolvedWhen = {
  date?: string;
  startTime?: string;
  displayTime?: string;
};

export type SuggestionParsingHelpers = {
  resolveWhen: (messageText: string) => Promise<ResolvedWhen | null>;
  createClientRequestId: () => string;
};

const TITLE_PATTERNS = [
  /^\s*(?:change|update)\s+title\s+to\s+(.+)/i,
  /^\s*rename\s+to\s+(.+)/i,
  /^\s*call\s+it\s+(.+)/i
];

const LOCATION_PATTERN = /\b(?:at|in|location is|let'?s do)\s+(.+)/i;
const CONSTRAINT_CUE_PATTERN = /\b(?:can'?t|cannot|not available|must|required|need(?:s)? to)\b/i;
const CANT_DO_PATTERN = /\b(?:i\s+can'?t|i\s+cannot)\s+do\s+(.+)/i;

const trimOuterQuotes = (value: string): string => value.trim().replace(/^['"`]+|['"`]+$/g, '').trim();

const formatDisplayTime = (startTime: string): string => {
  const [hourText, minuteText] = startTime.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return startTime;
  const normalized = new Date(Date.UTC(2001, 0, 1, hour, minute));
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' }).format(normalized);
};

const createCandidate = (label: string, action: SuggestionDirectAction): SuggestionCandidate => ({
  id: `suggestion-${action.type}-${label}`,
  kind: 'direct_action',
  label,
  action
});

export async function generateSuggestionCandidates({
  messageText,
  appointmentDetailContext,
  sessionUserEmail,
  parsingHelpers
}: {
  messageText: string;
  appointmentDetailContext: AppointmentSuggestionContext;
  sessionUserEmail: string;
  parsingHelpers: SuggestionParsingHelpers;
}): Promise<SuggestionCandidate[]> {
  const trimmedMessage = messageText.trim();
  if (!trimmedMessage) return [];

  const ranked: SuggestionCandidate[] = [];

  for (const pattern of TITLE_PATTERNS) {
    const match = trimmedMessage.match(pattern);
    if (!match?.[1]) continue;
    const title = trimOuterQuotes(match[1]);
    if (!title) continue;
    ranked.push(createCandidate(`Set title to “${title}”`, { type: 'set_appointment_desc', code: appointmentDetailContext.appointmentCode, desc: title }));
    break;
  }

  const resolvedWhen = await parsingHelpers.resolveWhen(trimmedMessage);
  if (resolvedWhen?.startTime) {
    const display = resolvedWhen.displayTime ?? formatDisplayTime(resolvedWhen.startTime);
    ranked.push(createCandidate(`Set start time to ${display}`, { type: 'set_appointment_start_time', code: appointmentDetailContext.appointmentCode, startTime: resolvedWhen.startTime }));
  }
  if (resolvedWhen?.date) {
    ranked.push(createCandidate(`Set date to ${resolvedWhen.date}`, { type: 'set_appointment_date', code: appointmentDetailContext.appointmentCode, date: resolvedWhen.date }));
  }

  const locationMatch = trimmedMessage.match(LOCATION_PATTERN);
  if (locationMatch?.[1]) {
    const location = trimOuterQuotes(locationMatch[1].replace(/[.!?,;:]+$/, '').trim());
    if (location && location.length <= 60) {
      ranked.push(createCandidate(`Set location to “${location}”`, { type: 'set_appointment_location', code: appointmentDetailContext.appointmentCode, locationRaw: location }));
    }
  }

  if (CONSTRAINT_CUE_PATTERN.test(trimmedMessage)) {
    const cantDoMatch = trimmedMessage.match(CANT_DO_PATTERN);
    const extracted = trimOuterQuotes((cantDoMatch?.[1] ?? '').replace(/[.!?,;:]+$/, '').trim());
    const fallback = trimOuterQuotes(trimmedMessage.replace(/[.!?,;:]+$/, '').trim());
    const value = extracted || (fallback.length < 60 ? fallback : '');
    if (value) {
      ranked.push(createCandidate(`Add constraint: general not_contains “${value}”`, {
        type: 'add_constraint',
        appointmentId: appointmentDetailContext.appointmentId,
        memberEmail: sessionUserEmail,
        field: 'general',
        operator: 'not_contains',
        value,
        clientRequestId: parsingHelpers.createClientRequestId()
      }));
    }
  }

  return ranked.slice(0, 3);
}

export const parseResolvedWhenFromTimeSpec = (time?: TimeSpec): ResolvedWhen | null => {
  if (!time || time.intent.status !== 'resolved' || !time.resolved?.startUtc) return null;
  return {
    date: time.resolved.startUtc.slice(0, 10),
    startTime: time.resolved.startUtc.slice(11, 16),
    displayTime: new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: time.resolved.timezone || 'UTC' }).format(new Date(time.resolved.startUtc))
  };
};
