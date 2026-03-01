import test from 'node:test';
import assert from 'node:assert/strict';
import { groupMemberProfilePut, setGroupMemberProfilePutDepsForTests } from './groupMemberProfilePut.js';

const GROUP_ID = 'g-123';
const CALLER_EMAIL = 'caller@example.com';

const makeRequest = (body: Record<string, unknown>) => ({
  json: async () => body,
  headers: new Headers({ 'x-session-id': 'session-member-profile' })
} as any);

test.afterEach(() => {
  setGroupMemberProfilePutDepsForTests(null);
});

test('groupMemberProfilePut rejects caller without active membership', async () => {
  setGroupMemberProfilePutDepsForTests({
    ensureTablesReady: async () => {},
    requireSessionFromRequest: async () => ({ email: CALLER_EMAIL, kind: 'full' } as any),
    requireGroupMembership: async ({ traceId }) => ({ ok: false as const, response: { status: 403, jsonBody: { error: 'not_allowed', traceId } } })
  });

  const response = await groupMemberProfilePut(makeRequest({ groupId: GROUP_ID, userKey: 'user:target@example.com', displayName: 'Target Name' }), {} as any);

  assert.equal(response.status, 403);
  assert.equal((response.jsonBody as any).error, 'not_allowed');
});

test('groupMemberProfilePut rejects target userKey not in group', async () => {
  setGroupMemberProfilePutDepsForTests({
    ensureTablesReady: async () => {},
    requireSessionFromRequest: async () => ({ email: CALLER_EMAIL, kind: 'full' } as any),
    requireGroupMembership: async () => ({ ok: true as const, member: { status: 'active' } as any, userKey: 'user:caller@example.com', normalizedEmail: CALLER_EMAIL }),
    getGroupMemberEntity: async () => null
  });

  const response = await groupMemberProfilePut(makeRequest({ groupId: GROUP_ID, userKey: 'user:missing@example.com', displayName: 'Missing Member' }), {} as any);

  assert.equal(response.status, 404);
  assert.equal((response.jsonBody as any).error, 'member_not_found');
});

test('groupMemberProfilePut updates profile displayName for active or invited member', async () => {
  let saved: any = null;
  setGroupMemberProfilePutDepsForTests({
    ensureTablesReady: async () => {},
    requireSessionFromRequest: async () => ({ email: CALLER_EMAIL, kind: 'full' } as any),
    requireGroupMembership: async () => ({ ok: true as const, member: { status: 'active' } as any, userKey: 'user:caller@example.com', normalizedEmail: CALLER_EMAIL }),
    getGroupMemberEntity: async () => ({ partitionKey: GROUP_ID, rowKey: 'user:target@example.com', userKey: 'user:target@example.com', email: 'target@example.com', status: 'invited', updatedAt: new Date().toISOString() }),
    upsertUserProfile: async (params) => { saved = params; }
  });

  const response = await groupMemberProfilePut(makeRequest({ groupId: GROUP_ID, userKey: 'user:target@example.com', displayName: '  New   Display  Name ' }), { log: () => undefined } as any);

  assert.equal(response.status, 200);
  assert.equal((response.jsonBody as any).ok, true);
  assert.equal(saved.userKey, 'user:target@example.com');
  assert.equal(saved.email, 'target@example.com');
  assert.equal(saved.displayName, 'New Display Name');
});
