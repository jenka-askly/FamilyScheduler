import { getAuthSessionId, getIgniteGraceSessionId, getSessionId, isIgniteGraceGuestForGroup } from './apiUrl';
import { buildLoginPathWithNextFromHash } from './returnTo';

const IGNITE_GRACE_SESSION_ID_KEY = 'fs.igniteGraceSessionId';
const IGNITE_GRACE_GROUP_ID_KEY = 'fs.igniteGraceGroupId';
const IGNITE_GRACE_EXPIRES_AT_KEY = 'fs.igniteGraceExpiresAtUtc';

const maskSessionId = (value: string | null): string => {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 10) return `${trimmed.slice(0, 2)}…${trimmed.slice(-2)}`;
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
};

const readStorageValue = (key: string): string => {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(key) ?? '';
};

const parseGraceExpired = (expiresAtUtcRaw: string, nowMs: number): string => {
  if (!expiresAtUtcRaw.trim()) return 'false';
  const parsed = Date.parse(expiresAtUtcRaw);
  if (!Number.isFinite(parsed)) return 'unknown';
  return String(nowMs >= parsed);
};

export type GraceDebugSnapshot = {
  timestampUtc: string;
  hash: string;
  routeGroupId: string;
  durableSessionPresent: boolean;
  durableSessionIdMasked: string;
  graceSessionIdPresent: boolean;
  graceSessionIdMasked: string;
  graceGroupId: string;
  graceExpiresAtUtcRaw: string;
  nowUtc: string;
  graceExpired: string;
  getIgniteGraceSessionIdForGroup: string;
  getAuthSessionIdForGroup: string;
  isIgniteGraceGuestForGroup: boolean;
  loginPathWithNextFromHash: string;
};

export function getGraceDebugText(opts: { groupId: string; hash: string }): string {
  const durableSessionId = getSessionId();
  const graceSessionIdRaw = readStorageValue(IGNITE_GRACE_SESSION_ID_KEY);
  const graceExpiresAtUtcRaw = readStorageValue(IGNITE_GRACE_EXPIRES_AT_KEY);
  const now = new Date();
  const nowMs = now.getTime();

  const snapshot: GraceDebugSnapshot = {
    timestampUtc: new Date().toISOString(),
    hash: opts.hash,
    routeGroupId: opts.groupId,
    durableSessionPresent: Boolean(durableSessionId),
    durableSessionIdMasked: maskSessionId(durableSessionId),
    graceSessionIdPresent: Boolean(graceSessionIdRaw.trim()),
    graceSessionIdMasked: maskSessionId(graceSessionIdRaw),
    graceGroupId: readStorageValue(IGNITE_GRACE_GROUP_ID_KEY),
    graceExpiresAtUtcRaw,
    nowUtc: now.toISOString(),
    graceExpired: parseGraceExpired(graceExpiresAtUtcRaw, nowMs),
    getIgniteGraceSessionIdForGroup: maskSessionId(getIgniteGraceSessionId(opts.groupId)),
    getAuthSessionIdForGroup: maskSessionId(getAuthSessionId(opts.groupId)),
    isIgniteGraceGuestForGroup: isIgniteGraceGuestForGroup(opts.groupId),
    loginPathWithNextFromHash: buildLoginPathWithNextFromHash(opts.hash || '')
  };

  return Object.entries(snapshot)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join('\n');
}
