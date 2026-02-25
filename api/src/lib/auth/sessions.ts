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
  kind?: 'full' | 'provisional' | 'igniteGrace';
  scopeGroupId?: string;
  scopeIgniteSessionId?: string;
};

type SessionKind = 'full' | 'provisional' | 'igniteGrace';

export class HttpError extends Error {
  readonly response;

  constructor(status: number, error: string, message: string, traceId: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.name = 'HttpError';
    this.response = errorResponse(status, error, message, traceId, extra);
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

const getProvisionalTtlSeconds = (): number => {
  const raw = process.env.PROVISIONAL_SESSION_TTL_SECONDS?.trim();
  if (!raw) return 1800;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1800;
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

const createSessionInternal = async (
  email: string,
  kind: SessionKind,
  ttlSeconds: number,
  options: { scopeGroupId?: string; scopeIgniteSessionId?: string } = {}
): Promise<{ sessionId: string; expiresAtISO: string }> => {
  const adapter = createStorageAdapter();
  if (!adapter.putBinary) throw new Error('storage_put_binary_not_supported');

  const now = new Date();
  const expiresAt = new Date(now.getTime() + (ttlSeconds * 1000));
  const sessionId = randomUUID();
  const body: SessionBlob = {
    v: 1,
    email,
    kind,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    scopeGroupId: options.scopeGroupId,
    scopeIgniteSessionId: options.scopeIgniteSessionId
  };

  await adapter.putBinary(blobNameForSession(sessionId), Buffer.from(JSON.stringify(body), 'utf8'), 'application/json');
  return { sessionId, expiresAtISO: body.expiresAt };
};

export const createSession = async (email: string, ttlSeconds = getTtlSeconds()): Promise<{ sessionId: string; expiresAtISO: string }> => createSessionInternal(email, 'full', ttlSeconds);

export const createProvisionalSession = async (email: string, ttlSeconds = getProvisionalTtlSeconds()): Promise<{ sessionId: string; expiresAtISO: string }> => createSessionInternal(email, 'provisional', ttlSeconds);

export const createIgniteGraceSession = async (
  email: string,
  scopeGroupId: string,
  ttlSeconds: number,
  options: { scopeIgniteSessionId?: string } = {}
): Promise<{ sessionId: string; expiresAtISO: string }> => createSessionInternal(email, 'igniteGrace', ttlSeconds, { scopeGroupId, scopeIgniteSessionId: options.scopeIgniteSessionId });

export const getSession = async (sessionId: string): Promise<{ email: string; expiresAtISO: string } | null> => {
  const resolved = await getSessionWithStatus(sessionId);
  if (!resolved.ok) return null;
  return { email: resolved.email, expiresAtISO: resolved.expiresAtISO };
};

export const getSessionWithStatus = async (sessionId: string): Promise<
  | { ok: true; email: string; expiresAtISO: string; kind: SessionKind; scopeGroupId?: string; scopeIgniteSessionId?: string }
  | { ok: false; code: 'missing' | 'invalid' | 'expired' | 'provisional_expired' | 'ignite_grace_expired' }
> => {
  const adapter = createStorageAdapter();
  if (!adapter.getBinary) throw new Error('storage_get_binary_not_supported');

  try {
    const blob = await adapter.getBinary(blobNameForSession(sessionId));
    const raw = await streamToString(blob.stream);
    const parsed = JSON.parse(raw) as Partial<SessionBlob>;

    if (parsed?.v !== 1 || typeof parsed.email !== 'string' || typeof parsed.expiresAt !== 'string') return { ok: false, code: 'invalid' };
    if (!isPlausibleEmail(parsed.email)) return { ok: false, code: 'invalid' };
    const kind: SessionKind = parsed.kind === 'provisional'
      ? 'provisional'
      : parsed.kind === 'igniteGrace'
        ? 'igniteGrace'
        : 'full';

    const expiresAt = new Date(parsed.expiresAt);
    if (Number.isNaN(expiresAt.valueOf())) return { ok: false, code: 'invalid' };
    if (expiresAt.valueOf() <= Date.now()) {
      if (kind === 'provisional') return { ok: false, code: 'provisional_expired' };
      if (kind === 'igniteGrace') return { ok: false, code: 'ignite_grace_expired' };
      return { ok: false, code: 'expired' };
    }

    const scopeGroupId = typeof parsed.scopeGroupId === 'string' && parsed.scopeGroupId.trim() ? parsed.scopeGroupId.trim() : undefined;
    const scopeIgniteSessionId = typeof parsed.scopeIgniteSessionId === 'string' && parsed.scopeIgniteSessionId.trim() ? parsed.scopeIgniteSessionId.trim() : undefined;

    return { ok: true, email: parsed.email, expiresAtISO: expiresAt.toISOString(), kind, scopeGroupId, scopeIgniteSessionId };
  } catch (error) {
    const details = error as { statusCode?: number; code?: string };
    if (details?.statusCode === 404 || details?.code === 'BlobNotFound') return { ok: false, code: 'missing' };
    throw error;
  }
};

export const requireSessionFromRequest = async (
  request: HttpRequest,
  traceId: string,
  options: { groupId?: string } = {}
): Promise<{ email: string; sessionId: string; kind: SessionKind; scopeGroupId?: string }> => {
  const sessionId = request.headers.get('x-session-id')?.trim() || '';
  if (!sessionId) throw new HttpError(401, 'unauthorized', 'Missing session', traceId);

  const session = await getSessionWithStatus(sessionId);
  if (!session.ok) {
    if (session.code === 'provisional_expired') throw new HttpError(401, 'unauthorized', 'Provisional session expired', traceId, { code: 'AUTH_PROVISIONAL_EXPIRED' });
    if (session.code === 'ignite_grace_expired') {
      console.log(JSON.stringify({ event: 'ignite_grace_expired_rejected', traceId, sessionIdPrefix: sessionId.slice(0, 8) }));
      throw new HttpError(401, 'unauthorized', 'Ignite grace session expired', traceId, { code: 'AUTH_IGNITE_GRACE_EXPIRED' });
    }
    throw new HttpError(401, 'unauthorized', 'Invalid session', traceId);
  }

  if (session.kind === 'igniteGrace' && options.groupId && session.scopeGroupId && session.scopeGroupId !== options.groupId) {
    console.log(JSON.stringify({
      event: 'ignite_grace_scope_violation',
      traceId,
      sessionIdPrefix: sessionId.slice(0, 8),
      expectedGroupId: session.scopeGroupId,
      requestGroupId: options.groupId
    }));
    throw new HttpError(403, 'forbidden', 'Session is not allowed for this group', traceId, { code: 'AUTH_SESSION_SCOPE_VIOLATION' });
  }

  console.log(JSON.stringify({ event: 'session_resolved', traceId, emailDomain: getEmailDomain(session.email), sessionIdPrefix: sessionId.slice(0, 8), kind: session.kind }));
  return { email: session.email, sessionId, kind: session.kind, scopeGroupId: session.scopeGroupId };
};
