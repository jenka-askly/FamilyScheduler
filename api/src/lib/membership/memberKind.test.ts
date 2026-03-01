import test from 'node:test';
import assert from 'node:assert/strict';
import { emailVerifiedOrTrue, memberKindOrFull, resolveEmailVerifiedFromSessionKind, resolveMemberKindFromSessionKind } from './memberKind.js';

test('resolveMemberKindFromSessionKind maps igniteGrace to guest', () => {
  assert.equal(resolveMemberKindFromSessionKind('igniteGrace'), 'guest');
});

test('resolveMemberKindFromSessionKind maps non-igniteGrace to full', () => {
  assert.equal(resolveMemberKindFromSessionKind('durable'), 'full');
  assert.equal(resolveMemberKindFromSessionKind('anythingElse'), 'full');
});

test('resolveEmailVerifiedFromSessionKind maps igniteGrace to false', () => {
  assert.equal(resolveEmailVerifiedFromSessionKind('igniteGrace'), false);
});

test('resolveEmailVerifiedFromSessionKind maps non-igniteGrace to true', () => {
  assert.equal(resolveEmailVerifiedFromSessionKind('durable'), true);
  assert.equal(resolveEmailVerifiedFromSessionKind('anythingElse'), true);
});

test('memberKindOrFull defaults missing memberKind to full', () => {
  assert.equal(memberKindOrFull({}), 'full');
  assert.equal(memberKindOrFull({ memberKind: 'full' }), 'full');
  assert.equal(memberKindOrFull({ memberKind: 'guest' }), 'guest');
});

test('emailVerifiedOrTrue defaults missing emailVerified to true', () => {
  assert.equal(emailVerifiedOrTrue({}), true);
  assert.equal(emailVerifiedOrTrue({ emailVerified: true }), true);
  assert.equal(emailVerifiedOrTrue({ emailVerified: false }), false);
});
