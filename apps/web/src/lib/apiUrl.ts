import { sessionLog } from './sessionLog';
import { computeIsIgniteGraceActiveForGroup } from './graceAccess';
const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const configuredApiBaseUrl = import.meta.env?.VITE_API_BASE_URL?.trim();

const apiBaseUrl = configuredApiBaseUrl ? trimTrailingSlash(configuredApiBaseUrl) : '';
const SESSION_ID_KEY = 'fs.sessionId';
const IGNITE_GRACE_SESSION_ID_KEY = 'fs.igniteGraceSessionId';
const IGNITE_GRACE_GROUP_ID_KEY = 'fs.igniteGraceGroupId';
const IGNITE_GRACE_EXPIRES_AT_KEY = 'fs.igniteGraceExpiresAtUtc';
const PROVISIONAL_EXPIRED_NOTICE = 'Please verify your email to continue';
const warnedUnauthorizedTraceIds = new Set<string>();
const debugAuthLogsEnabled = import.meta.env?.VITE_DEBUG_AUTH_LOGS === 'true';
const SAFE_RESPONSE_HEADER_KEYS = ['content-type', 'date', 'server', 'x-ms-request-id', 'request-context', 'x-azure-ref'] as const;
const authLog = (payload: Record<string, unknown>): void => {
  if (!debugAuthLogsEnabled) return;
  console.log(payload);
};

export const apiUrl = (path: string): string => {
  if (!path.startsWith('/')) throw new Error(`apiUrl path must start with '/'. Received: ${path}`);
  return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
};

export const getSessionId = (): string | null => {
  if (typeof window === 'undefined') return null;
  const sessionId = window.localStorage.getItem(SESSION_ID_KEY);
  return sessionId && sessionId.trim() ? sessionId : null;
};

export const getIgniteGraceGroupId = (): string | null => {
  if (typeof window === 'undefined') return null;
  const groupId = window.localStorage.getItem(IGNITE_GRACE_GROUP_ID_KEY);
  return groupId && groupId.trim() ? groupId : null;
};

const isIgniteGraceExpired = (): boolean => {
  if (typeof window === 'undefined') return true;
  const expiresAt = window.localStorage.getItem(IGNITE_GRACE_EXPIRES_AT_KEY);
  if (!expiresAt || !expiresAt.trim()) return false;
  const parsedExpiresAt = Date.parse(expiresAt);
  if (!Number.isFinite(parsedExpiresAt)) return false;
  return Date.now() >= parsedExpiresAt;
};

export const getIgniteGraceSessionId = (groupId?: string): string | null => {
  if (typeof window === 'undefined') return null;
  const sessionId = window.localStorage.getItem(IGNITE_GRACE_SESSION_ID_KEY);
  if (!sessionId || !sessionId.trim()) return null;
  if (isIgniteGraceExpired()) return null;
  if (!groupId) return sessionId.trim();
  return getIgniteGraceGroupId() === groupId ? sessionId.trim() : null;
};

export const isIgniteGraceActiveForGroup = (groupId?: string): boolean => computeIsIgniteGraceActiveForGroup({
  groupId,
  durableSessionId: getSessionId(),
  igniteGraceSessionId: getIgniteGraceSessionId(groupId),
  igniteGraceGroupId: getIgniteGraceGroupId()
});

export const isIgniteGraceGuestForGroup = (groupId: string): boolean => Boolean(
  getIgniteGraceSessionId(groupId)
  && !getSessionId()
);

export const getAuthSessionId = (groupId?: string): string | null => getSessionId() || getIgniteGraceSessionId(groupId);

export type SafeResponseRead = {
  status: number;
  statusText: string;
  contentType: string;
  headers: Record<string, string>;
  bodyText: string;
  bodyLen: number;
  json: unknown | null;
  jsonParseError?: string;
};

export class ApiError extends Error {
  status: number;
  statusText: string;
  url: string;
  method: string;
  contentType: string;
  bodyText: string;
  bodyLen: number;
  headers: Record<string, string>;
  traceId?: string;
  clientRequestId?: string;

  constructor(args: {
    message: string;
    status: number;
    statusText: string;
    url: string;
    method: string;
    contentType: string;
    bodyText: string;
    bodyLen: number;
    headers: Record<string, string>;
    traceId?: string;
    clientRequestId?: string;
  }) {
    super(args.message);
    this.name = 'ApiError';
    this.status = args.status;
    this.statusText = args.statusText;
    this.url = args.url;
    this.method = args.method;
    this.contentType = args.contentType;
    this.bodyText = args.bodyText;
    this.bodyLen = args.bodyLen;
    this.headers = args.headers;
    this.traceId = args.traceId;
    this.clientRequestId = args.clientRequestId;
  }
}

export const readResponseSafe = async (res: Response): Promise<SafeResponseRead> => {
  const contentType = res.headers.get('content-type') ?? '';
  const headersSubset: Record<string, string> = {};
  for (const key of SAFE_RESPONSE_HEADER_KEYS) {
    const value = res.headers.get(key);
    if (value) headersSubset[key] = value;
  }
  const bodyText = await res.text();
  const bodyLen = bodyText.length;
  let json: unknown | null = null;
  let jsonParseError: string | undefined;
  const trimmedBody = bodyText.trim();
  const shouldAttemptJson = bodyLen > 0 && (
    contentType.toLowerCase().includes('application/json')
    || trimmedBody.startsWith('{')
    || trimmedBody.startsWith('[')
  );
  if (shouldAttemptJson) {
    try {
      json = JSON.parse(bodyText) as unknown;
    } catch (error) {
      jsonParseError = String(error);
    }
  }
  return {
    status: res.status,
    statusText: res.statusText,
    contentType,
    headers: headersSubset,
    bodyText,
    bodyLen,
    json,
    jsonParseError
  };
};


const shouldClearSessionId = (code?: string): boolean => code === 'AUTH_PROVISIONAL_EXPIRED';

const handleProvisionalExpiry = (path: string, payload: { error?: string; code?: string; traceId?: string }): void => {
  if (typeof window === 'undefined') return;
  const code = payload.code ?? payload.error;
  if (code === 'AUTH_IGNITE_GRACE_EXPIRED') {
    const clearPayload = { code, path, traceId: payload.traceId, currentHash: window.location.hash || '' };
    window.localStorage.removeItem(IGNITE_GRACE_SESSION_ID_KEY);
    window.localStorage.removeItem(IGNITE_GRACE_GROUP_ID_KEY);
    window.localStorage.removeItem(IGNITE_GRACE_EXPIRES_AT_KEY);
    sessionLog('GRACE_END_EXPIRED', clearPayload);
    authLog({ event: 'grace_session_cleared', component: 'apiFetch', stage: 'clear_grace_session_id', ...clearPayload });
    return;
  }
  if (!shouldClearSessionId(code)) return;
  const currentHash = window.location.hash || '';
  const clearPayload = { code, path, traceId: payload.traceId, currentHash };
  console.warn('[apiFetch] api_session_cleared', clearPayload);
  console.debug('[AUTH_DEBUG]', {
    event: 'apiFetch_clear_session',
    code,
    path,
    currentHash: window.location.hash,
    sessionIdBefore: window.localStorage.getItem(SESSION_ID_KEY)?.slice(0, 8)
  });
  window.localStorage.removeItem(SESSION_ID_KEY);
  console.warn('[apiFetch] session_id_removed', clearPayload);
  authLog({ event: 'api_session_cleared', component: 'apiFetch', stage: 'clear_session_id', ...clearPayload });
  if (currentHash.startsWith('#/login')) return;
  if (code !== 'AUTH_PROVISIONAL_EXPIRED') return;
  console.warn(`[apiFetch] provisional_session_expired path=${path}`);
  window.location.replace(`${window.location.pathname}${window.location.search}#/login?m=${encodeURIComponent(PROVISIONAL_EXPIRED_NOTICE)}`);
};

const summarizeRequestBody = (body: RequestInit['body']): Record<string, unknown> | undefined => {
  if (body == null) return undefined;
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      return {
        type: 'json_string',
        keys: Object.keys(parsed),
        groupId: typeof parsed.groupId === 'string' ? parsed.groupId : undefined,
        sessionId: typeof parsed.sessionId === 'string' ? parsed.sessionId : undefined,
        traceId: typeof parsed.traceId === 'string' ? parsed.traceId : undefined
      };
    } catch {
      return { type: 'string', length: body.length };
    }
  }
  if (body instanceof URLSearchParams) return { type: 'urlsearchparams', keys: Array.from(body.keys()) };
  if (body instanceof FormData) return { type: 'formdata', keys: Array.from(body.keys()) };
  if (body instanceof Blob) return { type: 'blob', size: body.size, contentType: body.type };
  if (body instanceof ArrayBuffer) return { type: 'arraybuffer', byteLength: body.byteLength };
  return { type: typeof body };
};

const warnMissingSession = (path: string, traceId?: string): void => {
  if (!traceId || warnedUnauthorizedTraceIds.has(traceId)) return;
  warnedUnauthorizedTraceIds.add(traceId);
  console.warn(`[apiFetch] unauthorized_missing_session path=${path} traceId=${traceId} hasSession=${Boolean(getSessionId())}`);
};

type ApiFetchInit = RequestInit & {
  throwOnHttpError?: boolean;
  clientRequestId?: string;
};

export const apiFetch = async (path: string, init: ApiFetchInit = {}): Promise<Response> => {
  const headers = new Headers(init.headers);
  if (init.body != null && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const requestMethod = (init.method ?? 'GET').toUpperCase();
  const isGroupJoinCall = path === '/api/group/join' && requestMethod === 'POST';
  const requestSummary = summarizeRequestBody(init.body);
  const requestGroupId = typeof requestSummary?.groupId === 'string' ? requestSummary.groupId : undefined;
  const durableSessionId = getSessionId();
  const igniteGraceSessionId = getIgniteGraceSessionId(requestGroupId);
  const sessionIdToUse = isGroupJoinCall && igniteGraceSessionId ? igniteGraceSessionId : durableSessionId || igniteGraceSessionId;
  if (sessionIdToUse && !headers.has('x-session-id')) headers.set('x-session-id', sessionIdToUse);
  const url = apiUrl(path);
  if (init.clientRequestId && !headers.has('x-client-request-id')) headers.set('x-client-request-id', init.clientRequestId);
  const response = await fetch(url, { ...init, headers });
  const safeResponse = await readResponseSafe(response.clone());
  if (safeResponse.status === 400) {
    console.warn('[apiFetch] bad_request', { path, method: requestMethod, request: requestSummary });
  }
  const payload = (safeResponse.json && typeof safeResponse.json === 'object') ? safeResponse.json as { ok?: boolean; error?: string; code?: string; message?: string; traceId?: string } : undefined;
  if (payload) {
    if (safeResponse.status < 200 || safeResponse.status >= 300 || payload.ok === false) {
      console.warn('[apiFetch] request_failed', { path, status: safeResponse.status, error: payload.error ?? payload.code, traceId: payload.traceId });
    }
    if (payload.ok === false && payload.error === 'unauthorized' && payload.message === 'Missing session') {
      warnMissingSession(path, payload.traceId);
    }
    handleProvisionalExpiry(path, payload);
  }
  if (!response.ok && init.throwOnHttpError) {
    throw new ApiError({
      message: `API request failed: ${requestMethod} ${path} (${safeResponse.status} ${safeResponse.statusText})`,
      status: safeResponse.status,
      statusText: safeResponse.statusText,
      url,
      method: requestMethod,
      contentType: safeResponse.contentType,
      bodyText: safeResponse.bodyText,
      bodyLen: safeResponse.bodyLen,
      headers: safeResponse.headers,
      traceId: payload?.traceId,
      clientRequestId: headers.get('x-client-request-id') ?? undefined
    });
  }
  return response;
};
