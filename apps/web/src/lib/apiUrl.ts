const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

const apiBaseUrl = (() => {
  if (configuredApiBaseUrl) return trimTrailingSlash(configuredApiBaseUrl);
  if (import.meta.env.DEV) return '';
  throw new Error('Missing VITE_API_BASE_URL. Set it to your Function App host (e.g. https://familyscheduler-api-prod.azurewebsites.net).');
})();

export const apiUrl = (path: string): string => {
  if (!path.startsWith('/')) throw new Error(`apiUrl path must start with '/'. Received: ${path}`);
  return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
};
