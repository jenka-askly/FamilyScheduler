import type { StorageAdapter } from '../storage/storage.js';
import { userKeyFromEmail } from '../identity/userKey.js';

const DEFAULT_USER_PREFS_BLOB_PREFIX = 'familyscheduler/users';

export type UserPrefs = {
  emailUpdatesEnabled: boolean;
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
  updatedAt: new Date(0).toISOString()
});

const coerceUserPrefs = (value: unknown): UserPrefs | null => {
  if (!value || typeof value !== 'object') return null;
  const rec = value as Record<string, unknown>;
  if (typeof rec.emailUpdatesEnabled !== 'boolean') return null;
  return {
    emailUpdatesEnabled: rec.emailUpdatesEnabled,
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
  if (!storage.putBinary) throw new Error('storage_put_binary_not_supported');

  const next: UserPrefs = {
    emailUpdatesEnabled: enabled,
    updatedAt: new Date().toISOString()
  };
  await storage.putBinary(getBlobNameForUserPrefs(email), Buffer.from(JSON.stringify(next), 'utf8'), 'application/json; charset=utf-8', {
    kind: 'user-prefs',
    updatedAt: next.updatedAt
  });
  return next;
};
