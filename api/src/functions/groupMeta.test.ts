import test from 'node:test';
import assert from 'node:assert/strict';
import { groupMeta } from './groupMeta.js';
import { setStorageAdapterForTests } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError, type StorageAdapter } from '../lib/storage/storage.js';

test.afterEach(() => setStorageAdapterForTests(null));

test('groupMeta returns public group metadata', async () => {
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async save() { throw new Error('not used'); },
    async load() {
      return { etag: '1', state: { schemaVersion: 3, groupId: 'g1', groupName: 'Meta Test Group', people: [], appointments: [], rules: [], history: [], createdAt: '', updatedAt: '' } as any };
    }
  };
  setStorageAdapterForTests(adapter);
  const response = await groupMeta({ url: 'http://localhost/api/group/meta?groupId=g1' } as any, {} as any);
  assert.equal(response.status, 200);
  assert.equal((response.jsonBody as any).groupName, 'Meta Test Group');
});

test('groupMeta returns group_not_found for unknown group', async () => {
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async save() { throw new Error('not used'); },
    async load() { throw new GroupNotFoundError(); }
  };
  setStorageAdapterForTests(adapter);
  const response = await groupMeta({ url: 'http://localhost/api/group/meta?groupId=missing' } as any, {} as any);
  assert.equal(response.status, 404);
  assert.equal((response.jsonBody as any).error, 'group_not_found');
  assert.ok((response.jsonBody as any).traceId);
});
