export type Interval = { date: string; startTime?: string; durationMins?: number };

export const toMinutes = (time?: string): number => {
  if (!time) return 0;
  const [hh, mm] = time.split(':').map(Number);
  return (hh * 60) + mm;
};

export const intervalBounds = (input: Interval): { start: number; end: number } => {
  if (!input.startTime) return { start: 0, end: 24 * 60 };
  const start = toMinutes(input.startTime);
  return { start, end: Math.min(24 * 60, start + (input.durationMins ?? 60)) };
};

export const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }): boolean => a.start < b.end && a.end > b.start;
