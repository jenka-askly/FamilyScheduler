import type { AppState } from './state.js';

export const IGNITE_DEFAULT_GRACE_SECONDS = 60;

export const igniteIsJoinable = (ignite: NonNullable<AppState['ignite']>, nowMs = Date.now()): boolean => {
  if (ignite.status === 'OPEN') return true;
  if (ignite.status !== 'CLOSING') return false;
  if (!ignite.closeRequestedAt) return false;
  const closeRequestedMs = Date.parse(ignite.closeRequestedAt);
  if (Number.isNaN(closeRequestedMs)) return false;
  const graceSeconds = ignite.graceSeconds ?? IGNITE_DEFAULT_GRACE_SECONDS;
  return nowMs < closeRequestedMs + (graceSeconds * 1000);
};

export const igniteEffectiveStatus = (ignite: NonNullable<AppState['ignite']>, nowMs = Date.now()): 'OPEN' | 'CLOSING' | 'CLOSED' => {
  if (ignite.status !== 'CLOSING') return ignite.status;
  return igniteIsJoinable(ignite, nowMs) ? 'CLOSING' : 'CLOSED';
};

export const ignitePhotoBlobKey = (groupId: string, sessionId: string, personId: string): string => `familyscheduler/groups/${groupId}/ignite/${sessionId}/photos/${personId}.jpg`;
