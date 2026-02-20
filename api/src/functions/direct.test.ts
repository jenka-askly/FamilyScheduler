import test from 'node:test';
import assert from 'node:assert/strict';
import { direct } from './direct.js';
import { setStorageAdapterForTests } from '../lib/storage/storageFactory.js';
import { ConflictError, GroupNotFoundError, type StorageAdapter } from '../lib/storage/storage.js';

const GROUP_ID = '22222222-2222-4222-8222-222222222222';
const PHONE = '+14155550123';

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

test('direct returns group_not_found when group is missing', async () => {
  const adapter: StorageAdapter = { async initIfMissing() {}, async save() { throw new Error('not used'); }, async load() { throw new GroupNotFoundError(); } };
  setStorageAdapterForTests(adapter);
  const response = await direct({ json: async () => ({ groupId: GROUP_ID, phone: PHONE, action: { type: 'create_blank_appointment' } }) } as any, {} as any);
  assert.equal(response.status, 404);
});

test('direct maps conflict to 409 with traceId', async () => {
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() { return { state: state(), etag: 'etag-1' }; },
    async save() { throw new ConflictError(); }
  };
  setStorageAdapterForTests(adapter);
  const response = await direct({ json: async () => ({ groupId: GROUP_ID, phone: PHONE, action: { type: 'create_blank_appointment' } }) } as any, {} as any);
  assert.equal(response.status, 409);
  assert.ok((response.jsonBody as any).traceId);
});
