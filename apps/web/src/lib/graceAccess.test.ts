import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { computeIsIgniteGraceActiveForGroup } from './graceAccess.ts';

describe('computeIsIgniteGraceActiveForGroup', () => {
  it('returns true when grace is active and durable session is absent', () => {
    assert.equal(computeIsIgniteGraceActiveForGroup({
      groupId: 'group-1',
      durableSessionId: null,
      igniteGraceSessionId: 'grace-123',
      igniteGraceGroupId: 'group-1'
    }), true);
  });

  it('returns false when durable session exists', () => {
    assert.equal(computeIsIgniteGraceActiveForGroup({
      groupId: 'group-1',
      durableSessionId: 'durable-abc',
      igniteGraceSessionId: 'grace-123',
      igniteGraceGroupId: 'group-1'
    }), false);
  });

  it('returns false when grace belongs to a different group', () => {
    assert.equal(computeIsIgniteGraceActiveForGroup({
      groupId: 'group-1',
      durableSessionId: null,
      igniteGraceSessionId: 'grace-123',
      igniteGraceGroupId: 'group-2'
    }), false);
  });

});
