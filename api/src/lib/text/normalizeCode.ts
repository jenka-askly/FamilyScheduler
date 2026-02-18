const APPOINTMENT_CODE_PATTERN = /^APPT[\s-]?(\d+)$/i;
const AVAILABILITY_CODE_PATTERN = /^AVL-([A-Z0-9_-]+)-(\d+)$/i;
const AVAILABILITY_RELAXED_PATTERN = /^AVL-([A-Z0-9_-]*?)(\d+)$/i;

export const normalizeAppointmentCode = (input: string): string | null => {
  const trimmed = input.trim();
  const match = trimmed.match(APPOINTMENT_CODE_PATTERN);
  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isInteger(value) || value <= 0) return null;
  return `APPT-${value}`;
};

export const normalizeAvailabilityCode = (input: string): string | null => {
  const trimmed = input.trim().toUpperCase();
  const strictMatch = trimmed.match(AVAILABILITY_CODE_PATTERN);
  if (strictMatch) {
    const suffixValue = Number(strictMatch[2]);
    if (!Number.isInteger(suffixValue) || suffixValue <= 0) return null;
    return `AVL-${strictMatch[1]}-${suffixValue}`;
  }

  const relaxedMatch = trimmed.match(AVAILABILITY_RELAXED_PATTERN);
  if (!relaxedMatch) return null;

  const prefix = relaxedMatch[1].replace(/-+$/g, '');
  const suffixValue = Number(relaxedMatch[2]);
  if (!prefix || !Number.isInteger(suffixValue) || suffixValue <= 0) return null;
  return `AVL-${prefix}-${suffixValue}`;
};

export const looksLikeSingleCodeToken = (input: string): boolean => {
  const trimmed = input.trim();
  if (trimmed.length === 0 || /\s/.test(trimmed)) return false;
  return /^appt[-_\s]?\d+$/i.test(trimmed)
    || /^avl-[a-z0-9_-]+-?\d+$/i.test(trimmed)
    || /^avl[a-z0-9_-]*\d+$/i.test(trimmed);
};
