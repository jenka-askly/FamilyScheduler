const normalize = (email: string): string => email.trim().toLowerCase();

export const userKey = (email: string): string => {
  const normalized = normalize(email);
  if (!normalized) throw new Error('email is required');
  return encodeURIComponent(normalized);
};

