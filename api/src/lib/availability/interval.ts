export type Interval = { date: string; startTime?: string; durationMins?: number };

export type AvailabilityRuleV2Like = {
  personId: string;
  status: 'available' | 'unavailable';
  startUtc: string;
  endUtc: string;
  promptId?: string;
  timezone?: string;
  assumptions?: string[];
};

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

export const normalizeRulesV2 = <T extends AvailabilityRuleV2Like>(rules: T[]): T[] => {
  const groups = new Map<string, T[]>();
  for (const rule of rules) {
    const key = `${rule.personId}::${rule.status}::${rule.promptId ?? ''}`;
    const list = groups.get(key) ?? [];
    list.push(rule);
    groups.set(key, list);
  }

  const normalized: T[] = [];
  for (const groupRules of groups.values()) {
    const sorted = [...groupRules].sort((a, b) => {
      const startDiff = new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime();
      if (startDiff !== 0) return startDiff;
      return new Date(a.endUtc).getTime() - new Date(b.endUtc).getTime();
    });
    if (sorted.length === 0) continue;

    let current = { ...sorted[0], assumptions: [...new Set(sorted[0].assumptions ?? [])] } as T;
    for (let index = 1; index < sorted.length; index += 1) {
      const next = sorted[index];
      const currentEnd = new Date(current.endUtc).getTime();
      const nextStart = new Date(next.startUtc).getTime();
      if (nextStart <= currentEnd) {
        current.endUtc = new Date(Math.max(currentEnd, new Date(next.endUtc).getTime())).toISOString();
        const mergedAssumptions = new Set([...(current.assumptions ?? []), ...(next.assumptions ?? [])]);
        if (next.timezone && current.timezone && next.timezone !== current.timezone) {
          mergedAssumptions.add(`Timezone conflict encountered (${current.timezone} vs ${next.timezone}); used ${current.timezone}.`);
        }
        current.assumptions = [...mergedAssumptions];
      } else {
        normalized.push(current);
        current = { ...next, assumptions: [...new Set(next.assumptions ?? [])] } as T;
      }
    }
    normalized.push(current);
  }

  return normalized;
};
