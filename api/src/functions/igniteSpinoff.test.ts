import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { igniteSpinoff } from './igniteSpinoff.js';
import { setStorageAdapterForTests } from '../lib/storage/storageFactory.js';
import type { AppState } from '../lib/state.js';
import type { StorageAdapter } from '../lib/storage/storage.js';

const SOURCE_GROUP_ID = 'source-group-1';

test.afterEach(() => setStorageAdapterForTests(null));

test('igniteSpinoff seeds organizer person with source name and email', async () => {
  const groups = new Map<string, { state: AppState; etag: string }>();
  const now = new Date().toISOString();
  groups.set(SOURCE_GROUP_ID, {
    etag: '1',
    state: {
      schemaVersion: 3,
      groupId: SOURCE_GROUP_ID,
      groupName: 'Source Group',
      createdAt: now,
      updatedAt: now,
      people: [{ personId: 'P-ORIGIN', name: 'Alex Organizer', email: 'alex@example.com', status: 'active', createdAt: now, timezone: 'America/New_York', notes: 'Lead', cellE164: '+14155550123', cellDisplay: '(415) 555-0123' }],
      members: [],
      appointments: [],
      rules: [],
      history: []
    }
  });

  const adapter: StorageAdapter = {
    async initIfMissing(groupId, initialState) {
      if (!initialState) throw new Error('expected initial state');
      if (!groups.has(groupId)) groups.set(groupId, { state: initialState, etag: '1' });
    },
    async load(groupId) {
      const found = groups.get(groupId);
      if (!found) throw new Error('group not found');
      return found;
    },
    async save(groupId, nextState) {
      groups.set(groupId, { state: nextState, etag: '2' });
      return { state: nextState, etag: '2' };
    },
    async getBinary() {
      const expiresAt = new Date(Date.now() + 60_000).toISOString();
      const payload = JSON.stringify({ v: 1, email: 'alex@example.com', kind: 'full', createdAt: now, expiresAt });
      return { contentType: 'application/json', stream: Readable.from([payload]) };
    }
  };

  setStorageAdapterForTests(adapter);
  const response = await igniteSpinoff({
    json: async () => ({ sourceGroupId: SOURCE_GROUP_ID, groupName: 'Breakout' }),
    headers: new Headers({ 'x-session-id': 'session-1' })
  } as any, {} as any);

  assert.equal(response.status, 200);
  const body = response.jsonBody as any;
  assert.equal(body.ok, true);
  assert.equal('sessionId' in body, false);

  assert.equal(body.sessionId, undefined);
  const breakout = groups.get(body.newGroupId);
  assert.ok(breakout);
  assert.equal(breakout?.state.people.length, 1);
  assert.equal(breakout?.state.people[0]?.name, 'Alex Organizer');
  assert.equal(breakout?.state.people[0]?.email, 'alex@example.com');
  assert.equal(breakout?.state.people[0]?.timezone, 'America/New_York');
});
