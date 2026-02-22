export type OpenAiTimeResolveResolved = {
  status: 'resolved';
  startUtc: string;
  endUtc?: string | null;
  missing: string[];
  assumptions: string[];
};

export type OpenAiTimeResolveUnresolved = {
  status: 'unresolved';
  missing: string[];
  assumptions: string[];
};

export type OpenAiTimeResolve = OpenAiTimeResolveResolved | OpenAiTimeResolveUnresolved;

const isIsoUtc = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value)) && value.endsWith('Z');
const asStringArray = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export const parseOpenAiTimeResolve = (value: unknown): OpenAiTimeResolve | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const assumptions = asStringArray(record.assumptions);
  const missing = asStringArray(record.missing);

  if (record.status === 'resolved') {
    if (!isIsoUtc(record.startUtc)) return null;
    if (record.endUtc !== undefined && record.endUtc !== null && !isIsoUtc(record.endUtc)) return null;
    return { status: 'resolved', startUtc: record.startUtc, endUtc: (record.endUtc as string | null | undefined), missing, assumptions };
  }

  if (record.status === 'unresolved') {
    if (!missing.length) return null;
    return { status: 'unresolved', missing, assumptions };
  }

  return null;
};
