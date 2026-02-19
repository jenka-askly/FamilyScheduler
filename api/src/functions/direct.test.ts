import test from 'node:test';
import assert from 'node:assert/strict';

const loadDirect = async (tag: string) => {
  process.env.STORAGE_MODE = 'local';
  process.env.LOCAL_STATE_PATH = `./.local/state-direct-${tag}.json`;
  const mod = await import(`./direct.js?${tag}`);
  return mod.direct as (request: any, context: any) => Promise<any>;
};

test('direct endpoint creates/edits/deletes appointment deterministically', async () => {
  const direct = await loadDirect('flow');
  const sendDirect = async (action: unknown) => direct({ json: async () => ({ action }) } as any, {} as any);

  let response = await sendDirect({ type: 'create_blank_appointment' });
  assert.equal((response.jsonBody as any).ok, true);
  const appointments = (response.jsonBody as any).snapshot.appointments as Array<{ code: string }>;
  const code = appointments[appointments.length - 1].code;

  response = await sendDirect({ type: 'set_appointment_date', code, date: '2026-06-01' });
  assert.equal((response.jsonBody as any).snapshot.appointments.some((item: any) => item.code === code && item.date === '2026-06-01'), true);

  response = await sendDirect({ type: 'set_appointment_start_time', code, startTime: '13:00' });
  assert.equal((response.jsonBody as any).snapshot.appointments.some((item: any) => item.code === code && item.startTime === '13:00'), true);

  response = await sendDirect({ type: 'set_appointment_location', code, locationRaw: 'Kaiser	Redwood City' });
  assert.equal((response.jsonBody as any).snapshot.appointments.some((item: any) => item.code === code && item.location === 'Kaiser, Redwood City' && item.locationRaw === 'Kaiser\tRedwood City' && item.locationMapQuery === 'Kaiser, Redwood City'), true);

  response = await sendDirect({ type: 'set_appointment_location', code, location: 'Kaiser SF' });
  assert.equal((response.jsonBody as any).snapshot.appointments.some((item: any) => item.code === code && item.locationRaw === 'Kaiser SF' && item.locationDisplay === 'Kaiser SF'), true);

  response = await sendDirect({ type: 'set_appointment_notes', code, notes: 'Bring ID' });
  assert.equal((response.jsonBody as any).snapshot.appointments.some((item: any) => item.code === code && item.notes === 'Bring ID'), true);

  response = await sendDirect({ type: 'delete_appointment', code });
  assert.equal((response.jsonBody as any).snapshot.appointments.some((item: any) => item.code === code), false);
});

test('direct endpoint validates date format', async () => {
  const direct = await loadDirect('validation');
  const response = await direct({ json: async () => ({ action: { type: 'set_appointment_date', code: 'APPT-1', date: '06/01/2026' } }) } as any, {} as any);
  assert.equal(response.status, 400);
  assert.match((response.jsonBody as any).message, /YYYY-MM-DD/);
});
