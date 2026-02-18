export type Person = {
  id: string;
  name: string;
};

export type Appointment = {
  id: string;
  code: string;
  title: string;
  start: string;
  end: string;
  assigned: string[];
};

export type AvailabilityBlock = {
  id: string;
  code: string;
  personId: string;
  start: string;
  end: string;
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
