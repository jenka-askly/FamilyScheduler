export type Person = {
  id: string;
  name: string;
};

export type Appointment = {
  id: string;
  code: string;
  title: string;
  start?: string;
  end?: string;
  date?: string;
  startTime?: string;
  durationMins?: number;
  timezone?: string;
  isAllDay?: boolean;
  assigned: string[];
  people: string[];
  location: string;
  notes: string;
};

export type AvailabilityBlock = {
  id: string;
  code: string;
  personId: string;
  start?: string;
  end?: string;
  date?: string;
  startTime?: string;
  durationMins?: number;
  timezone?: string;
  isAllDay?: boolean;
  reason?: string;
};

export type AppState = {
  version: number;
  people: Person[];
  appointments: Appointment[];
  availability: AvailabilityBlock[];
  history: string[];
};

export const createEmptyAppState = (): AppState => ({
  version: 1,
  people: [
    { id: 'person-joe', name: 'Joe' },
    { id: 'person-sam', name: 'Sam' }
  ],
  appointments: [],
  availability: [],
  history: []
});

const normalizeText = (value: string): string => value.trim().replace(/\s+/g, ' ');

const normalizePeople = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const person = normalizeText(item);
    if (!person) continue;
    const key = person.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(person);
  }
  return normalized;
};

export const normalizeAppState = (state: AppState): AppState => {
  const normalized = structuredClone(state);
  normalized.appointments = normalized.appointments.map((appointment) => {
    const assigned = Array.isArray(appointment.assigned) ? appointment.assigned : [];
    const peopleSource = Array.isArray(appointment.people)
      ? appointment.people
      : assigned.map((personId) => normalized.people.find((person) => person.id === personId)?.name ?? personId);

    return {
      ...appointment,
      assigned,
      people: normalizePeople(peopleSource),
      location: typeof appointment.location === 'string' ? normalizeText(appointment.location) : '',
      notes: typeof appointment.notes === 'string' ? appointment.notes.trim().slice(0, 500) : ''
    };
  });
  return normalized;
};
