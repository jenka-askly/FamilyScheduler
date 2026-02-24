import test from 'node:test';
import assert from 'node:assert/strict';
import { ignitePhoto } from './ignitePhoto.js';
import { setStorageAdapterForTests } from '../lib/storage/storageFactory.js';
import type { StorageAdapter } from '../lib/storage/storage.js';

const GROUP_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_ID = 'session-1';
const PHONE = '+14155550123';

const context = () => ({ log: () => {} } as any);

test.afterEach(() => setStorageAdapterForTests(null));

test('ignitePhoto accepts image mime and saves by body phone membership', async () => {
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
          people: [{ personId: 'P-1', name: 'Pat', status: 'active', cellE164: PHONE, cellDisplay: '(415) 555-0123' }],
          appointments: [],
          rules: [],
          history: [],
          ignite: { sessionId: SESSION_ID, status: 'OPEN', joinedPersonIds: ['P-1'], createdAt: new Date().toISOString(), createdByPersonId: 'P-1' }
        } as any
      };
    },
    async save(groupId, nextState) {
      return { state: nextState, etag: 'etag-2' };
    },
    async putBinary(_blobName, _bytes, contentType) {
      savedContentType = contentType;
    }
  };
  setStorageAdapterForTests(adapter);
  const response = await ignitePhoto({ json: async () => ({ groupId: GROUP_ID, sessionId: SESSION_ID, phone: PHONE, imageBase64: 'aGVsbG8=', imageMime: 'image/png' }), headers: new Headers() } as any, context());
  assert.equal(response.status, 200);
  assert.equal(savedContentType, 'image/png');
});

test('ignitePhoto accepts phone from x-ms-client-principal when body phone is missing', async () => {
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
          people: [{ personId: 'P-1', name: 'Pat', status: 'active', cellE164: PHONE, cellDisplay: '(415) 555-0123' }],
          appointments: [],
          rules: [],
          history: [],
          ignite: { sessionId: SESSION_ID, status: 'OPEN', joinedPersonIds: ['P-1'], createdAt: new Date().toISOString(), createdByPersonId: 'P-1' }
        } as any
      };
    },
    async save(groupId, nextState) {
      return { state: nextState, etag: 'etag-2' };
    },
    async putBinary() {}
  };
  setStorageAdapterForTests(adapter);
  const principal = Buffer.from(JSON.stringify({ userDetails: PHONE })).toString('base64');
  const response = await ignitePhoto({ json: async () => ({ groupId: GROUP_ID, sessionId: SESSION_ID, imageBase64: 'aGVsbG8=', imageMime: 'image/jpeg' }), headers: new Headers({ 'x-ms-client-principal': principal }) } as any, context());
  assert.equal(response.status, 200);
});
