import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { groupClaim } from './groupClaim.js';
import { setStorageAdapterForTests } from '../lib/storage/storageFactory.js';
import type { StorageAdapter } from '../lib/storage/storage.js';

test.afterEach(() => setStorageAdapterForTests(null));

test('groupClaim rejects grace scope mismatch before table writes', async () => {
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async save() { throw new Error('not used'); },
    async load() { throw new Error('not used'); },
    async getBinary(path: string) {
      if (path.includes('dsid-1')) {
        const body = JSON.stringify({
          v: 1,
          email: 'member@example.com',
          kind: 'full',
          createdAt: '2025-01-01T00:00:00.000Z',
          expiresAt: '2999-01-01T00:00:00.000Z'
        });
        return { contentType: 'application/json', stream: Readable.from([body]) };
      }
      const grace = JSON.stringify({
        v: 1,
        email: 'guest@example.com',
        kind: 'igniteGrace',
        scopeGroupId: 'other-group',
        createdAt: '2025-01-01T00:00:00.000Z',
        expiresAt: '2999-01-01T00:00:00.000Z'
      });
      return { contentType: 'application/json', stream: Readable.from([grace]) };
    }
  };
  setStorageAdapterForTests(adapter);

  const response = await groupClaim({
    json: async () => ({ groupId: 'g1', graceSessionId: 'grace-1' }),
    headers: { get: (name: string) => (name.toLowerCase() === 'x-session-id' ? 'dsid-1' : null) }
  } as any, {} as any);

  assert.equal(response.status, 403);
  assert.equal((response.jsonBody as any).error, 'grace_session_scope_mismatch');
});
