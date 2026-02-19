const MONTH_MAP: Record<string, string> = {
  january: '01', jan: '01',
  february: '02', feb: '02',
  march: '03', mar: '03',
  april: '04', apr: '04',
  may: '05',
  june: '06', jun: '06',
  july: '07', jul: '07',
  august: '08', aug: '08',
  september: '09', sep: '09', sept: '09',
  october: '10', oct: '10',
  november: '11', nov: '11',
  december: '12', dec: '12'
};

const pad2 = (value: number): string => String(value).padStart(2, '0');

const toIsoDate = (year: number, month: number, day: number): string | null => {
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
};

export const parseFlexibleDate = (input: string): string | null => {
  const trimmed = input.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return toIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));

  const dmyMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmyMatch) return toIsoDate(Number(dmyMatch[3]), Number(dmyMatch[2]), Number(dmyMatch[1]));

  const monthDayYearMatch = trimmed.match(/^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (monthDayYearMatch) {
    const month = MONTH_MAP[monthDayYearMatch[1].toLowerCase()];
    if (!month) return null;
    return toIsoDate(Number(monthDayYearMatch[3]), Number(month), Number(monthDayYearMatch[2]));
  }

  return null;
};
