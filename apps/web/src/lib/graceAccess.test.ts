import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { computeIsIgniteGraceActiveForGroup } from './graceAccess.ts';

describe('isIgniteGraceGuestForGroup semantics', () => {
  it('returns false when durable session exists', () => {
    assert.equal(computeIsIgniteGraceActiveForGroup({
      groupId: 'group-1',
      durableSessionId: 'durable-123',
      igniteGraceSessionId: 'grace-123',
      igniteGraceGroupId: 'group-1'
    }), false);
  });

  it('returns false when grace is mismatched or expired/missing', () => {
    assert.equal(computeIsIgniteGraceActiveForGroup({
      groupId: 'group-1',
      durableSessionId: null,
      igniteGraceSessionId: 'grace-123',
      igniteGraceGroupId: 'group-2'
    }), false);

    assert.equal(computeIsIgniteGraceActiveForGroup({
      groupId: 'group-1',
      durableSessionId: null,
      igniteGraceSessionId: null,
      igniteGraceGroupId: 'group-1'
    }), false);
  });

  it('returns true when grace is valid and durable session is absent', () => {
    assert.equal(computeIsIgniteGraceActiveForGroup({
      groupId: 'group-1',
      durableSessionId: null,
      igniteGraceSessionId: 'grace-123',
      igniteGraceGroupId: 'group-1'
    }), true);
  });
});
