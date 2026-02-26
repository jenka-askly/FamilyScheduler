import test from 'node:test';
import assert from 'node:assert/strict';
import { chat } from './chat.js';
import { setStorageAdapterForTests } from '../lib/storage/storageFactory.js';
import { ConflictError, GroupNotFoundError, type StorageAdapter } from '../lib/storage/storage.js';
import { setUsageMeterStoreForTests, type UsageMeterRecord } from '../lib/usageMeter.js';

const GROUP_ID = '11111111-1111-4111-8111-111111111111';
const PHONE = '+14155550123';
const originalFetch = globalThis.fetch;

const baseState = () => ({ schemaVersion: 3, groupId: GROUP_ID, groupName: 'Test Group', createdAt: '', updatedAt: '', people: [{ personId: 'P-1', name: 'Creator', cellE164: PHONE, cellDisplay: '(415) 555-0123', status: 'active' }], appointments: [], rules: [], history: [] } as any);

const okAdapter = (): StorageAdapter => ({
  async initIfMissing() {},
  async load() { return { state: baseState(), etag: 'e1' }; },
  async save(_g, next) { return { state: next as any, etag: 'e2' }; }
});

test.afterEach(() => {
  setStorageAdapterForTests(null);
  setUsageMeterStoreForTests(null);
  globalThis.fetch = originalFetch;
});

test('chat returns group_not_found when group is missing', async () => {
  const adapter: StorageAdapter = { async initIfMissing() {}, async save() { throw new Error('not used'); }, async load() { throw new GroupNotFoundError(); } };
  setStorageAdapterForTests(adapter);
  const response = await chat({ json: async () => ({ groupId: GROUP_ID, message: 'help', traceId: 't1' }), headers: { get: () => 's1' } } as any, {} as any);
  assert.equal(response.status, 404);
  assert.equal((response.jsonBody as any).traceId, 't1');
});

test('chat returns 502 for OpenAI failures only', async () => {
  setStorageAdapterForTests(okAdapter());
  process.env.OPENAI_API_KEY = 'sk-invalid';
  globalThis.fetch = (async () => ({ ok: false, status: 401, text: async () => 'invalid api key' })) as any;
  const response = await chat({ json: async () => ({ groupId: GROUP_ID, message: 'list people', traceId: 't-openai' }), headers: { get: () => 's1' } } as any, {} as any);
  assert.equal(response.status, 502);
  assert.equal((response.jsonBody as any).error, 'OPENAI_CALL_FAILED');
  assert.equal((response.jsonBody as any).traceId, 't-openai');
});


test('rule draft defaults missing model personId from request personId', async () => {
  setStorageAdapterForTests(okAdapter());
  process.env.OPENAI_API_KEY = 'sk-test';
  globalThis.fetch = (async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify({ kind: 'proposal', message: 'Drafting.', actions: [{ type: 'add_rule_v2_draft', rules: [{ status: 'unavailable', date: '2026-03-03' }] }] }) } }]
    })
  })) as any;

  const response = await chat({ json: async () => ({ groupId: GROUP_ID, message: 'I am not available March 3 2026.', ruleMode: 'draft', personId: 'P-1', traceId: 't-draft-default-person' }), headers: { get: () => 's1' } } as any, {} as any);
  assert.equal(response.status, 200);
  assert.equal((response.jsonBody as any).draftError, undefined);
  assert.equal(Array.isArray((response.jsonBody as any).draftRules), true);
  assert.equal((response.jsonBody as any).draftRules[0].personId, 'P-1');
});

test('rule draft question returns deterministic draftError metadata', async () => {
  setStorageAdapterForTests(okAdapter());
  process.env.OPENAI_API_KEY = 'sk-test';
  globalThis.fetch = (async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify({ kind: 'question', message: 'What date?', actions: [] }) } }]
    })
  })) as any;

  const response = await chat({ json: async () => ({ groupId: GROUP_ID, message: 'not available', ruleMode: 'draft', personId: 'P-1', traceId: 't-draft-question' }), headers: { get: () => 's1' } } as any, {} as any);
  assert.equal(response.status, 200);
  assert.equal((response.jsonBody as any).draftError?.code, 'MODEL_QUESTION');
  assert.equal((response.jsonBody as any).draftError?.traceId, 't-draft-question');
});

test('rule confirm persists draftedIntervals without OpenAI call', async () => {
  setStorageAdapterForTests(okAdapter());
  let openAiCalled = false;
  globalThis.fetch = (async () => {
    openAiCalled = true;
    throw new Error('OpenAI should not be called for draftedIntervals confirm');
  }) as any;

  const response = await chat({
    json: async () => ({
      groupId: GROUP_ID,
     
      message: 'confirm this',
      ruleMode: 'confirm',
      personId: 'P-1',
      traceId: 't-confirm-drafted',
      draftedIntervals: [{
        personId: 'P-1',
        status: 'unavailable',
        startUtc: '2026-03-03T09:00:00-08:00',
        endUtc: '2026-03-03T11:00:00-08:00',
        promptId: 'prompt-1',
        originalPrompt: 'I am busy tomorrow'
      }]
    }),
    headers: { get: () => 's1' }
  } as any, {} as any);

  assert.equal(openAiCalled, false);
  assert.equal(response.status, 200);
  assert.equal((response.jsonBody as any).assistantText, 'Saved 1 rule(s).');
  assert.equal(Array.isArray((response.jsonBody as any).snapshot?.rules), true);
  assert.equal((response.jsonBody as any).snapshot?.rules.length, 1);
});

test('rule confirm rejects draftedIntervals with mismatched personId', async () => {
  setStorageAdapterForTests(okAdapter());
  const response = await chat({
    json: async () => ({
      groupId: GROUP_ID,
     
      message: 'confirm this',
      ruleMode: 'confirm',
      personId: 'P-1',
      traceId: 't-confirm-mismatch-person',
      draftedIntervals: [{
        personId: 'P-2',
        status: 'unavailable',
        startUtc: '2026-03-03T09:00:00-08:00',
        endUtc: '2026-03-03T11:00:00-08:00'
      }]
    }),
    headers: { get: () => 's1' }
  } as any, {} as any);

  assert.equal(response.status, 400);
  assert.equal((response.jsonBody as any).error, 'invalid_drafted_intervals_person');
});


test('chat updates active person lastSeen on authenticated access', async () => {
  let savedState: any;
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() { return { state: baseState(), etag: 'e1' }; },
    async save(_g, next) { savedState = next; return { state: next as any, etag: 'e2' }; }
  };
  setStorageAdapterForTests(adapter);

  const response = await chat({ json: async () => ({ groupId: GROUP_ID, message: 'help', traceId: 't-last-seen' }), headers: { get: () => 's1' } } as any, {} as any);
  assert.equal(response.status, 200);
  assert.equal(typeof savedState.people[0].lastSeen, 'string');
  assert.equal(Number.isNaN(Date.parse(savedState.people[0].lastSeen)), false);
  assert.equal((response.jsonBody as any).snapshot.people[0].lastSeen, savedState.people[0].lastSeen);
});

test('chat returns CONFIG_MISSING when storage env is missing', async () => {
  setStorageAdapterForTests(null);
  const prevUrl = process.env.STORAGE_ACCOUNT_URL;
  const prevContainer = process.env.STATE_CONTAINER;
  delete process.env.STORAGE_ACCOUNT_URL;
  delete process.env.STATE_CONTAINER;
  const response = await chat({ json: async () => ({ groupId: GROUP_ID, message: 'help', traceId: 't-config' }), headers: { get: () => 's1' } } as any, {} as any);
  assert.equal(response.status, 500);
  assert.equal((response.jsonBody as any).error, 'CONFIG_MISSING');
  assert.deepEqual((response.jsonBody as any).missing, ['STATE_CONTAINER', 'AzureWebJobsStorage|AZURE_STORAGE_ACCOUNT_URL']);
  assert.equal((response.jsonBody as any).traceId, 't-config');
  if (prevUrl) process.env.STORAGE_ACCOUNT_URL = prevUrl; else delete process.env.STORAGE_ACCOUNT_URL;
  if (prevContainer) process.env.STATE_CONTAINER = prevContainer; else delete process.env.STATE_CONTAINER;
});


test('chat records usage meter on successful OpenAI call', async () => {
  setStorageAdapterForTests(okAdapter());
  process.env.OPENAI_API_KEY = 'sk-test';
  const updates: UsageMeterRecord[] = [];
  setUsageMeterStoreForTests({
    trackingAvailable: true,
    async load() { return updates.at(-1) ?? null; },
    async update(updater) {
      const next = updater(updates.at(-1) ?? null);
      updates.push(next);
      return next;
    }
  });

  globalThis.fetch = (async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      usage: { input_tokens: 11, output_tokens: 7 },
      choices: [{ message: { content: JSON.stringify({ kind: 'reply', message: 'done', actions: [{ type: 'help' }] }) } }]
    })
  })) as any;

  const response = await chat({ json: async () => ({ groupId: GROUP_ID, message: 'list people', traceId: 't-usage-ok' }), headers: { get: () => 's1' } } as any, {} as any);
  assert.equal(response.status, 200);
  assert.equal(updates.length > 0, true);
  assert.equal(updates.at(-1)?.requests, 1);
  assert.equal(updates.at(-1)?.tokensIn, 11);
  assert.equal(updates.at(-1)?.tokensOut, 7);
});

test('chat records usage meter error on OpenAI failure', async () => {
  setStorageAdapterForTests(okAdapter());
  process.env.OPENAI_API_KEY = 'sk-invalid';
  const updates: UsageMeterRecord[] = [];
  setUsageMeterStoreForTests({
    trackingAvailable: true,
    async load() { return updates.at(-1) ?? null; },
    async update(updater) {
      const next = updater(updates.at(-1) ?? null);
      updates.push(next);
      return next;
    }
  });

  globalThis.fetch = (async () => ({ ok: false, status: 401, text: async () => 'invalid api key' })) as any;
  const response = await chat({ json: async () => ({ groupId: GROUP_ID, message: 'list people', traceId: 't-usage-err' }), headers: { get: () => 's1' } } as any, {} as any);
  assert.equal(response.status, 502);
  assert.equal(updates.length > 0, true);
  assert.equal(typeof updates.at(-1)?.lastErrorAtISO, 'string');
  assert.match(updates.at(-1)?.lastErrorSummary ?? '', /OpenAI HTTP 401/i);
});
