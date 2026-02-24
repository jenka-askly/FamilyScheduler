import type { HttpResponseInit } from '@azure/functions';
import { errorResponse } from '../http/errorResponse.js';
import type { AppState, Member } from '../state.js';

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

export const findActiveMemberByEmail = (state: AppState, email: string): Member | null => (
  state.members.find((member) => member.status === 'active' && member.email === normalizeEmail(email)) ?? null
);

export type MemberResult =
  | { ok: true; member: Member }
  | { ok: false; response: HttpResponseInit };

export const requireActiveMember = (state: AppState, email: string, traceId: string): MemberResult => {
  const member = findActiveMemberByEmail(state, email);
  if (!member) {
    console.info(JSON.stringify({ event: 'membership_denied', traceId, emailDomain: getEmailDomain(email) }));
    return { ok: false, response: errorResponse(403, 'not_allowed', 'Not allowed', traceId) };
  }
  return { ok: true, member };
};
