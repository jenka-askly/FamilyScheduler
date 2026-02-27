export const isValidReturnTo = (value?: string): value is string => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200) return false;
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('://')) return false;
  return true;
};

export const sanitizeReturnTo = (value?: string): string => {
  if (!isValidReturnTo(value)) return '/';
  return value.trim();
};

export const getSafeNextPathFromHash = (hash: string): string => {
  const cleaned = (hash || '#/').replace(/^#/, '');
  const [rawPath, queryString = ''] = cleaned.split('?');
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  const candidate = queryString ? `${path}?${queryString}` : path;
  return sanitizeReturnTo(candidate);
};

export const buildLoginPathWithNextFromHash = (hash: string): string => {
  const next = getSafeNextPathFromHash(hash);
  return `/login?next=${encodeURIComponent(next)}`;
};
