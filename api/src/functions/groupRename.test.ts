import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { groupRename } from './groupRename.js';
import { setStorageAdapterForTests } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError, type StorageAdapter } from '../lib/storage/storage.js';

const GROUP_ID = '11111111-1111-4111-8111-111111111111';
const EMAIL = 'alex@example.com';
const SESSION_ID = 'session-rename';

test.afterEach(() => setStorageAdapterForTests(null));

const sessionBlob = () => {
  const now = new Date().toISOString();
  return JSON.stringify({ v: 1, email: EMAIL, kind: 'full', createdAt: now, expiresAt: new Date(Date.now() + 60_000).toISOString() });
};

const makeRequest = (body: Record<string, unknown>) => ({
  json: async () => body,
  headers: new Headers({ 'x-session-id': SESSION_ID })
} as any);

test('groupRename renames group and saves updated state', async () => {
  let saved: { groupId: string; state: any; etag: string } | null = null;
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() {
      return {
        etag: 'v1',
        state: {
          schemaVersion: 3,
          groupId: GROUP_ID,
          groupName: 'Old Name',
          people: [{ personId: 'P-1', name: 'Alex', email: EMAIL, status: 'active' }],
          members: [{ memberId: 'P-1', email: EMAIL, status: 'active', joinedAt: '' }],
          appointments: [],
          rules: [],
          history: [],
          createdAt: '',
          updatedAt: ''
        } as any
      };
    },
    async save(groupId, state, etag) {
      saved = { groupId, state, etag };
      return { state, etag: 'v2' };
    },
    async getBinary(name) {
      if (!name.endsWith(`/${SESSION_ID}.json`)) throw Object.assign(new Error('missing'), { statusCode: 404, code: 'BlobNotFound' });
      return { contentType: 'application/json', stream: Readable.from([sessionBlob()]) };
    }
  };

  setStorageAdapterForTests(adapter);
  const response = await groupRename(makeRequest({ groupId: GROUP_ID, groupName: '   New   Group   Name  ', traceId: 'trace-1' }), {} as any);

  assert.equal(response.status, 200);
  const body = response.jsonBody as any;
  assert.equal(body.ok, true);
  assert.equal(body.groupName, 'New Group Name');
  assert.equal(body.traceId, 'trace-1');
  if (!saved) throw new Error('save not called');
  const savedResult = saved as { groupId: string; state: any; etag: string };
  assert.equal(savedResult.groupId, GROUP_ID);
  assert.equal(savedResult.etag, 'v1');
  assert.equal(savedResult.state.groupName, 'New Group Name');
});

test('groupRename returns 400 for missing or invalid groupName', async () => {
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() { throw new Error('not used'); },
    async save() { throw new Error('not used'); },
    async getBinary(name) {
      if (!name.endsWith(`/${SESSION_ID}.json`)) throw Object.assign(new Error('missing'), { statusCode: 404, code: 'BlobNotFound' });
      return { contentType: 'application/json', stream: Readable.from([sessionBlob()]) };
    }
  };

  setStorageAdapterForTests(adapter);
  const missing = await groupRename(makeRequest({ groupId: GROUP_ID, groupName: '   ', traceId: 'trace-2' }), {} as any);
  assert.equal(missing.status, 400);
  assert.equal((missing.jsonBody as any).traceId, 'trace-2');

  const tooLong = await groupRename(makeRequest({ groupId: GROUP_ID, groupName: 'a'.repeat(61), traceId: 'trace-3' }), {} as any);
  assert.equal(tooLong.status, 400);
  assert.equal((tooLong.jsonBody as any).traceId, 'trace-3');
});

test('groupRename returns 403 when caller email is not in group', async () => {
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() {
      return {
        etag: 'v1',
        state: {
          schemaVersion: 3,
          groupId: GROUP_ID,
          groupName: 'Group',
          people: [{ personId: 'P-1', name: 'Alex', email: 'someoneelse@example.com', status: 'active' }],
          members: [{ memberId: 'P-1', email: 'someoneelse@example.com', status: 'active', joinedAt: '' }],
          appointments: [],
          rules: [],
          history: [],
          createdAt: '',
          updatedAt: ''
        } as any
      };
    },
    async save() { throw new Error('not used'); },
    async getBinary(name) {
      if (!name.endsWith(`/${SESSION_ID}.json`)) throw Object.assign(new Error('missing'), { statusCode: 404, code: 'BlobNotFound' });
      return { contentType: 'application/json', stream: Readable.from([sessionBlob()]) };
    }
  };

  setStorageAdapterForTests(adapter);
  const response = await groupRename(makeRequest({ groupId: GROUP_ID, groupName: 'New Name', traceId: 'trace-4' }), {} as any);
  assert.equal(response.status, 403);
  assert.equal((response.jsonBody as any).error, 'not_allowed');
  assert.equal((response.jsonBody as any).traceId, 'trace-4');
});

test('groupRename returns 404 when group is missing', async () => {
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() { throw new GroupNotFoundError(); },
    async save() { throw new Error('not used'); },
    async getBinary(name) {
      if (!name.endsWith(`/${SESSION_ID}.json`)) throw Object.assign(new Error('missing'), { statusCode: 404, code: 'BlobNotFound' });
      return { contentType: 'application/json', stream: Readable.from([sessionBlob()]) };
    }
  };

  setStorageAdapterForTests(adapter);
  const response = await groupRename(makeRequest({ groupId: GROUP_ID, groupName: 'New Name', traceId: 'trace-5' }), {} as any);
  assert.equal(response.status, 404);
  assert.equal((response.jsonBody as any).error, 'group_not_found');
  assert.equal((response.jsonBody as any).traceId, 'trace-5');
});
