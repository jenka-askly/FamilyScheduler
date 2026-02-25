import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { igniteMeta } from './igniteMeta.js';
import { setStorageAdapterForTests } from '../lib/storage/storageFactory.js';
import type { AppState } from '../lib/state.js';
import type { StorageAdapter } from '../lib/storage/storage.js';

test.afterEach(() => setStorageAdapterForTests(null));

const GROUP_ID = '11111111-1111-4111-8111-111111111111';
const IGNITE_SESSION_ID = 'ignite-session-1';

const baseState = (now: string): AppState => ({
  schemaVersion: 3,
  groupId: GROUP_ID,
  groupName: 'Test Group',
  createdAt: now,
  updatedAt: now,
  people: [{ personId: 'person-1', name: 'Organizer', email: 'organizer@example.com', status: 'active', createdAt: now, timezone: 'America/Los_Angeles', notes: '', cellE164: '+14155550123', cellDisplay: '(415) 555-0123' }],
  members: [{ memberId: 'person-1', email: 'organizer@example.com', status: 'active', joinedAt: now }],
  appointments: [],
  rules: [],
  history: [],
  ignite: {
    sessionId: IGNITE_SESSION_ID,
    status: 'OPEN',
    createdAt: now,
    createdByPersonId: 'person-1',
    graceSeconds: 30,
    joinedPersonIds: [],
    photoUpdatedAtByPersonId: {}
  }
});

test('igniteMeta returns unauthorized for unauthenticated requests', async () => {
  const now = new Date().toISOString();
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async save() { throw new Error('not used'); },
    async load() { return { etag: '1', state: baseState(now) }; },
    async getBinary() { throw Object.assign(new Error('missing'), { statusCode: 404, code: 'BlobNotFound' }); }
  };
  setStorageAdapterForTests(adapter);

  const response = await igniteMeta({
    method: 'POST',
    url: `http://localhost/api/ignite/meta`,
    headers: new Headers(),
    json: async () => ({ groupId: GROUP_ID, sessionId: IGNITE_SESSION_ID, traceId: 'trace-1' })
  } as any, {} as any);

  assert.equal(response.status, 401);
  assert.equal((response.jsonBody as any).error, 'unauthorized');
});

test('igniteMeta accepts x-session-id authentication without phone', async () => {
  const now = new Date().toISOString();
  const sessionId = 'session-123';
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async save() { throw new Error('not used'); },
    async load() { return { etag: '1', state: baseState(now) }; },
    async getBinary(name) {
      if (!name.endsWith(`/${sessionId}.json`)) throw Object.assign(new Error('missing'), { statusCode: 404, code: 'BlobNotFound' });
      const expiresAt = new Date(Date.now() + 60_000).toISOString();
      const payload = JSON.stringify({ v: 1, email: 'organizer@example.com', kind: 'full', createdAt: now, expiresAt });
      return { contentType: 'application/json', stream: Readable.from([payload]) };
    }
  };
  setStorageAdapterForTests(adapter);

  const response = await igniteMeta({
    method: 'POST',
    url: 'http://localhost/api/ignite/meta',
    headers: new Headers({ 'x-session-id': sessionId }),
    json: async () => ({ groupId: GROUP_ID, sessionId: IGNITE_SESSION_ID, traceId: 'trace-2' })
  } as any, {} as any);

  assert.equal(response.status, 200);
  assert.equal((response.jsonBody as any).ok, true);
  assert.equal((response.jsonBody as any).status, 'OPEN');
  assert.equal((response.jsonBody as any).joinedCount, 1);
});

test('igniteMeta joinedCount includes organizer and de-duplicates against joined ids', async () => {
  const now = new Date().toISOString();
  const sessionId = 'session-joined-count';
  const adapter: StorageAdapter = {
    async initIfMissing() {},
    async save() { throw new Error('not used'); },
    async load() {
      const state = baseState(now);
      if (state.ignite) state.ignite.joinedPersonIds = ['person-1', 'person-2'];
      state.people.push({ personId: 'person-2', name: 'Guest', email: 'guest@example.com', status: 'active', createdAt: now, timezone: 'America/Los_Angeles', notes: '', cellE164: '', cellDisplay: '' });
      return { etag: '1', state };
    },
    async getBinary(name) {
      if (!name.endsWith(`/${sessionId}.json`)) throw Object.assign(new Error('missing'), { statusCode: 404, code: 'BlobNotFound' });
      const expiresAt = new Date(Date.now() + 60_000).toISOString();
      const payload = JSON.stringify({ v: 1, email: 'organizer@example.com', kind: 'full', createdAt: now, expiresAt });
      return { contentType: 'application/json', stream: Readable.from([payload]) };
    }
  };
  setStorageAdapterForTests(adapter);

  const response = await igniteMeta({
    method: 'POST',
    url: 'http://localhost/api/ignite/meta',
    headers: new Headers({ 'x-session-id': sessionId }),
    json: async () => ({ groupId: GROUP_ID, sessionId: IGNITE_SESSION_ID, traceId: 'trace-3' })
  } as any, {} as any);

  assert.equal(response.status, 200);
  assert.equal((response.jsonBody as any).joinedCount, 2);
});
