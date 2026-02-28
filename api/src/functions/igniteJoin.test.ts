import test from 'node:test';
import assert from 'node:assert/strict';
import { igniteJoin } from './igniteJoin.js';
import { setStorageAdapterForTests } from '../lib/storage/storageFactory.js';
import type { StorageAdapter } from '../lib/storage/storage.js';

test.afterEach(() => setStorageAdapterForTests(null));

test('igniteJoin invite-member unauthenticated returns requiresAuth and no grace session', async () => {
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async save() { throw new Error('save should not be called before auth'); },
    async load() {
      return {
        etag: '1',
        state: {
          schemaVersion: 3,
          groupId: 'g1',
          groupName: 'Group',
          members: [],
          people: [],
          appointments: [],
          rules: [],
          history: [],
          createdAt: '',
          updatedAt: '',
          ignite: {
            sessionId: 's1',
            tokenKind: 'invite-member',
            status: 'OPEN',
            createdAt: '2025-01-01T00:00:00.000Z',
            createdByPersonId: 'p1',
            joinedPersonIds: []
          }
        } as any
      };
    }
  };
  setStorageAdapterForTests(adapter);

  const response = await igniteJoin({
    json: async () => ({ groupId: 'g1', sessionId: 's1' }),
    headers: { get: () => null }
  } as any, {} as any);

  assert.equal(response.status, 200);
  assert.equal((response.jsonBody as any).requiresAuth, true);
  assert.equal((response.jsonBody as any).reason, 'INVITE_REQUIRES_AUTH');
  assert.equal((response.jsonBody as any).sessionId, undefined);
});
