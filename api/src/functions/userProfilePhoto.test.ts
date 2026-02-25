import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import type { StorageAdapter } from '../lib/storage/storage.js';
import { setStorageAdapterForTests } from '../lib/storage/storageFactory.js';
import { userProfilePhotoSet } from './userProfilePhotoSet.js';
import { userProfilePhotoMeta } from './userProfilePhotoMeta.js';

const GROUP_ID = '33333333-3333-4333-8333-333333333333';
const SESSION_TOKEN = 'session-token-profile';
const EMAIL = 'alex@example.com';

const context = () => ({ log: () => {} } as any);

const sessionPayload = () => {
  const now = new Date().toISOString();
  return JSON.stringify({ v: 1, email: EMAIL, kind: 'full', createdAt: now, expiresAt: new Date(Date.now() + 60_000).toISOString() });
};

test.afterEach(() => setStorageAdapterForTests(null));

test('user profile photo set + metadata round-trip for authenticated member', async () => {
  const binaries = new Map<string, { contentType: string; body: Buffer }>();

  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() {
      return {
        etag: 'etag-1',
        state: {
          groupId: GROUP_ID,
          schemaVersion: 3,
          groupName: 'Test',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          people: [{ personId: 'P-1', name: 'Alex', email: EMAIL, status: 'active' }],
          members: [{ memberId: 'P-1', email: EMAIL, status: 'active', joinedAt: new Date().toISOString() }],
          appointments: [],
          rules: [],
          history: []
        } as any
      };
    },
    async save(_groupId, nextState) {
      return { state: nextState, etag: 'etag-2' };
    },
    async putBinary(blobName, bytes, contentType) {
      binaries.set(blobName, { contentType, body: Buffer.from(bytes) });
    },
    async getBinary(blobName) {
      if (blobName.endsWith(`/${SESSION_TOKEN}.json`)) return { contentType: 'application/json', stream: Readable.from([sessionPayload()]) };
      const found = binaries.get(blobName);
      if (!found) throw Object.assign(new Error('BlobNotFound'), { statusCode: 404, code: 'BlobNotFound' });
      return { contentType: found.contentType, stream: Readable.from([found.body]) };
    }
  };

  setStorageAdapterForTests(adapter);

  const setResponse = await userProfilePhotoSet({
    json: async () => ({ groupId: GROUP_ID, imageBase64: 'aGVsbG8=', imageMime: 'image/jpeg' }),
    headers: new Headers({ 'x-session-id': SESSION_TOKEN })
  } as any, context());
  assert.equal(setResponse.status, 200);

  const metaResponse = await userProfilePhotoMeta({
    url: `http://localhost/api/user/profile-photo?groupId=${GROUP_ID}`,
    headers: new Headers({ 'x-session-id': SESSION_TOKEN })
  } as any, context());
  assert.equal(metaResponse.status, 200);
  const jsonBody = metaResponse.jsonBody as { ok?: boolean; hasPhoto?: boolean; updatedAt?: string };
  assert.equal(jsonBody.ok, true);
  assert.equal(jsonBody.hasPhoto, true);
  assert.equal(typeof jsonBody.updatedAt, 'string');
  assert.ok((jsonBody.updatedAt ?? '').length > 5);
});
