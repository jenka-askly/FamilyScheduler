const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

const apiBaseUrl = configuredApiBaseUrl ? trimTrailingSlash(configuredApiBaseUrl) : '';
const SESSION_ID_KEY = 'fs.sessionId';
const PROVISIONAL_EXPIRED_NOTICE = 'Please verify your email to continue';
const warnedUnauthorizedTraceIds = new Set<string>();
const debugAuthLogsEnabled = import.meta.env.VITE_DEBUG_AUTH_LOGS === 'true';
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


const shouldClearSessionId = (code?: string): boolean => code === 'AUTH_PROVISIONAL_EXPIRED';

const handleProvisionalExpiry = (path: string, payload: { error?: string; code?: string; traceId?: string }): void => {
  if (typeof window === 'undefined') return;
  const code = payload.code ?? payload.error;
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

export const apiFetch = async (path: string, init: RequestInit = {}): Promise<Response> => {
  const headers = new Headers(init.headers);
  if (init.body != null && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const sessionId = getSessionId();
  if (sessionId && !headers.has('x-session-id')) headers.set('x-session-id', sessionId);
  const requestSummary = summarizeRequestBody(init.body);
  const response = await fetch(apiUrl(path), { ...init, headers });
  const contentType = response.headers.get('content-type') ?? '';
  if (response.status === 400) {
    console.warn('[apiFetch] bad_request', { path, method: init.method ?? 'GET', request: requestSummary });
  }
  if (contentType.includes('application/json')) {
    try {
      const payload = await response.clone().json() as { ok?: boolean; error?: string; code?: string; message?: string; traceId?: string };
      if (payload.ok === false && payload.error === 'unauthorized' && payload.message === 'Missing session') {
        warnMissingSession(path, payload.traceId);
      }
      handleProvisionalExpiry(path, payload);
    } catch {
      // Ignore parse errors.
    }
  }
  return response;
};
