import test from 'node:test';
import assert from 'node:assert/strict';
import { derivePendingProposal, direct } from './direct.js';
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
  delete process.env.OPENAI_API_KEY;
  delete process.env.DIRECT_VERSION;
  delete process.env.OPENAI_MODEL;
  delete process.env.TIME_RESOLVE_OPENAI_FALLBACK;
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

test('resolve_appointment_time returns 502 when AI call fails', async () => {
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
  assert.equal(response.status, 502);
  assert.equal((response.jsonBody as any).ok, false);
  assert.equal((response.jsonBody as any).error?.code, 'OPENAI_CALL_FAILED');
  assert.equal((response.jsonBody as any).fallbackAttempted, true);
  assert.equal((response.jsonBody as any).usedFallback, false);
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
