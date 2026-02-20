import test from 'node:test';
import assert from 'node:assert/strict';
import { groupCreate } from './groupCreate.js';
import { setStorageAdapterForTests } from '../lib/storage/storageFactory.js';
import type { StorageAdapter } from '../lib/storage/storage.js';

const createAdapter = (): StorageAdapter => {
  const states = new Map<string, { state: any; etag: string }>();
  return {
    async initIfMissing(groupId, initialState) {
      if (!states.has(groupId)) states.set(groupId, { state: initialState, etag: '1' });
    },
    async load(groupId) {
      const found = states.get(groupId);
      if (!found) throw new Error('not found');
      return found;
    },
    async save() { throw new Error('not used'); }
  };
};

test.afterEach(() => setStorageAdapterForTests(null));

test('group create seeds creator in people and returns link payload', async () => {
  setStorageAdapterForTests(createAdapter());
  const response = await groupCreate({ json: async () => ({ groupName: 'Family', groupKey: '123456', creatorPhone: '(415) 555-0123', creatorName: 'Joe' }) } as any, { debug: () => {} } as any);
  assert.equal(response.status, 200);
  const body = response.jsonBody as any;
  assert.ok(body.groupId);
  assert.ok(body.creatorPersonId.startsWith('P-'));
  assert.equal(body.groupName, 'Family');
});

test('group create returns CONFIG_MISSING when required vars are absent', async () => {
  setStorageAdapterForTests(null);
  const prevUrl = process.env.STORAGE_ACCOUNT_URL;
  const prevContainer = process.env.STATE_CONTAINER;
  delete process.env.STORAGE_ACCOUNT_URL;
  delete process.env.STATE_CONTAINER;

  const response = await groupCreate({ json: async () => ({ groupName: 'Family', groupKey: '123456', creatorPhone: '(415) 555-0123', creatorName: 'Joe', traceId: 'trace-1' }) } as any, { debug: () => {} } as any);
  assert.equal(response.status, 500);
  assert.equal((response.jsonBody as any).error, 'CONFIG_MISSING');
  assert.deepEqual((response.jsonBody as any).missing, ['STATE_CONTAINER', 'STORAGE_ACCOUNT_URL']);
  assert.equal((response.jsonBody as any).traceId, 'trace-1');

  if (prevUrl) process.env.STORAGE_ACCOUNT_URL = prevUrl; else delete process.env.STORAGE_ACCOUNT_URL;
  if (prevContainer) process.env.STATE_CONTAINER = prevContainer; else delete process.env.STATE_CONTAINER;
});
