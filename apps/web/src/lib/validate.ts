export const isValidEmail = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes(' ')) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
};

export const sanitizeSessionEmail = (value: unknown): string | null => {
  if (!isValidEmail(value) || typeof value !== 'string') return null;
  return value.trim();
};
