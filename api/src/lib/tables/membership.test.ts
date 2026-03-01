import test from 'node:test';
import assert from 'node:assert/strict';
import { requireGroupMembership, setMembershipDepsForTests } from './membership.js';

test.afterEach(() => {
  setMembershipDepsForTests(null);
});

test('requireGroupMembership touches lastSeenAtUtc when missing', async () => {
  const writes: string[] = [];
  const member = {
    partitionKey: 'g1',
    rowKey: 'u1',
    userKey: 'u1',
    email: 'alex@example.com',
    status: 'active' as const,
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
  const userGroup = {
    partitionKey: 'u1',
    rowKey: 'g1',
    groupId: 'g1',
    status: 'active' as const,
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
  setMembershipDepsForTests({
    getGroupMemberEntity: async () => member as any,
    getUserGroupEntity: async () => userGroup as any,
    upsertGroupMember: async (entity) => { writes.push(`gm:${entity.lastSeenAtUtc}`); },
    upsertUserGroup: async (entity) => { writes.push(`ug:${entity.lastSeenAtUtc}`); }
  });

  const result = await requireGroupMembership({ groupId: 'g1', email: 'alex@example.com', traceId: 'trace-1', allowStatuses: ['active'] });

  assert.equal(result.ok, true);
  assert.equal(writes.length, 2);
  assert.match(writes[0]!, /^gm:20/);
  assert.match(writes[1]!, /^ug:20/);
});

test('requireGroupMembership does not rewrite lastSeenAtUtc within throttle window', async () => {
  let upserts = 0;
  const nowIso = new Date().toISOString();
  setMembershipDepsForTests({
    getGroupMemberEntity: async () => ({
      partitionKey: 'g1',
      rowKey: 'u1',
      userKey: 'u1',
      email: 'alex@example.com',
      status: 'active',
      updatedAt: nowIso,
      lastSeenAtUtc: nowIso
    } as any),
    getUserGroupEntity: async () => ({
      partitionKey: 'u1',
      rowKey: 'g1',
      groupId: 'g1',
      status: 'active',
      updatedAt: nowIso,
      lastSeenAtUtc: nowIso
    } as any),
    upsertGroupMember: async () => { upserts += 1; },
    upsertUserGroup: async () => { upserts += 1; }
  });

  const result = await requireGroupMembership({ groupId: 'g1', email: 'alex@example.com', traceId: 'trace-2', allowStatuses: ['active'] });

  assert.equal(result.ok, true);
  assert.equal(upserts, 0);
});
