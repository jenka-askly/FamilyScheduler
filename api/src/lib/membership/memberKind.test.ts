import test from 'node:test';
import assert from 'node:assert/strict';
import { memberKindOrFull, resolveMemberKindFromSessionKind } from './memberKind.js';

test('resolveMemberKindFromSessionKind maps igniteGrace to guest', () => {
  assert.equal(resolveMemberKindFromSessionKind('igniteGrace'), 'guest');
});

test('resolveMemberKindFromSessionKind maps non-igniteGrace to full', () => {
  assert.equal(resolveMemberKindFromSessionKind('durable'), 'full');
  assert.equal(resolveMemberKindFromSessionKind('anythingElse'), 'full');
});

test('memberKindOrFull defaults missing memberKind to full', () => {
  assert.equal(memberKindOrFull({}), 'full');
  assert.equal(memberKindOrFull({ memberKind: 'full' }), 'full');
  assert.equal(memberKindOrFull({ memberKind: 'guest' }), 'guest');
});
