export type Person = {
  id: string;
  name: string;
};

export type AppointmentLocation = {
  locationRaw: string;
  locationDisplay: string;
  locationMapQuery: string;
  locationName: string;
  locationAddress: string;
  locationDirections: string;
};

export type TimeSpecStatus = 'resolved' | 'partial' | 'unresolved';

export type TimeIntentMissing = 'date' | 'startTime' | 'endTime' | 'duration' | 'timezone';

export type TimeIntent = {
  status: TimeSpecStatus;
  originalText: string;
  missing?: TimeIntentMissing[];
  assumptions?: string[];
  evidenceSnippets?: string[];
};

export type ResolvedInterval = {
  startUtc: string;
  endUtc: string;
  timezone: string;
  durationSource: 'explicit' | 'suggested';
  durationConfidence?: number;
  durationReason?: string;
  durationAcceptance?: 'auto' | 'user_confirmed' | 'user_edited';
  inferenceVersion?: string;
};

export type TimeSpec = {
  intent: TimeIntent;
  resolved?: ResolvedInterval;
};
