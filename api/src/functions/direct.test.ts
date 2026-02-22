import test from 'node:test';
import assert from 'node:assert/strict';
import { direct } from './direct.js';
import { setStorageAdapterForTests } from '../lib/storage/storageFactory.js';
import { ConflictError, GroupNotFoundError, type StorageAdapter } from '../lib/storage/storage.js';

const GROUP_ID = '22222222-2222-4222-8222-222222222222';
const PHONE = '+14155550123';

const context = () => ({ invocationId: 'inv-123', traceContext: { traceParent: '00-traceparent' }, log: () => {} } as any);

const state = () => ({
  schemaVersion: 3,
  groupId: GROUP_ID,
  groupName: 'Test Group',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  people: [{ personId: 'P-1', name: 'Creator', cellE164: PHONE, cellDisplay: '(415) 555-0123', status: 'active' }],
  appointments: [],
  rules: [],
  history: []
} as any);

test.afterEach(() => setStorageAdapterForTests(null));
test.afterEach(() => {
  delete process.env.TIME_RESOLVE_OPENAI_FALLBACK;
  delete process.env.OPENAI_API_KEY;
  delete process.env.DIRECT_VERSION;
  delete process.env.OPENAI_MODEL;
});

test('direct returns group_not_found when group is missing', async () => {
  const adapter: StorageAdapter = { async initIfMissing() {}, async save() { throw new Error('not used'); }, async load() { throw new GroupNotFoundError(); } };
  setStorageAdapterForTests(adapter);
  const response = await direct({ json: async () => ({ groupId: GROUP_ID, phone: PHONE, action: { type: 'create_blank_appointment' } }) } as any, context());
  assert.equal(response.status, 404);
});

test('direct maps conflict to 409 with traceId', async () => {
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() { return { state: state(), etag: 'etag-1' }; },
    async save() { throw new ConflictError(); }
  };
  setStorageAdapterForTests(adapter);
  const response = await direct({ json: async () => ({ groupId: GROUP_ID, phone: PHONE, action: { type: 'create_blank_appointment' } }) } as any, context());
  assert.equal(response.status, 409);
  assert.ok((response.jsonBody as any).traceId);
  assert.equal((response.jsonBody as any).directVersion, 'unknown');
  const headers = response.headers as Record<string, string>;
  assert.equal(headers['x-invocation-id'], 'inv-123');
  assert.equal(headers['x-traceparent'], '00-traceparent');
  assert.ok(headers['x-trace-id']);
  assert.match(headers['access-control-expose-headers'], /x-trace-id/);
});


test('resolve_appointment_time returns resolved time without persisting', async () => {
  let saveCalls = 0;
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() { return { state: state(), etag: 'etag-1' }; },
    async save() { saveCalls += 1; throw new Error('save should not be called'); }
  };
  setStorageAdapterForTests(adapter);
  const response = await direct({ json: async () => ({ groupId: GROUP_ID, phone: PHONE, action: { type: 'resolve_appointment_time', appointmentId: 'APPT-1', whenText: '3/3 1pm', timezone: 'America/Los_Angeles' } }) } as any, context());
  assert.equal(response.status, 200);
  assert.equal(saveCalls, 0);
  assert.equal((response.jsonBody as any).ok, true);
  assert.equal((response.jsonBody as any).time?.intent?.status, 'resolved');
  assert.equal((response.jsonBody as any).time?.resolved?.timezone, 'America/Los_Angeles');
  assert.equal((response.jsonBody as any).usedFallback, false);
  assert.equal((response.jsonBody as any).fallbackAttempted, false);
  assert.equal((response.jsonBody as any).directVersion, 'unknown');
});

test('resolve_appointment_time does not attempt fallback when feature flag is off', async () => {
  process.env.TIME_RESOLVE_OPENAI_FALLBACK = '0';
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() { return { state: state(), etag: 'etag-1' }; },
    async save() { throw new Error('save should not be called'); }
  };
  setStorageAdapterForTests(adapter);

  const response = await direct({ json: async () => ({ groupId: GROUP_ID, phone: PHONE, action: { type: 'resolve_appointment_time', appointmentId: 'APPT-1', whenText: 'tomorrow at 1pm', timezone: 'America/Los_Angeles' } }) } as any, context());
  assert.equal(response.status, 200);
  assert.equal((response.jsonBody as any).fallbackAttempted, false);
  assert.equal((response.jsonBody as any).usedFallback, false);
  assert.equal(typeof (response.jsonBody as any).directVersion, 'string');
});


test('resolve_appointment_time returns openai error when fallback call fails', async () => {
  process.env.TIME_RESOLVE_OPENAI_FALLBACK = '1';
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.OPENAI_MODEL = 'gpt-test';
  const originalFetch = global.fetch;
  global.fetch = (async () => ({ ok: false, status: 503, json: async () => ({}) })) as unknown as typeof fetch;

  let saveCalls = 0;
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() { return { state: state(), etag: 'etag-1' }; },
    async save() { saveCalls += 1; throw new Error('save should not be called'); }
  };
  setStorageAdapterForTests(adapter);

  const response = await direct({ json: async () => ({ groupId: GROUP_ID, phone: PHONE, action: { type: 'resolve_appointment_time', appointmentId: 'APPT-1', whenText: 'tomorrow at 1pm', timezone: 'America/Los_Angeles' } }) } as any, context());
  assert.equal(response.status, 502);
  assert.equal((response.jsonBody as any).ok, false);
  assert.equal((response.jsonBody as any).error?.code, 'OPENAI_CALL_FAILED');
  assert.equal((response.jsonBody as any).fallbackAttempted, true);
  assert.equal((response.jsonBody as any).usedFallback, false);
  assert.equal((response.jsonBody as any).directVersion, 'unknown');
  assert.equal(saveCalls, 0);

  global.fetch = originalFetch;
});
