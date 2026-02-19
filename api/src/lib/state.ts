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
