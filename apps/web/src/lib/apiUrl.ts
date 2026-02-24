const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

const apiBaseUrl = configuredApiBaseUrl ? trimTrailingSlash(configuredApiBaseUrl) : '';
const SESSION_ID_KEY = 'fs.sessionId';

export const apiUrl = (path: string): string => {
  if (!path.startsWith('/')) throw new Error(`apiUrl path must start with '/'. Received: ${path}`);
  return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
};

export const getSessionId = (): string | null => {
  if (typeof window === 'undefined') return null;
  const sessionId = window.localStorage.getItem(SESSION_ID_KEY);
  return sessionId && sessionId.trim() ? sessionId : null;
};

export const apiFetch = (path: string, init: RequestInit = {}): Promise<Response> => {
  const headers = new Headers(init.headers);
  if (init.body != null && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const sessionId = getSessionId();
  if (sessionId && !headers.has('x-session-id')) headers.set('x-session-id', sessionId);
  return fetch(apiUrl(path), { ...init, headers });
};
