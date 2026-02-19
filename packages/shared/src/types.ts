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
