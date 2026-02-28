import { getAuthSessionId, getIgniteGraceSessionId, getSessionId, isIgniteGraceGuestForGroup } from './apiUrl';
import { buildLoginPathWithNextFromHash } from './returnTo';

const maskSessionId = (value: string | null | undefined): string => {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 12) return '***';
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
};

const readLocalStorage = (key: string): string => {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
};

const safeCall = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

export function buildSessionDebugText(args: { hash: string; groupId?: string }): string {
  const hash = args.hash || '';
  const groupId = args.groupId;

  const snapshot: Record<string, string> = {
    timestampUtc: new Date().toISOString(),
    hash,
    groupId: groupId ?? '',
    'localStorage.fs.sessionId': maskSessionId(readLocalStorage('fs.sessionId')),
    'localStorage.fs.sessionEmail': readLocalStorage('fs.sessionEmail'),
    'localStorage.fs.sessionName': readLocalStorage('fs.sessionName'),
    'localStorage.fs.igniteGraceSessionId': maskSessionId(readLocalStorage('fs.igniteGraceSessionId')),
    'localStorage.fs.igniteGraceGroupId': readLocalStorage('fs.igniteGraceGroupId'),
    'localStorage.fs.igniteGraceExpiresAtUtc': readLocalStorage('fs.igniteGraceExpiresAtUtc'),
    'computed.getSessionId()': maskSessionId(safeCall(() => getSessionId(), null)),
    'computed.getIgniteGraceSessionId(groupId)': maskSessionId(safeCall(() => getIgniteGraceSessionId(groupId), null)),
    'computed.getAuthSessionId(groupId)': maskSessionId(safeCall(() => getAuthSessionId(groupId), null)),
    'computed.isIgniteGraceGuestForGroup(groupId)': String(groupId ? safeCall(() => isIgniteGraceGuestForGroup(groupId), false) : false),
    'computed.buildLoginPathWithNextFromHash(hash)': safeCall(() => buildLoginPathWithNextFromHash(hash), '/login?next=%2F')
  };

  return Object.entries(snapshot)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
}
