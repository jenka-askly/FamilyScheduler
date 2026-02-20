const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

const apiBaseUrl = configuredApiBaseUrl ? trimTrailingSlash(configuredApiBaseUrl) : '';

export const apiUrl = (path: string): string => {
  if (!path.startsWith('/')) throw new Error(`apiUrl path must start with '/'. Received: ${path}`);
  return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
};
