import type { HttpResponseInit } from '@azure/functions';
import { errorResponse } from '../http/errorResponse.js';
import type { AppState } from '../state.js';

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const isPlausibleEmail = (email: string): boolean => {
  const trimmed = normalizeEmail(email);
  const atIdx = trimmed.indexOf('@');
  if (atIdx <= 0) return false;
  const domain = trimmed.slice(atIdx + 1);
  return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.');
};

export const getEmailDomain = (email: string): string => {
  const [, domain = 'unknown'] = normalizeEmail(email).split('@');
  return domain;
};

export const findActivePersonByEmail = (state: AppState, email: string): AppState['people'][number] | null => {
  const normalizedEmail = normalizeEmail(email);
  return state.people.find((person) => person.status === 'active' && normalizeEmail(person.email ?? '') === normalizedEmail) ?? null;
};

export const resolveActivePersonIdForEmail = (state: AppState, email: string): string | null => {
  const activePerson = findActivePersonByEmail(state, email);
  return activePerson?.personId ?? null;
};

export type MemberResult =
  | { ok: true; personId: string }
  | { ok: false; response: HttpResponseInit };

export const requireActiveMember = (state: AppState, email: string, traceId: string): MemberResult => {
  const personId = resolveActivePersonIdForEmail(state, email);
  if (!personId) {
    console.info(JSON.stringify({ event: 'membership_denied', traceId, emailDomain: getEmailDomain(email) }));
    return { ok: false, response: errorResponse(403, 'not_allowed', 'Not allowed', traceId) };
  }
  return { ok: true, personId };
};
