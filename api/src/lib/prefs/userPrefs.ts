import type { StorageAdapter } from '../storage/storage.js';
import { userKey } from '../identity/userKey.js';

export type UserPrefs = {
  emailUpdatesEnabled: boolean;
  updatedAt: string;
};

const DEFAULT_USER_PREFS_BLOB_PREFIX = 'familyscheduler/users';

const normalizePrefix = (value: string | undefined): string => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/+$/g, '') : DEFAULT_USER_PREFS_BLOB_PREFIX;
};

const prefix = (): string => normalizePrefix(process.env.USER_PREFS_BLOB_PREFIX);

const blobNameForEmail = (email: string): string => `${prefix()}/${userKey(email)}/prefs.json`;

const streamToText = async (readable: NodeJS.ReadableStream): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of readable) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf-8');
};

const defaultPrefs = (): UserPrefs => ({ emailUpdatesEnabled: true, updatedAt: new Date().toISOString() });

const parsePrefs = (raw: unknown): UserPrefs | null => {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as { emailUpdatesEnabled?: unknown; updatedAt?: unknown };
  if (typeof candidate.emailUpdatesEnabled !== 'boolean') return null;
  return {
    emailUpdatesEnabled: candidate.emailUpdatesEnabled,
    updatedAt: typeof candidate.updatedAt === 'string' && candidate.updatedAt.trim() ? candidate.updatedAt : new Date().toISOString()
  };
};

export async function getUserPrefs(storage: StorageAdapter, email: string, traceId?: string): Promise<UserPrefs> {
  if (!storage.getBinary) return defaultPrefs();
  const blobName = blobNameForEmail(email);
  try {
    const blob = await storage.getBinary(blobName);
    const raw = await streamToText(blob.stream);
    const parsed = parsePrefs(JSON.parse(raw) as unknown);
    if (parsed) return parsed;
    console.warn(JSON.stringify({ component: 'userPrefs', stage: 'invalid_shape', traceId: traceId ?? null, blobName }));
    return defaultPrefs();
  } catch (error) {
    const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
      ? Number((error as { statusCode?: unknown }).statusCode)
      : NaN;
    if (Number.isFinite(statusCode) && statusCode === 404) return defaultPrefs();
    if (error instanceof SyntaxError) {
      console.warn(JSON.stringify({ component: 'userPrefs', stage: 'parse_error', traceId: traceId ?? null, blobName }));
      return defaultPrefs();
    }
    throw error;
  }
}

export async function setEmailUpdatesEnabled(storage: StorageAdapter, email: string, enabled: boolean): Promise<UserPrefs> {
  if (!storage.putBinary) throw new Error('Storage adapter missing putBinary');
  const next: UserPrefs = { emailUpdatesEnabled: enabled, updatedAt: new Date().toISOString() };
  const body = `${JSON.stringify(next, null, 2)}\n`;
  await storage.putBinary(blobNameForEmail(email), Buffer.from(body, 'utf-8'), 'application/json; charset=utf-8');
  return next;
}
