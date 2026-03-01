import test from 'node:test';
import assert from 'node:assert/strict';
import { groupMembers, setGroupMembersDepsForTests } from './groupMembers.js';

test.afterEach(() => {
  setGroupMembersDepsForTests(null);
});

const makeRequest = (groupId: string) => ({
  url: `https://example.test/api/group/members?groupId=${encodeURIComponent(groupId)}`,
  headers: new Headers({ 'x-session-id': 'sid-1' })
} as any);

test('groupMembers includes lastSeenAtUtc in roster payload', async () => {
  setGroupMembersDepsForTests({
    ensureTablesReady: async () => {},
    requireSessionEmail: async () => ({ ok: true, email: 'alex@example.com', sessionId: 'sid-1' }),
    requireGroupMembership: async () => ({ ok: true as const, member: { status: 'active' } as any, userKey: 'u1', normalizedEmail: 'alex@example.com' }),
    listGroupMembers: async () => ([
      {
        partitionKey: 'g1',
        rowKey: 'u1',
        userKey: 'u1',
        email: 'alex@example.com',
        status: 'active',
        updatedAt: '2026-01-01T00:00:00.000Z',
        lastSeenAtUtc: '2026-01-02T01:02:03.000Z'
      }
    ] as any),
    getUserProfileEntity: async () => ({ displayName: 'Alex' } as any)
  });

  const response = await groupMembers(makeRequest('g1'), {} as any);

  assert.equal(response.status, 200);
  const body = response.jsonBody as any;
  assert.equal(body.ok, true);
  assert.equal(body.members[0].lastSeenAtUtc, '2026-01-02T01:02:03.000Z');
});
