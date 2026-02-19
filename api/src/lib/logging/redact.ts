const API_KEY_PATTERN = /api[_-]?key/i;
const SAS_PATTERN = /sas/i;
const PASSKEY_PATTERN = /passkey/i;
const SIG_QUERY_PATTERN = /([?&])sig=[^&]*/ig;

const redactString = (value: string): string => value.replace(SIG_QUERY_PATTERN, '$1sig=[REDACTED]');

const shouldRedactKey = (key: string): boolean => API_KEY_PATTERN.test(key) || SAS_PATTERN.test(key) || PASSKEY_PATTERN.test(key);

const cloneAndRedact = (value: unknown, parentKey?: string): unknown => {
  if (typeof value === 'string') {
    return shouldRedactKey(parentKey ?? '') ? '[REDACTED]' : redactString(value);
  }
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => cloneAndRedact(item, parentKey));

  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (shouldRedactKey(key)) {
      result[key] = '[REDACTED]';
      continue;
    }
    result[key] = cloneAndRedact(child, key);
  }
  return result;
};

export const redactSecrets = <T>(obj: T): T => cloneAndRedact(obj) as T;
