import test from 'node:test';
import assert from 'node:assert/strict';
import { groupRestore, setGroupRestoreDepsForTests } from './groupRestore.js';
import type { GroupEntity } from '../lib/tables/entities.js';

const GROUP_ID = '11111111-1111-4111-8111-111111111111';
const EMAIL = 'alex@example.com';

const makeGroup = (overrides: Partial<GroupEntity> = {}): GroupEntity => ({
  partitionKey: 'group',
  rowKey: GROUP_ID,
  groupId: GROUP_ID,
  groupName: 'Family',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdByUserKey: 'user:alex@example.com',
  isDeleted: true,
  ...overrides
});

const makeRequest = (body: Record<string, unknown> = {}) => ({
  json: async () => body,
  headers: new Headers({ 'x-session-id': 'session-restore' })
} as any);

test.afterEach(() => {
  setGroupRestoreDepsForTests(null);
});

test('groupRestore restores deleted group', async () => {
  let restoredGroupId: string | null = null;
  setGroupRestoreDepsForTests({
    requireSessionEmail: async () => ({ ok: true, email: EMAIL, sessionId: 'sid' }),
    ensureTablesReady: async () => {},
    requireGroupMembership: async () => ({ ok: true as const, member: { status: 'active' } as any, userKey: 'u1', normalizedEmail: EMAIL }),
    getGroupEntity: async () => makeGroup(),
    restoreGroupById: async (group) => { restoredGroupId = group.groupId; }
  });

  const response = await groupRestore(makeRequest({ groupId: GROUP_ID, traceId: 'trace-restore-1' }), {} as any);

  assert.equal(response.status, 200);
  assert.equal((response.jsonBody as any).ok, true);
  assert.equal((response.jsonBody as any).traceId, 'trace-restore-1');
  assert.equal(restoredGroupId, GROUP_ID);
});

test('groupRestore returns ok true when group is already active', async () => {
  let restoreCalled = false;
  setGroupRestoreDepsForTests({
    requireSessionEmail: async () => ({ ok: true, email: EMAIL, sessionId: 'sid' }),
    ensureTablesReady: async () => {},
    requireGroupMembership: async () => ({ ok: true as const, member: { status: 'active' } as any, userKey: 'u1', normalizedEmail: EMAIL }),
    getGroupEntity: async () => makeGroup({ isDeleted: false }),
    restoreGroupById: async () => { restoreCalled = true; }
  });

  const response = await groupRestore(makeRequest({ groupId: GROUP_ID, traceId: 'trace-restore-2' }), {} as any);

  assert.equal(response.status, 200);
  assert.equal((response.jsonBody as any).ok, true);
  assert.equal((response.jsonBody as any).message, 'Already active');
  assert.equal(restoreCalled, false);
});

test('groupRestore returns unauthorized when session is missing', async () => {
  setGroupRestoreDepsForTests({
    requireSessionEmail: async () => ({ ok: false, response: { status: 401, jsonBody: { error: 'unauthorized', traceId: 'trace-restore-3' } } })
  });

  const response = await groupRestore(makeRequest({ groupId: GROUP_ID, traceId: 'trace-restore-3' }), {} as any);

  assert.equal(response.status, 401);
  assert.equal((response.jsonBody as any).error, 'unauthorized');
});

test('groupRestore returns forbidden for non-active membership', async () => {
  setGroupRestoreDepsForTests({
    requireSessionEmail: async () => ({ ok: true, email: EMAIL, sessionId: 'sid' }),
    ensureTablesReady: async () => {},
    requireGroupMembership: async ({ traceId }) => ({ ok: false as const, response: { status: 403, jsonBody: { error: 'not_allowed', traceId } } })
  });

  const response = await groupRestore(makeRequest({ groupId: GROUP_ID, traceId: 'trace-restore-4' }), {} as any);

  assert.equal(response.status, 403);
  assert.equal((response.jsonBody as any).error, 'not_allowed');
});
