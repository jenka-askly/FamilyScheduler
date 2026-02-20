import test from 'node:test';
import assert from 'node:assert/strict';
import { chat } from './chat.js';
import { setStorageAdapterForTests } from '../lib/storage/storageFactory.js';
import { ConflictError, GroupNotFoundError, type StorageAdapter } from '../lib/storage/storage.js';

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
  globalThis.fetch = originalFetch;
});

test('chat returns group_not_found when group is missing', async () => {
  const adapter: StorageAdapter = { async initIfMissing() {}, async save() { throw new Error('not used'); }, async load() { throw new GroupNotFoundError(); } };
  setStorageAdapterForTests(adapter);
  const response = await chat({ json: async () => ({ groupId: GROUP_ID, phone: PHONE, message: 'help', traceId: 't1' }), headers: { get: () => 's1' } } as any, {} as any);
  assert.equal(response.status, 404);
  assert.equal((response.jsonBody as any).traceId, 't1');
});

test('chat returns 502 for OpenAI failures only', async () => {
  setStorageAdapterForTests(okAdapter());
  process.env.OPENAI_API_KEY = 'sk-invalid';
  globalThis.fetch = (async () => ({ ok: false, status: 401, text: async () => 'invalid api key' })) as any;
  const response = await chat({ json: async () => ({ groupId: GROUP_ID, phone: PHONE, message: 'list people', traceId: 't-openai' }), headers: { get: () => 's1' } } as any, {} as any);
  assert.equal(response.status, 502);
  assert.equal((response.jsonBody as any).error, 'OPENAI_CALL_FAILED');
  assert.equal((response.jsonBody as any).traceId, 't-openai');
});

test('chat returns CONFIG_MISSING when storage env is missing', async () => {
  setStorageAdapterForTests(null);
  const prevUrl = process.env.STORAGE_ACCOUNT_URL;
  const prevContainer = process.env.STATE_CONTAINER;
  delete process.env.STORAGE_ACCOUNT_URL;
  delete process.env.STATE_CONTAINER;
  const response = await chat({ json: async () => ({ groupId: GROUP_ID, phone: PHONE, message: 'help', traceId: 't-config' }), headers: { get: () => 's1' } } as any, {} as any);
  assert.equal(response.status, 500);
  assert.equal((response.jsonBody as any).error, 'CONFIG_MISSING');
  assert.deepEqual((response.jsonBody as any).missing, ['STATE_CONTAINER', 'STORAGE_ACCOUNT_URL']);
  assert.equal((response.jsonBody as any).traceId, 't-config');
  if (prevUrl) process.env.STORAGE_ACCOUNT_URL = prevUrl; else delete process.env.STORAGE_ACCOUNT_URL;
  if (prevContainer) process.env.STATE_CONTAINER = prevContainer; else delete process.env.STATE_CONTAINER;
});
