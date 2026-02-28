import type { StorageAdapter } from '../storage/storage.js';
import { userKeyFromEmail } from '../identity/userKey.js';

const DEFAULT_USER_PREFS_BLOB_PREFIX = 'familyscheduler/users';

export type UserPrefs = {
  emailUpdatesEnabled: boolean;
  mutedGroupIds: string[];
  updatedAt: string;
};

const getUserPrefsPrefix = (): string => process.env.USER_PREFS_BLOB_PREFIX?.trim() || DEFAULT_USER_PREFS_BLOB_PREFIX;

const getBlobNameForUserPrefs = (email: string): string => `${getUserPrefsPrefix()}/${userKeyFromEmail(email)}/prefs.json`;

const streamToString = async (stream: NodeJS.ReadableStream): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
};

const defaultPrefs = (): UserPrefs => ({
  emailUpdatesEnabled: true,
  mutedGroupIds: [],
  updatedAt: new Date(0).toISOString()
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const normalizeMutedGroupIds = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  const dedupe = new Set<string>();
  const ids: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') return null;
    const normalized = entry.trim().toLowerCase();
    if (!UUID_PATTERN.test(normalized)) return null;
    if (dedupe.has(normalized)) continue;
    dedupe.add(normalized);
    ids.push(normalized);
  }
  return ids;
};

const coerceUserPrefs = (value: unknown): UserPrefs | null => {
  if (!value || typeof value !== 'object') return null;
  const rec = value as Record<string, unknown>;
  if (typeof rec.emailUpdatesEnabled !== 'boolean') return null;
  const mutedGroupIds = rec.mutedGroupIds === undefined ? [] : normalizeMutedGroupIds(rec.mutedGroupIds);
  if (!mutedGroupIds) return null;
  return {
    emailUpdatesEnabled: rec.emailUpdatesEnabled,
    mutedGroupIds,
    updatedAt: typeof rec.updatedAt === 'string' && rec.updatedAt ? rec.updatedAt : new Date(0).toISOString()
  };
};

const isBlobNotFound = (error: unknown): boolean => {
  const details = error as { statusCode?: number; code?: string };
  return details?.statusCode === 404 || details?.code === 'BlobNotFound';
};

export const getUserPrefs = async (storage: StorageAdapter, email: string, traceId?: string): Promise<UserPrefs> => {
  if (!storage.getBinary) throw new Error('storage_get_binary_not_supported');

  try {
    const blob = await storage.getBinary(getBlobNameForUserPrefs(email));
    const raw = await streamToString(blob.stream);
    const parsed = JSON.parse(raw) as unknown;
    const prefs = coerceUserPrefs(parsed);
    if (prefs) return prefs;
    console.warn(JSON.stringify({ event: 'user_prefs_invalid_shape', traceId, emailHash: userKeyFromEmail(email).slice(0, 12) }));
    return defaultPrefs();
  } catch (error) {
    if (isBlobNotFound(error)) return defaultPrefs();
    if (error instanceof SyntaxError) {
      console.warn(JSON.stringify({ event: 'user_prefs_parse_failed', traceId, emailHash: userKeyFromEmail(email).slice(0, 12) }));
      return defaultPrefs();
    }
    throw error;
  }
};

export const setEmailUpdatesEnabled = async (storage: StorageAdapter, email: string, enabled: boolean): Promise<UserPrefs> => {
  const previous = await getUserPrefs(storage, email);
  return setUserPrefs(storage, email, { emailUpdatesEnabled: enabled, mutedGroupIds: previous.mutedGroupIds });
};

export const setUserPrefs = async (storage: StorageAdapter, email: string, nextPrefs: { emailUpdatesEnabled: boolean; mutedGroupIds: string[] }): Promise<UserPrefs> => {
  if (!storage.putBinary) throw new Error('storage_put_binary_not_supported');

  const next: UserPrefs = {
    emailUpdatesEnabled: nextPrefs.emailUpdatesEnabled,
    mutedGroupIds: nextPrefs.mutedGroupIds,
    updatedAt: new Date().toISOString()
  };
  await storage.putBinary(getBlobNameForUserPrefs(email), Buffer.from(JSON.stringify(next), 'utf8'), 'application/json; charset=utf-8', {
    kind: 'user-prefs',
    updatedAt: next.updatedAt
  });
  return next;
};

export const setUserPrefsPartial = async (
  storage: StorageAdapter,
  email: string,
  patch: { emailUpdatesEnabled?: boolean; mutedGroupIds?: string[] }
): Promise<UserPrefs> => {
  const previous = await getUserPrefs(storage, email);
  return setUserPrefs(storage, email, {
    emailUpdatesEnabled: typeof patch.emailUpdatesEnabled === 'boolean' ? patch.emailUpdatesEnabled : previous.emailUpdatesEnabled,
    mutedGroupIds: patch.mutedGroupIds ?? previous.mutedGroupIds
  });
};
