import test from 'node:test';
import assert from 'node:assert/strict';
import { validateIdentityRequest } from './groupAuth.js';

test('validateIdentityRequest accepts valid email identity', () => {
  const result = validateIdentityRequest('123e4567-e89b-42d3-a456-426614174000', 'User@Example.com', undefined);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.groupId, '123e4567-e89b-42d3-a456-426614174000');
  assert.deepEqual(result.identity, { kind: 'email', email: 'user@example.com' });
});

test('validateIdentityRequest accepts valid phone identity when email missing', () => {
  const result = validateIdentityRequest('123e4567-e89b-42d3-a456-426614174000', undefined, '+1 (415) 555-1212');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.identity.kind, 'phone');
  assert.equal(result.identity.phoneE164, '+14155551212');
});

test('validateIdentityRequest requires at least one identity', () => {
  const result = validateIdentityRequest('123e4567-e89b-42d3-a456-426614174000', undefined, undefined);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.response.status, 400);
  assert.equal((result.response.jsonBody as { error?: string }).error, 'identity_required');
});
