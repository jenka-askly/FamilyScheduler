import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import type { StorageAdapter } from '../lib/storage/storage.js';
import { setStorageAdapterForTests } from '../lib/storage/storageFactory.js';
import { userProfilePhotoSet } from './userProfilePhotoSet.js';
import { userProfilePhotoGet } from './userProfilePhotoGet.js';
import { userProfilePhotoBlobKey } from '../lib/userProfilePhoto.js';

const SESSION_TOKEN = 'session-token-profile';
const EMAIL = 'alex@example.com';

const context = () => ({ log: () => {} } as any);

const sessionPayload = () => {
  const now = new Date().toISOString();
  return JSON.stringify({ v: 1, email: EMAIL, kind: 'full', createdAt: now, expiresAt: new Date(Date.now() + 60_000).toISOString() });
};

test.afterEach(() => setStorageAdapterForTests(null));

const readHeader = (headers: unknown, key: string): string | undefined => {
  if (!headers) return undefined;
  if (Array.isArray(headers)) {
    const match = headers.find(([headerKey]) => headerKey.toLowerCase() === key.toLowerCase());
    return match?.[1];
  }
  if (headers instanceof Headers) return headers.get(key) ?? undefined;
  const record = headers as Record<string, string | undefined>;
  const exact = record[key];
  if (exact != null) return exact;
  const lowerKey = key.toLowerCase();
  return Object.entries(record).find(([headerKey]) => headerKey.toLowerCase() === lowerKey)?.[1];
};

test('user profile photo PUT+GET round-trip for authenticated session', async () => {
  const binaries = new Map<string, { contentType: string; body: Buffer }>();

  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() { throw new Error('not_used'); },
    async save(_groupId, nextState) { return { state: nextState, etag: 'etag-2' }; },
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

  const formData = new FormData();
  formData.append('file', new File([Buffer.from('hello')], 'profile.jpg', { type: 'image/jpeg' }));

  const setResponse = await userProfilePhotoSet({
    url: 'http://localhost/api/user/profile-photo',
    formData: async () => formData,
    headers: new Headers({ 'x-session-id': SESSION_TOKEN })
  } as any, context());
  assert.equal(setResponse.status, 200);

  const getResponse = await userProfilePhotoGet({
    url: 'http://localhost/api/user/profile-photo',
    headers: new Headers({ 'x-session-id': SESSION_TOKEN })
  } as any, context());
  assert.equal(getResponse.status, 200);
  assert.equal(readHeader(getResponse.headers, 'Content-Type'), 'image/jpeg');
  assert.equal(readHeader(getResponse.headers, 'Cache-Control'), 'public, max-age=31536000');
  assert.ok(binaries.has(userProfilePhotoBlobKey(EMAIL)));
});

test('user profile photo GET returns 404 when missing', async () => {
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async load() { throw new Error('not_used'); },
    async save(_groupId, nextState) { return { state: nextState, etag: 'etag-2' }; },
    async getBinary(blobName) {
      if (blobName.endsWith(`/${SESSION_TOKEN}.json`)) return { contentType: 'application/json', stream: Readable.from([sessionPayload()]) };
      throw Object.assign(new Error('BlobNotFound'), { statusCode: 404, code: 'BlobNotFound' });
    }
  };

  setStorageAdapterForTests(adapter);

  const getResponse = await userProfilePhotoGet({
    url: 'http://localhost/api/user/profile-photo',
    headers: new Headers({ 'x-session-id': SESSION_TOKEN })
  } as any, context());
  assert.equal(getResponse.status, 404);
});
