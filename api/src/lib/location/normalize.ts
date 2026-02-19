export type NormalizedLocation = {
  display: string;
  mapQuery: string;
};

export const normalizeLocation = (raw: string): NormalizedLocation => {
  const trimmed = raw.trim();
  if (!trimmed) return { display: '', mapQuery: '' };

  const normalized = trimmed
    .replace(/[\t\n\r]+/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/,{2,}/g, ',')
    .replace(/\s*,\s*/g, ', ')
    .replace(/^,+|,+$/g, '')
    .trim();

  if (!normalized) return { display: '', mapQuery: '' };
  return { display: normalized, mapQuery: normalized };
};
