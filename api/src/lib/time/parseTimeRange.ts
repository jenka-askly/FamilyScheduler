const parse12HourTime = (value: string): string | null => {
  const match = value.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? '0');
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;

  let hours24 = hours % 12;
  if (match[3] === 'pm') hours24 += 12;
  return `${hours24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const parse24HourTime = (value: string): string | null => {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const parseTimeToken = (token: string): string | null => parse24HourTime(token) ?? parse12HourTime(token);

export const parseTimeRange = (input: string): { startHHMM: string; endHHMM: string } | null => {
  const trimmed = input.trim().replace(/\s+/g, ' ');
  const match = trimmed.match(/^(.+?)\s*(?:to|-)\s*(.+)$/i);
  if (!match) return null;

  const startHHMM = parseTimeToken(match[1]);
  const endHHMM = parseTimeToken(match[2]);
  if (!startHHMM || !endHHMM) return null;
  if (startHHMM >= endHHMM) return null;

  return { startHHMM, endHHMM };
};
