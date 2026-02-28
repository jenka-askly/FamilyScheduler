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

const removeLocalStorageKey = (key: string): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // no-op: storage may be unavailable in some environments
  }
};

export function clearDurableSessionKeys(): void {
  removeLocalStorageKey('fs.sessionId');
  removeLocalStorageKey('fs.sessionEmail');
  removeLocalStorageKey('fs.sessionName');
}

export function clearGraceSessionKeys(): void {
  removeLocalStorageKey('fs.igniteGraceSessionId');
  removeLocalStorageKey('fs.igniteGraceGroupId');
  removeLocalStorageKey('fs.igniteGraceExpiresAtUtc');
}

export function clearAllSessionKeys(): void {
  clearDurableSessionKeys();
  clearGraceSessionKeys();
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem('fs.pendingAuth');
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith('fs.authComplete.'))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // no-op
  }
}

export function buildSessionDebugText(args: { hash: string; groupId?: string }): string {
  const hash = args.hash || '';
  const groupId = args.groupId;

  const durableSessionId = safeCall(() => getSessionId(), null);
  const scopedGraceSessionId = safeCall(() => getIgniteGraceSessionId(groupId), null);
  const graceGroupId = readLocalStorage('fs.igniteGraceGroupId');
  const isGuestForGroup = Boolean(groupId ? safeCall(() => isIgniteGraceGuestForGroup(groupId), false) : false);
  const isMismatch = Boolean(groupId && durableSessionId && scopedGraceSessionId && graceGroupId === groupId && !isGuestForGroup);

  const snapshot: Record<string, string> = {
    timestampUtc: new Date().toISOString(),
    hash,
    groupId: groupId ?? '',
    'localStorage.fs.sessionId': maskSessionId(readLocalStorage('fs.sessionId')),
    'localStorage.fs.sessionEmail': readLocalStorage('fs.sessionEmail'),
    'localStorage.fs.sessionName': readLocalStorage('fs.sessionName'),
    'localStorage.fs.igniteGraceSessionId': maskSessionId(readLocalStorage('fs.igniteGraceSessionId')),
    'localStorage.fs.igniteGraceGroupId': graceGroupId,
    'localStorage.fs.igniteGraceExpiresAtUtc': readLocalStorage('fs.igniteGraceExpiresAtUtc'),
    'computed.getSessionId()': maskSessionId(durableSessionId),
    'computed.getIgniteGraceSessionId(groupId)': maskSessionId(scopedGraceSessionId),
    'computed.getAuthSessionId(groupId)': maskSessionId(safeCall(() => getAuthSessionId(groupId), null)),
    'derived.dsidPresent': String(Boolean(durableSessionId)),
    'derived.gsidPresentForGroup': String(Boolean(scopedGraceSessionId)),
    'computed.isIgniteGraceGuestForGroup(groupId)': String(isGuestForGroup),
    'derived.isMismatch': String(isMismatch),
    'computed.buildLoginPathWithNextFromHash(hash)': safeCall(() => buildLoginPathWithNextFromHash(hash), '/login?next=%2F')
  };

  return Object.entries(snapshot)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
}
