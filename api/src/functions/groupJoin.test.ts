import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { groupJoin } from './groupJoin.js';
import { setStorageAdapterForTests } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError, type StorageAdapter } from '../lib/storage/storage.js';

test.afterEach(() => setStorageAdapterForTests(null));

test('groupJoin returns ok true for active member', async () => {
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async save() { throw new Error('not used'); },
    async load() {
      return {
        etag: '1',
        state: {
          schemaVersion: 3,
          groupId: 'g1',
          groupName: 'Test Group',
          members: [{ memberId: 'm1', email: 'allowed@example.com', status: 'active' }],
          people: [],
          appointments: [],
          rules: [],
          history: [],
          createdAt: '',
          updatedAt: ''
        } as any
      };
    }
  };
  setStorageAdapterForTests(adapter);
  const response = await groupJoin({ json: async () => ({ groupId: 'g1', email: 'allowed@example.com' }) } as any, {} as any);
  assert.equal(response.status, 200);
  assert.equal((response.jsonBody as any).ok, true);
});

test('groupJoin returns group_not_found when group does not exist', async () => {
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async save() { throw new Error('not used'); },
    async load() { throw new GroupNotFoundError(); }
  };
  setStorageAdapterForTests(adapter);
  const response = await groupJoin({ json: async () => ({ groupId: 'missing', email: 'allowed@example.com' }) } as any, {} as any);
  assert.equal(response.status, 404);
  assert.equal((response.jsonBody as any).error, 'group_not_found');
});

test('groupJoin returns not_allowed for unknown email', async () => {
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async save() { throw new Error('not used'); },
    async load() {
      return {
        etag: '1',
        state: {
          schemaVersion: 3,
          groupId: 'g1',
          groupName: 'Test Group',
          members: [{ memberId: 'm1', email: 'other@example.com', status: 'active' }],
          people: [],
          appointments: [],
          rules: [],
          history: [],
          createdAt: '',
          updatedAt: ''
        } as any
      };
    }
  };
  setStorageAdapterForTests(adapter);
  const response = await groupJoin({ json: async () => ({ groupId: 'g1', email: 'allowed@example.com' }) } as any, {} as any);
  assert.equal(response.status, 403);
  assert.equal((response.jsonBody as any).error, 'not_allowed');
});

test('groupJoin uses session identity email when x-session-id is present', async () => {
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async save() { throw new Error('not used'); },
    async load() {
      return {
        etag: '1',
        state: {
          schemaVersion: 3,
          groupId: 'g1',
          groupName: 'Test Group',
          members: [{ memberId: 'm1', email: 'session@example.com', status: 'active' }],
          people: [],
          appointments: [],
          rules: [],
          history: [],
          createdAt: '',
          updatedAt: ''
        } as any
      };
    },
    async getBinary() {
      const body = JSON.stringify({
        v: 1,
        email: 'session@example.com',
        createdAt: '2025-01-01T00:00:00.000Z',
        expiresAt: '2999-01-01T00:00:00.000Z'
      });
      return { contentType: 'application/json', stream: Readable.from([body]) };
    }
  };
  setStorageAdapterForTests(adapter);
  const response = await groupJoin({
    json: async () => ({ groupId: 'g1' }),
    headers: { get: (name: string) => (name.toLowerCase() === 'x-session-id' ? 'sid-1' : null) }
  } as any, {} as any);
  assert.equal(response.status, 200);
  assert.equal((response.jsonBody as any).ok, true);
});

test('groupJoin returns unauthorized when x-session-id is present but invalid', async () => {
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async save() { throw new Error('not used'); },
    async load() { throw new Error('not used'); },
    async getBinary() {
      const error = Object.assign(new Error('BlobNotFound'), { statusCode: 404, code: 'BlobNotFound' });
      throw error;
    }
  };
  setStorageAdapterForTests(adapter);
  const response = await groupJoin({
    json: async () => ({ groupId: 'g1', email: 'allowed@example.com' }),
    headers: { get: (name: string) => (name.toLowerCase() === 'x-session-id' ? 'sid-missing' : null) }
  } as any, {} as any);
  assert.equal(response.status, 401);
  assert.equal((response.jsonBody as any).error, 'unauthorized');
});
