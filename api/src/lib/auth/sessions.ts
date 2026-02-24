import { randomUUID } from 'node:crypto';
import type { HttpRequest } from '@azure/functions';
import { errorResponse } from '../http/errorResponse.js';
import { createStorageAdapter } from '../storage/storageFactory.js';

const DEFAULT_PREFIX = 'familyscheduler/sessions';
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

type SessionBlob = {
  v: 1;
  email: string;
  createdAt: string;
  expiresAt: string;
};

export class HttpError extends Error {
  readonly response;

  constructor(status: number, error: string, message: string, traceId: string) {
    super(message);
    this.name = 'HttpError';
    this.response = errorResponse(status, error, message, traceId);
  }
}

const getEmailDomain = (email: string): string => {
  const [, domain = 'unknown'] = email.split('@');
  return domain.toLowerCase();
};

const isPlausibleEmail = (email: string): boolean => {
  const trimmed = email.trim();
  const atIdx = trimmed.indexOf('@');
  if (atIdx <= 0) return false;
  const domain = trimmed.slice(atIdx + 1);
  return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.');
};

const getPrefix = (): string => process.env.SESSION_BLOB_PREFIX?.trim() || DEFAULT_PREFIX;

const getTtlSeconds = (): number => {
  const raw = process.env.SESSION_TTL_SECONDS?.trim();
  if (!raw) return DEFAULT_TTL_SECONDS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TTL_SECONDS;
  return Math.floor(parsed);
};

const blobNameForSession = (sessionId: string): string => `${getPrefix()}/${sessionId}.json`;

const streamToString = async (stream: NodeJS.ReadableStream): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
};

export const createSession = async (email: string, ttlSeconds = getTtlSeconds()): Promise<{ sessionId: string; expiresAtISO: string }> => {
  const adapter = createStorageAdapter();
  if (!adapter.putBinary) throw new Error('storage_put_binary_not_supported');

  const now = new Date();
  const expiresAt = new Date(now.getTime() + (ttlSeconds * 1000));
  const sessionId = randomUUID();
  const body: SessionBlob = {
    v: 1,
    email,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  };

  await adapter.putBinary(blobNameForSession(sessionId), Buffer.from(JSON.stringify(body), 'utf8'), 'application/json');
  return { sessionId, expiresAtISO: body.expiresAt };
};

export const getSession = async (sessionId: string): Promise<{ email: string; expiresAtISO: string } | null> => {
  const adapter = createStorageAdapter();
  if (!adapter.getBinary) throw new Error('storage_get_binary_not_supported');

  try {
    const blob = await adapter.getBinary(blobNameForSession(sessionId));
    const raw = await streamToString(blob.stream);
    const parsed = JSON.parse(raw) as Partial<SessionBlob>;

    if (parsed?.v !== 1 || typeof parsed.email !== 'string' || typeof parsed.expiresAt !== 'string') return null;
    if (!isPlausibleEmail(parsed.email)) return null;

    const expiresAt = new Date(parsed.expiresAt);
    if (Number.isNaN(expiresAt.valueOf()) || expiresAt.valueOf() <= Date.now()) return null;

    return { email: parsed.email, expiresAtISO: expiresAt.toISOString() };
  } catch (error) {
    const details = error as { statusCode?: number; code?: string };
    if (details?.statusCode === 404 || details?.code === 'BlobNotFound') return null;
    throw error;
  }
};

export const requireSessionFromRequest = async (request: HttpRequest, traceId: string): Promise<{ email: string; sessionId: string }> => {
  const sessionId = request.headers.get('x-session-id')?.trim() || '';
  if (!sessionId) throw new HttpError(401, 'unauthorized', 'Missing session', traceId);

  const session = await getSession(sessionId);
  if (!session) throw new HttpError(401, 'unauthorized', 'Invalid session', traceId);

  console.log(JSON.stringify({ event: 'session_resolved', traceId, emailDomain: getEmailDomain(session.email), sessionIdPrefix: sessionId.slice(0, 8) }));
  return { email: session.email, sessionId };
};
