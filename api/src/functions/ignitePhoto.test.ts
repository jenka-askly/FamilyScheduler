import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { ignitePhoto } from './ignitePhoto.js';
import { setStorageAdapterForTests } from '../lib/storage/storageFactory.js';
import type { StorageAdapter } from '../lib/storage/storage.js';

const GROUP_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_ID = 'ignite-session-1';
const SESSION_TOKEN = 'session-token-1';
const EMAIL = 'pat@example.com';

const context = () => ({ log: () => {} } as any);

test.afterEach(() => setStorageAdapterForTests(null));

const sessionPayload = () => {
  const now = new Date().toISOString();
  return JSON.stringify({ v: 1, email: EMAIL, kind: 'full', createdAt: now, expiresAt: new Date(Date.now() + 60_000).toISOString() });
};

test('ignitePhoto accepts image mime and saves with session membership', async () => {
  let savedContentType = '';
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
          people: [{ personId: 'P-1', name: 'Pat', email: EMAIL, status: 'active', cellE164: '', cellDisplay: '' }],
          members: [{ memberId: 'P-1', email: EMAIL, status: 'active', joinedAt: new Date().toISOString() }],
          appointments: [],
          rules: [],
          history: [],
          ignite: { sessionId: SESSION_ID, status: 'OPEN', joinedPersonIds: ['P-1'], createdAt: new Date().toISOString(), createdByPersonId: 'P-1' }
        } as any
      };
    },
    async save(_groupId, nextState) {
      return { state: nextState, etag: 'etag-2' };
    },
    async putBinary(_blobName, _bytes, contentType) {
      savedContentType = contentType;
    },
    async getBinary(name) {
      if (!name.endsWith(`/${SESSION_TOKEN}.json`)) throw Object.assign(new Error('missing'), { statusCode: 404, code: 'BlobNotFound' });
      return { contentType: 'application/json', stream: Readable.from([sessionPayload()]) };
    }
  };
  setStorageAdapterForTests(adapter);
  const response = await ignitePhoto({
    json: async () => ({ groupId: GROUP_ID, sessionId: SESSION_ID, imageBase64: 'aGVsbG8=', imageMime: 'image/png' }),
    headers: new Headers({ 'x-session-id': SESSION_TOKEN })
  } as any, context());
  assert.equal(response.status, 200);
  assert.equal(savedContentType, 'image/png');
});
