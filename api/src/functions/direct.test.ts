import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { derivePendingProposal, direct, setAppointmentDocStoreForTests, setAppointmentEventStoreForTests, toResponseSnapshot } from './direct.js';
import { setStorageAdapterForTests } from '../lib/storage/storageFactory.js';
import { ConflictError, GroupNotFoundError, type StorageAdapter } from '../lib/storage/storage.js';
import { setGetAppointmentJsonForTests, setPutAppointmentJsonForTests } from '../lib/tables/appointments.js';
import { setFindAppointmentIndexByIdForTests, setListAppointmentIndexesForGroupForTests, setUpsertAppointmentIndexForTests } from '../lib/tables/entities.js';
import { setMembershipDepsForTests } from '../lib/tables/membership.js';

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
test.afterEach(() => setAppointmentDocStoreForTests(null));
test.afterEach(() => setAppointmentEventStoreForTests(null));
test.afterEach(() => setGetAppointmentJsonForTests(null));
test.afterEach(() => setPutAppointmentJsonForTests(null));
test.afterEach(() => setListAppointmentIndexesForGroupForTests(null));
test.afterEach(() => setFindAppointmentIndexByIdForTests(null));
test.afterEach(() => setUpsertAppointmentIndexForTests(null));
test.afterEach(() => setMembershipDepsForTests(null));
test.afterEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.DIRECT_VERSION;
  delete process.env.OPENAI_MODEL;
  delete process.env.TIME_RESOLVE_OPENAI_FALLBACK;
});



test('direct accepts body.email on create_blank_appointment while authenticating by session email', async () => {
  const sessionId = '11111111-1111-4111-8111-111111111111';
  const sessionBlobName = `familyscheduler/sessions/${sessionId}.json`;
  const sessionBody = Buffer.from(JSON.stringify({
    v: 1,
    email: 'dev@example.com',
    kind: 'full',
    createdAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString()
  }), 'utf8');

  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() { return { state: state(), etag: 'etag-1' }; },
    async save(_groupId, nextState) { return { state: nextState, etag: 'etag-2' }; },
    async getBinary(blobName: string) {
      if (blobName === sessionBlobName) {
        return { contentType: 'application/json', stream: Readable.from(sessionBody) as any };
      }
      const error = new Error('not found') as Error & { statusCode?: number; code?: string };
      error.statusCode = 404;
      error.code = 'BlobNotFound';
      throw error;
    }
  } as StorageAdapter;
  setStorageAdapterForTests(adapter);

  const response = await direct({
    headers: new Headers({ 'x-session-id': sessionId }),
    json: async () => ({ groupId: GROUP_ID, email: 'dev@example.com', action: { type: 'create_blank_appointment' } })
  } as any, context());

  assert.equal(response.status, 200);
  assert.equal((response.jsonBody as any).ok, true);
});


test('create_blank_appointment returns index/doc snapshot and persists new appointment index+doc', async () => {
  const base = state();
  base.appointments.push({
    id: 'existing-1', code: 'APPT-13', title: 'Indexed Existing', schemaVersion: 2, updatedAt: '2026-02-27T08:00:00.000Z',
    date: '2026-03-01', startTime: '09:00', durationMins: 60, timezone: 'America/Los_Angeles', isAllDay: false,
    assigned: [], people: [], location: '', locationRaw: '', locationDisplay: '', locationMapQuery: '', locationName: '', locationAddress: '', locationDirections: '', notes: ''
  } as any);

  const docStore = new Map<string, Record<string, unknown>>([
    ['existing-1', { id: 'existing-1', code: 'APPT-13', title: 'Indexed Existing', date: '2026-03-01', startTime: '09:00', durationMins: 60, isAllDay: false, timezone: 'America/Los_Angeles', people: [], location: '', locationRaw: '', locationDisplay: '', locationMapQuery: '', locationName: '', locationAddress: '', locationDirections: '', notes: '', scanStatus: null, scanImageKey: null, scanImageMime: null, scanCapturedAt: null, updatedAt: '2026-02-27T08:00:00.000Z' }]
  ]);

  const indexes: any[] = [{ partitionKey: GROUP_ID, rowKey: 'rk-existing', appointmentId: 'existing-1', status: 'active', hasScan: false, createdAt: '2026-02-27T08:00:00.000Z', updatedAt: '2026-02-27T08:00:00.000Z', isDeleted: false }];
  setListAppointmentIndexesForGroupForTests(async () => indexes as any);
  setGetAppointmentJsonForTests(async (_groupId, appointmentId) => docStore.get(appointmentId) ?? null);
  setUpsertAppointmentIndexForTests(async (entity) => {
    indexes.unshift(entity);
  });

  setAppointmentDocStoreForTests({
    async getWithEtag(_groupId, appointmentId) {
      return { doc: docStore.get(appointmentId) ?? null, etag: 'etag-doc' };
    },
    async put(_groupId, appointmentId, payload) {
      docStore.set(appointmentId, payload);
    },
    async putWithEtag(_groupId, appointmentId, payload) {
      docStore.set(appointmentId, payload);
      return true;
    }
  });

  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() { return { state: base, etag: 'etag-1' }; },
    async save(_groupId, nextState) { return { state: nextState, etag: 'etag-2' }; }
  } as StorageAdapter;
  setStorageAdapterForTests(adapter);

  const response = await direct({ json: async () => ({ groupId: GROUP_ID, action: { type: 'create_blank_appointment' } }) } as any, context());
  assert.equal(response.status, 200);
  const snapshot = (response.jsonBody as any).snapshot;
  assert.equal(snapshot.appointments.length, 2);
  assert.equal(snapshot.appointments.some((item: any) => item.code === 'APPT-13'), true);
  const created = snapshot.appointments.find((item: any) => item.code !== 'APPT-13');
  assert.ok(created);
  assert.equal(docStore.has(created.id), true);
  assert.equal(indexes.some((entity) => entity.appointmentId === created.id), true);
});
test('direct returns group_not_found when group is missing', async () => {
  const adapter: StorageAdapter = { async initIfMissing() {}, async save() { throw new Error('not used'); }, async load() { throw new GroupNotFoundError(); } };
  setStorageAdapterForTests(adapter);
  const response = await direct({ json: async () => ({ groupId: GROUP_ID, action: { type: 'create_blank_appointment' } }) } as any, context());
  assert.equal(response.status, 404);
});

test('direct maps conflict to 409 with traceId', async () => {
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() { return { state: state(), etag: 'etag-1' }; },
    async save() { throw new ConflictError(); }
  };
  setStorageAdapterForTests(adapter);
  const response = await direct({ json: async () => ({ groupId: GROUP_ID, action: { type: 'create_blank_appointment' } }) } as any, context());
  assert.equal(response.status, 409);
  assert.ok((response.jsonBody as any).traceId);
  assert.equal((response.jsonBody as any).directVersion, 'unknown');
  assert.equal((response.jsonBody as any).invocationId, 'inv-123');
  const headers = response.headers as Record<string, string>;
  assert.equal(headers['x-invocation-id'], 'inv-123');
  assert.equal(headers['x-traceparent'], '00-traceparent');
  assert.ok(headers['x-trace-id']);
  assert.match(headers['access-control-expose-headers'], /x-trace-id/);
});


test('resolve_appointment_time returns suggested duration for single-point input without persisting', async () => {
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.OPENAI_MODEL = 'gpt-test';
  const originalFetch = global.fetch;
  global.fetch = (async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      id: 'resp_case1',
      model: 'gpt-test',
      output_text: JSON.stringify({
        status: 'resolved',
        startUtc: '2026-03-03T21:00:00.000Z',
        endUtc: '2026-03-03T22:30:00.000Z',
        durationSource: 'suggested',
        durationConfidence: 0.77,
        durationReason: 'Single point interpreted as a typical 90-minute appointment.',
        missing: [],
        assumptions: []
      })
    })
  })) as unknown as typeof fetch;

  let saveCalls = 0;
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() { return { state: state(), etag: 'etag-1' }; },
    async save() { saveCalls += 1; throw new Error('save should not be called'); }
  };
  setStorageAdapterForTests(adapter);
  const response = await direct({ json: async () => ({ groupId: GROUP_ID, action: { type: 'resolve_appointment_time', appointmentId: 'APPT-1', whenText: '3/3 1pm', timezone: 'America/Los_Angeles' } }) } as any, context());
  assert.equal(response.status, 200);
  assert.equal(saveCalls, 0);
  assert.equal((response.jsonBody as any).ok, true);
  assert.equal((response.jsonBody as any).time?.intent?.status, 'resolved');
  assert.equal((response.jsonBody as any).time?.resolved?.timezone, 'America/Los_Angeles');
  assert.equal((response.jsonBody as any).time?.resolved?.durationSource, 'suggested');
  assert.equal((response.jsonBody as any).time?.resolved?.inferenceVersion, 'timeparse-vNext');
  assert.notEqual((response.jsonBody as any).time?.resolved?.endUtc, '2026-03-03T21:01:00.000Z');
  assert.equal((response.jsonBody as any).usedFallback, true);
  assert.equal((response.jsonBody as any).fallbackAttempted, true);
  assert.equal((response.jsonBody as any).directVersion, 'unknown');
  assert.equal((response.jsonBody as any).opId, 'resp_case1');
  assert.equal(typeof (response.jsonBody as any).nowIso, 'string');
  assert.equal((response.jsonBody as any).invocationId, 'inv-123');
  global.fetch = originalFetch;
});




test('resolve_appointment_time marks explicit duration when user provides duration text', async () => {
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.OPENAI_MODEL = 'gpt-test';
  const originalFetch = global.fetch;
  global.fetch = (async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      id: 'resp_abc',
      model: 'gpt-test',
      output_text: JSON.stringify({
        status: 'resolved',
        startUtc: '2026-01-02T18:00:00.000Z',
        endUtc: '2026-01-02T20:00:00.000Z',
        durationSource: 'explicit',
        durationConfidence: 0.99,
        durationReason: 'Input includes explicit duration phrase "for 2 hours".',
        missing: [],
        assumptions: []
      })
    })
  })) as unknown as typeof fetch;

  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() { return { state: state(), etag: 'etag-1' }; },
    async save() { throw new Error('save should not be called'); }
  };
  setStorageAdapterForTests(adapter);

  const response = await direct({ json: async () => ({ groupId: GROUP_ID, action: { type: 'resolve_appointment_time', appointmentId: 'APPT-1', whenText: 'dinner at 6pm tomorrow for 2 hours', timezone: 'America/Los_Angeles' } }) } as any, context());
  assert.equal(response.status, 200);
  assert.equal((response.jsonBody as any).fallbackAttempted, true);
  assert.equal((response.jsonBody as any).usedFallback, true);
  assert.equal((response.jsonBody as any).opId, 'resp_abc');
  assert.equal((response.jsonBody as any).time?.resolved?.durationSource, 'explicit');

  global.fetch = originalFetch;
});

test('resolve_appointment_time returns deterministic parse when AI call fails', async () => {
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

  const response = await direct({ json: async () => ({ groupId: GROUP_ID, action: { type: 'resolve_appointment_time', appointmentId: 'APPT-1', whenText: 'tomorrow at 1pm', timezone: 'America/Los_Angeles' } }) } as any, context());
  assert.equal(response.status, 200);
  assert.equal((response.jsonBody as any).ok, true);
  assert.equal((response.jsonBody as any).fallbackAttempted, true);
  assert.equal((response.jsonBody as any).usedFallback, false);
  assert.equal((response.jsonBody as any).time?.intent?.status, 'resolved');
  assert.equal((response.jsonBody as any).directVersion, 'unknown');
  assert.equal((response.jsonBody as any).opId, null);
  assert.equal(saveCalls, 0);

  global.fetch = originalFetch;
});

test('derivePendingProposal returns active title proposal in pending state', () => {
  const pending = derivePendingProposal([
    {
      id: 'ev-created',
      tsUtc: '2026-01-01T00:00:00.000Z',
      type: 'PROPOSAL_CREATED',
      actor: { kind: 'SYSTEM' },
      proposalId: 'proposal-1',
      payload: { field: 'title', from: 'Old title', to: 'New title', proposalId: 'proposal-1' }
    } as any
  ]);

  assert.deepEqual(pending, {
    id: 'proposal-1',
    field: 'title',
    fromValue: 'Old title',
    toValue: 'New title',
    status: 'pending',
    createdTsUtc: '2026-01-01T00:00:00.000Z',
    countdownEndsTsUtc: null,
    actor: { kind: 'SYSTEM' }
  });
});

test('derivePendingProposal returns paused status and edited value when proposal is paused', () => {
  const pending = derivePendingProposal([
    {
      id: 'ev-created',
      tsUtc: '2026-01-01T00:00:00.000Z',
      type: 'PROPOSAL_CREATED',
      actor: { kind: 'SYSTEM' },
      proposalId: 'proposal-1',
      payload: { field: 'title', from: 'Old title', to: 'Draft title', proposalId: 'proposal-1' }
    } as any,
    {
      id: 'ev-edited',
      tsUtc: '2026-01-01T00:00:01.000Z',
      type: 'PROPOSAL_EDITED',
      actor: { kind: 'HUMAN', email: 'dev@example.com' },
      proposalId: 'proposal-1',
      payload: { proposalId: 'proposal-1', beforeText: 'Draft title', afterText: 'Edited title' }
    } as any,
    {
      id: 'ev-paused',
      tsUtc: '2026-01-01T00:00:02.000Z',
      type: 'PROPOSAL_PAUSED',
      actor: { kind: 'HUMAN', email: 'dev@example.com' },
      proposalId: 'proposal-1',
      payload: { proposalId: 'proposal-1' }
    } as any
  ]);

  assert.equal(pending?.status, 'paused');
  assert.equal(pending?.toValue, 'Edited title');
});

test('derivePendingProposal returns null when proposal has been applied or canceled', () => {
  const applied = derivePendingProposal([
    {
      id: 'ev-created',
      tsUtc: '2026-01-01T00:00:00.000Z',
      type: 'PROPOSAL_CREATED',
      actor: { kind: 'SYSTEM' },
      proposalId: 'proposal-1',
      payload: { field: 'title', from: 'Old title', to: 'New title', proposalId: 'proposal-1' }
    } as any,
    {
      id: 'ev-applied',
      tsUtc: '2026-01-01T00:00:03.000Z',
      type: 'PROPOSAL_APPLIED',
      actor: { kind: 'HUMAN', email: 'dev@example.com' },
      proposalId: 'proposal-1',
      payload: { proposalId: 'proposal-1', field: 'title' }
    } as any
  ]);

  const canceled = derivePendingProposal([
    {
      id: 'ev-created',
      tsUtc: '2026-01-01T00:00:00.000Z',
      type: 'PROPOSAL_CREATED',
      actor: { kind: 'SYSTEM' },
      proposalId: 'proposal-2',
      payload: { field: 'title', from: 'Old title', to: 'New title', proposalId: 'proposal-2' }
    } as any,
    {
      id: 'ev-cancel',
      tsUtc: '2026-01-01T00:00:04.000Z',
      type: 'PROPOSAL_CANCELED',
      actor: { kind: 'HUMAN', email: 'dev@example.com' },
      proposalId: 'proposal-2',
      payload: { proposalId: 'proposal-2', field: 'title' }
    } as any
  ]);

  assert.equal(applied, null);
  assert.equal(canceled, null);
});


test('create_blank_appointment materializes appointment.json for the new appointment id', async () => {
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() { return { state: state(), etag: 'etag-1' }; },
    async save(_groupId, nextState) { return { state: nextState, etag: 'etag-2' }; }
  };
  setStorageAdapterForTests(adapter);

  let createdAppointmentId = '';
  let getCalls = 0;
  setAppointmentDocStoreForTests({
    async getWithEtag(_groupId: string, appointmentId: string) {
      getCalls += 1;
      createdAppointmentId = appointmentId;
      if (getCalls === 1) return { doc: null, etag: null };
      return { doc: { id: appointmentId, title: '' }, etag: 'doc-etag-1' };
    },
    async put(_groupId: string, appointmentId: string) {
      createdAppointmentId = appointmentId;
    }
  });

  const response = await direct({ json: async () => ({ groupId: GROUP_ID, action: { type: 'create_blank_appointment' } }) } as any, context());
  assert.equal(response.status, 200);
  assert.equal((response.jsonBody as any).ok, true);
  assert.ok(createdAppointmentId);
  assert.ok(getCalls >= 2);
});

test('apply_appointment_proposal succeeds when appointment.json is initially missing', async () => {
  const baseState = state();
  baseState.appointments = [{
    id: 'APPT-1',
    code: 'APPT-1',
    title: 'Old title',
    desc: 'Old title',
    date: '2026-03-01',
    isAllDay: false,
    people: [],
    location: '',
    notes: ''
  }];
  let savedTitle = '';
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() { return { state: structuredClone(baseState), etag: 'etag-1' }; },
    async save(_groupId, nextState) {
      savedTitle = nextState.appointments.find((item: any) => item.id === 'APPT-1')?.title ?? '';
      return { state: nextState, etag: 'etag-2' };
    }
  };
  setStorageAdapterForTests(adapter);

  let getDocCalls = 0;
  setAppointmentDocStoreForTests({
    async getWithEtag(_groupId: string, _appointmentId: string) {
      getDocCalls += 1;
      if (getDocCalls === 1) return { doc: null, etag: null };
      return { doc: { id: 'APPT-1', title: 'Old title', reconciliation: { status: 'unreconciled' } }, etag: 'doc-etag-1' };
    },
    async put() {},
    async putWithEtag() { return true; }
  });

  setAppointmentEventStoreForTests({
    async hasLatestIdempotencyKey() { return false; },
    async recent() {
      return {
        events: [{
          id: 'ev-proposal',
          tsUtc: '2026-03-01T00:00:00.000Z',
          type: 'PROPOSAL_CREATED',
          actor: { kind: 'SYSTEM' },
          proposalId: 'proposal-1',
          payload: { field: 'title', from: 'Old title', to: 'New title', proposalId: 'proposal-1' }
        } as any],
        nextCursor: null
      };
    },
    async append(_groupId: string, _appointmentId: string, event: any) {
      return { appended: true, event, chunkId: 1 };
    }
  });

  const response = await direct({
    json: async () => ({
      groupId: GROUP_ID,
      action: { type: 'apply_appointment_proposal', appointmentId: 'APPT-1', proposalId: 'proposal-1', field: 'title', value: 'New title', clientRequestId: 'req-1' }
    })
  } as any, context());

  assert.equal(response.status, 200);
  assert.equal((response.jsonBody as any).ok, true);
  assert.ok(getDocCalls >= 2);
  assert.equal(savedTitle, 'New title');
  assert.equal((response.jsonBody as any).appointment?.title, 'New title');
  assert.equal((response.jsonBody as any).appointment?.desc, 'New title');
});


test('apply_appointment_proposal persists updated title for subsequent list snapshots', async () => {
  const baseState = state();
  baseState.appointments = [{ id: 'APPT-1', code: 'APPT-1', title: 'Old title', date: '2026-03-01', isAllDay: false, people: [], location: '', notes: '' }];
  let currentState = structuredClone(baseState);
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() { return { state: structuredClone(currentState), etag: 'etag-1' }; },
    async save(_groupId, nextState) { currentState = structuredClone(nextState); return { state: nextState, etag: 'etag-2' }; }
  };
  setStorageAdapterForTests(adapter);

  setAppointmentDocStoreForTests({
    async getWithEtag() { return { doc: { id: 'APPT-1', title: 'Old title', reconciliation: { status: 'unreconciled' } }, etag: 'doc-etag-1' }; },
    async put() {},
    async putWithEtag() { return true; }
  });
  setAppointmentEventStoreForTests({
    async hasLatestIdempotencyKey() { return false; },
    async recent() {
      return {
        events: [{ id: 'ev-proposal', tsUtc: '2026-03-01T00:00:00.000Z', type: 'PROPOSAL_CREATED', actor: { kind: 'SYSTEM' }, proposalId: 'proposal-1', payload: { field: 'title', from: 'Old title', to: 'New title', proposalId: 'proposal-1' } } as any],
        nextCursor: null
      };
    },
    async append(_groupId: string, _appointmentId: string, event: any) { return { appended: true, event, chunkId: 1 }; }
  });

  const applyResponse = await direct({ json: async () => ({ groupId: GROUP_ID, action: { type: 'apply_appointment_proposal', appointmentId: 'APPT-1', proposalId: 'proposal-1', field: 'title', value: 'New title', clientRequestId: 'req-list-1' } }) } as any, context());
  assert.equal(applyResponse.status, 200);

  const loaded = await adapter.load(GROUP_ID);
  assert.equal(loaded.state.appointments[0]?.title, 'New title');
});


test('resolve_appointment_time avoids 502 for malformed AI partial on time-only phrases', async () => {
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.OPENAI_MODEL = 'gpt-test';
  const originalFetch = global.fetch;
  global.fetch = (async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      id: 'resp_bad_partial',
      output_text: JSON.stringify({ status: 'partial', missing: [] })
    })
  })) as unknown as typeof fetch;

  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() { return { state: state(), etag: 'etag-1' }; },
    async save() { throw new Error('save should not be called'); }
  };
  setStorageAdapterForTests(adapter);

  const response = await direct({ json: async () => ({ groupId: GROUP_ID, action: { type: 'resolve_appointment_time', appointmentId: 'APPT-1', whenText: 'set time to 4pm', timezone: 'America/Los_Angeles' } }) } as any, context());
  assert.equal(response.status, 200);
  assert.equal((response.jsonBody as any).ok, true);
  assert.equal((response.jsonBody as any).fallbackAttempted, true);
  assert.equal((response.jsonBody as any).usedFallback, false);
  assert.equal((response.jsonBody as any).time?.intent?.status, 'unresolved');
  assert.deepEqual((response.jsonBody as any).time?.intent?.missing, ['date']);
  assert.equal(Array.isArray((response.jsonBody as any).timeChoices), true);
  assert.equal((response.jsonBody as any).timeChoices.length, 3);
  assert.deepEqual((response.jsonBody as any).timeChoices.map((choice: any) => choice.id), ['today', 'tomorrow', 'appointment']);

  global.fetch = originalFetch;
});

test('resolve_appointment_time with explicit date anchor returns no timeChoices', async () => {
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.OPENAI_MODEL = 'gpt-test';
  const originalFetch = global.fetch;
  global.fetch = (async () => ({ ok: false, status: 503, json: async () => ({}) })) as unknown as typeof fetch;

  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() { return { state: state(), etag: 'etag-1' }; },
    async save() { throw new Error('save should not be called'); }
  };
  setStorageAdapterForTests(adapter);

  const response = await direct({ json: async () => ({ groupId: GROUP_ID, action: { type: 'resolve_appointment_time', appointmentId: 'APPT-1', whenText: 'tomorrow at 8pm', timezone: 'America/Los_Angeles' } }) } as any, context());
  assert.equal(response.status, 200);
  assert.equal((response.jsonBody as any).time?.intent?.status, 'resolved');
  assert.equal((response.jsonBody as any).timeChoices, undefined);

  global.fetch = originalFetch;
});

test('resolve_appointment_time appointment choice uses appointment local date when present', async () => {
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.OPENAI_MODEL = 'gpt-test';
  const originalFetch = global.fetch;
  global.fetch = (async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      id: 'resp_bad_partial_2',
      output_text: JSON.stringify({ status: 'partial', missing: [] })
    })
  })) as unknown as typeof fetch;

  const base = state();
  base.appointments = [{
    id: 'APPT-1',
    code: 'APPT-1',
    title: 'Test appointment',
    date: '2026-03-10',
    isAllDay: false,
    people: [],
    location: '',
    notes: ''
  } as any];

  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() { return { state: base, etag: 'etag-1' }; },
    async save() { throw new Error('save should not be called'); }
  };
  setStorageAdapterForTests(adapter);

  const response = await direct({ json: async () => ({ groupId: GROUP_ID, action: { type: 'resolve_appointment_time', appointmentId: 'APPT-1', whenText: 'set time to 8pm', timezone: 'America/Los_Angeles' } }) } as any, context());
  assert.equal(response.status, 200);
  assert.equal((response.jsonBody as any).time?.intent?.status, 'unresolved');
  const appointmentChoice = (response.jsonBody as any).timeChoices.find((choice: any) => choice.id === 'appointment');
  assert.equal(appointmentChoice?.dateLocal, '2026-03-10');

  global.fetch = originalFetch;
});

test('toResponseSnapshot filters soft-deleted appointments', () => {
  const snapshot = (toResponseSnapshot as any)({
    ...state(),
    appointments: [
      { id: 'appt-1', code: 'APPT-1', title: 'Visible', date: '2026-01-01', assigned: [], people: [], location: '', locationRaw: '', locationDisplay: '', locationMapQuery: '', locationName: '', locationAddress: '', locationDirections: '', notes: '', isAllDay: true },
      { id: 'appt-2', code: 'APPT-2', title: 'Hidden', date: '2026-01-01', assigned: [], people: [], location: '', locationRaw: '', locationDisplay: '', locationMapQuery: '', locationName: '', locationAddress: '', locationDirections: '', notes: '', isAllDay: true, isDeleted: true }
    ]
  });
  assert.equal(snapshot.appointments.length, 1);
  assert.equal(snapshot.appointments[0].code, 'APPT-1');
});


test('delete_appointment uses appointmentId and soft-deletes index/doc backed snapshot', async () => {
  const base = state();
  base.appointments.push({ id: 'appt-1', code: 'APPT-1', title: 'Dentist', people: [], assigned: [] } as any);
  const docs = new Map<string, Record<string, unknown>>([
    ['appt-1', { id: 'appt-1', code: 'APPT-1', title: 'Dentist', date: '2026-03-01', isDeleted: false }]
  ]);
  const indexes = new Map<string, any>([
    ['appt-1', { partitionKey: GROUP_ID, rowKey: 'rk-1', appointmentId: 'appt-1', status: 'active', hasScan: false, createdAt: '2026-02-27T08:00:00.000Z', updatedAt: '2026-02-27T08:00:00.000Z', isDeleted: false }]
  ]);

  setFindAppointmentIndexByIdForTests(async (_groupId, appointmentId) => indexes.get(appointmentId) ?? null);
  setUpsertAppointmentIndexForTests(async (entity) => { indexes.set(entity.appointmentId, entity); });
  setListAppointmentIndexesForGroupForTests(async () => Array.from(indexes.values()).filter((entry) => entry.isDeleted !== true));
  setGetAppointmentJsonForTests(async (_groupId, appointmentId) => docs.get(appointmentId) ?? null);
  setPutAppointmentJsonForTests(async (_groupId, appointmentId, payload) => { docs.set(appointmentId, payload); });

  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() { return { state: base, etag: 'etag-1' }; },
    async save() { throw new Error('save should not be called for index/doc soft delete path'); }
  } as StorageAdapter;
  setStorageAdapterForTests(adapter);

  const response = await direct({ json: async () => ({ groupId: GROUP_ID, action: { type: 'delete_appointment', appointmentId: 'appt-1' } }) } as any, context());
  assert.equal(response.status, 200);
  assert.equal((response.jsonBody as any).ok, true);
  assert.equal((response.jsonBody as any).snapshot.appointments.some((entry: any) => entry.id === 'appt-1'), false);
  assert.equal(indexes.get('appt-1')?.isDeleted, true);
  assert.equal(docs.get('appt-1')?.isDeleted, true);
});

test('delete_appointment returns ok:false + unchanged snapshot when appointmentId is missing from index', async () => {
  const base = state();
  const docs = new Map<string, Record<string, unknown>>([
    ['appt-2', { id: 'appt-2', code: 'APPT-2', title: 'Keep me', date: '2026-03-02' }]
  ]);
  const indexes = new Map<string, any>([
    ['appt-2', { partitionKey: GROUP_ID, rowKey: 'rk-2', appointmentId: 'appt-2', status: 'active', hasScan: false, createdAt: '2026-02-27T08:00:00.000Z', updatedAt: '2026-02-27T08:00:00.000Z', isDeleted: false }]
  ]);

  setFindAppointmentIndexByIdForTests(async (_groupId, appointmentId) => indexes.get(appointmentId) ?? null);
  setUpsertAppointmentIndexForTests(async (entity) => { indexes.set(entity.appointmentId, entity); });
  setListAppointmentIndexesForGroupForTests(async () => Array.from(indexes.values()).filter((entry) => entry.isDeleted !== true));
  setGetAppointmentJsonForTests(async (_groupId, appointmentId) => docs.get(appointmentId) ?? null);
  setPutAppointmentJsonForTests(async (_groupId, appointmentId, payload) => { docs.set(appointmentId, payload); });

  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() { return { state: base, etag: 'etag-1' }; },
    async save() { throw new Error('save should not be called for missing delete'); }
  } as StorageAdapter;
  setStorageAdapterForTests(adapter);

  const response = await direct({ json: async () => ({ groupId: GROUP_ID, action: { type: 'delete_appointment', appointmentId: 'missing-123' } }) } as any, context());
  assert.equal(response.status, 200);
  assert.equal((response.jsonBody as any).ok, false);
  assert.match((response.jsonBody as any).message, /Not found: missing-123/);
  assert.equal((response.jsonBody as any).snapshot.appointments.some((entry: any) => entry.id === 'appt-2'), true);
});

test('get_appointment_detail returns 200 when index+blob exist but state.json appointments is stale', async () => {
  const sessionId = '33333333-3333-4333-8333-333333333333';
  const sessionBlobName = `familyscheduler/sessions/${sessionId}.json`;
  const sessionBody = Buffer.from(JSON.stringify({
    v: 1,
    email: 'member@example.com',
    kind: 'full',
    createdAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString()
  }), 'utf8');
  const base = state();
  const docs = new Map<string, Record<string, unknown>>([
    ['appt-1', { id: 'appt-1', code: 'APPT-1', title: 'Dentist', date: '2026-03-01', isAllDay: true, people: [] }]
  ]);
  setFindAppointmentIndexByIdForTests(async () => ({ partitionKey: GROUP_ID, rowKey: 'rk-1', appointmentId: 'appt-1', status: 'active', hasScan: false, createdAt: '2026-02-27T08:00:00.000Z', updatedAt: '2026-02-27T08:00:00.000Z', isDeleted: false } as any));
  setGetAppointmentJsonForTests(async (_groupId, appointmentId) => docs.get(appointmentId) ?? null);
  setAppointmentEventStoreForTests({ recent: async () => ({ events: [], nextCursor: null }) as any });
  setAppointmentDocStoreForTests({ getWithEtag: async () => ({ doc: null, etag: null }) });
  setMembershipDepsForTests({
    getGroupMemberEntity: async () => ({ partitionKey: GROUP_ID, rowKey: 'user:member@example.com', userKey: 'user:member@example.com', email: 'member@example.com', status: 'active', updatedAt: new Date().toISOString() } as any),
    getUserGroupEntity: async () => null,
    upsertGroupMember: async () => {},
    upsertUserGroup: async () => {}
  });

  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() { return { state: base, etag: 'etag-1' }; },
    async save() { throw new Error('save should not be called'); },
    async getBinary(blobName: string) {
      if (blobName === sessionBlobName) return { contentType: 'application/json', stream: Readable.from(sessionBody) as any };
      const error = new Error('not found') as Error & { statusCode?: number; code?: string };
      error.statusCode = 404;
      error.code = 'BlobNotFound';
      throw error;
    }
  } as StorageAdapter;
  setStorageAdapterForTests(adapter);

  const response = await direct({ headers: new Headers({ 'x-session-id': sessionId }), json: async () => ({ groupId: GROUP_ID, action: { type: 'get_appointment_detail', appointmentId: 'appt-1' } }) } as any, context());
  assert.equal(response.status, 200);
  assert.equal((response.jsonBody as any).appointment?.id, 'appt-1');
  assert.equal((response.jsonBody as any).appointment?.title, 'Dentist');
});

test('get_appointment_detail returns 404 when index row is missing', async () => {
  const sessionId = '44444444-4444-4444-8444-444444444444';
  const sessionBlobName = `familyscheduler/sessions/${sessionId}.json`;
  const sessionBody = Buffer.from(JSON.stringify({ v: 1, email: 'member@example.com', kind: 'full', createdAt: new Date(Date.now() - 60_000).toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() }), 'utf8');
  setFindAppointmentIndexByIdForTests(async () => null);
  setMembershipDepsForTests({ getGroupMemberEntity: async () => ({ partitionKey: GROUP_ID, rowKey: 'user:member@example.com', userKey: 'user:member@example.com', email: 'member@example.com', status: 'active', updatedAt: new Date().toISOString() } as any), getUserGroupEntity: async () => null, upsertGroupMember: async () => {}, upsertUserGroup: async () => {} });
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() { return { state: state(), etag: 'etag-1' }; },
    async save() { throw new Error('save should not be called'); },
    async getBinary(blobName: string) { if (blobName === sessionBlobName) return { contentType: 'application/json', stream: Readable.from(sessionBody) as any }; const error = new Error('not found') as Error & { statusCode?: number; code?: string }; error.statusCode = 404; error.code = 'BlobNotFound'; throw error; }
  } as StorageAdapter;
  setStorageAdapterForTests(adapter);

  const response = await direct({ headers: new Headers({ 'x-session-id': sessionId }), json: async () => ({ groupId: GROUP_ID, action: { type: 'get_appointment_detail', appointmentId: 'missing-1' } }) } as any, context());
  assert.equal(response.status, 404);
  assert.equal((response.jsonBody as any).error, 'appointment_not_found');
});

test('get_appointment_detail returns 404 when index row is soft-deleted', async () => {
  const sessionId = '55555555-5555-4555-8555-555555555555';
  const sessionBlobName = `familyscheduler/sessions/${sessionId}.json`;
  const sessionBody = Buffer.from(JSON.stringify({ v: 1, email: 'member@example.com', kind: 'full', createdAt: new Date(Date.now() - 60_000).toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() }), 'utf8');
  setFindAppointmentIndexByIdForTests(async () => ({ partitionKey: GROUP_ID, rowKey: 'rk-deleted', appointmentId: 'appt-deleted', status: 'active', hasScan: false, createdAt: '2026-02-27T08:00:00.000Z', updatedAt: '2026-02-27T08:00:00.000Z', isDeleted: true } as any));
  setMembershipDepsForTests({ getGroupMemberEntity: async () => ({ partitionKey: GROUP_ID, rowKey: 'user:member@example.com', userKey: 'user:member@example.com', email: 'member@example.com', status: 'active', updatedAt: new Date().toISOString() } as any), getUserGroupEntity: async () => null, upsertGroupMember: async () => {}, upsertUserGroup: async () => {} });
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() { return { state: state(), etag: 'etag-1' }; },
    async save() { throw new Error('save should not be called'); },
    async getBinary(blobName: string) { if (blobName === sessionBlobName) return { contentType: 'application/json', stream: Readable.from(sessionBody) as any }; const error = new Error('not found') as Error & { statusCode?: number; code?: string }; error.statusCode = 404; error.code = 'BlobNotFound'; throw error; }
  } as StorageAdapter;
  setStorageAdapterForTests(adapter);

  const response = await direct({ headers: new Headers({ 'x-session-id': sessionId }), json: async () => ({ groupId: GROUP_ID, action: { type: 'get_appointment_detail', appointmentId: 'appt-deleted' } }) } as any, context());
  assert.equal(response.status, 404);
  assert.equal((response.jsonBody as any).error, 'appointment_not_found');
});

test('get_appointment_detail returns 404 when appointment blob is missing despite existing index', async () => {
  const sessionId = '66666666-6666-4666-8666-666666666666';
  const sessionBlobName = `familyscheduler/sessions/${sessionId}.json`;
  const sessionBody = Buffer.from(JSON.stringify({ v: 1, email: 'member@example.com', kind: 'full', createdAt: new Date(Date.now() - 60_000).toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() }), 'utf8');
  let warned = false;
  const warnContext = () => ({ ...context(), warn: () => { warned = true; } } as any);
  setFindAppointmentIndexByIdForTests(async () => ({ partitionKey: GROUP_ID, rowKey: 'rk-1', appointmentId: 'appt-1', status: 'active', hasScan: false, createdAt: '2026-02-27T08:00:00.000Z', updatedAt: '2026-02-27T08:00:00.000Z', isDeleted: false } as any));
  setGetAppointmentJsonForTests(async () => null);
  setMembershipDepsForTests({ getGroupMemberEntity: async () => ({ partitionKey: GROUP_ID, rowKey: 'user:member@example.com', userKey: 'user:member@example.com', email: 'member@example.com', status: 'active', updatedAt: new Date().toISOString() } as any), getUserGroupEntity: async () => null, upsertGroupMember: async () => {}, upsertUserGroup: async () => {} });
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() { return { state: state(), etag: 'etag-1' }; },
    async save() { throw new Error('save should not be called'); },
    async getBinary(blobName: string) { if (blobName === sessionBlobName) return { contentType: 'application/json', stream: Readable.from(sessionBody) as any }; const error = new Error('not found') as Error & { statusCode?: number; code?: string }; error.statusCode = 404; error.code = 'BlobNotFound'; throw error; }
  } as StorageAdapter;
  setStorageAdapterForTests(adapter);

  const response = await direct({ headers: new Headers({ 'x-session-id': sessionId }), json: async () => ({ groupId: GROUP_ID, action: { type: 'get_appointment_detail', appointmentId: 'appt-1' } }) } as any, warnContext());
  assert.equal(response.status, 404);
  assert.equal((response.jsonBody as any).error, 'appointment_not_found');
  assert.equal(warned, true);
});
