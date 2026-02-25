import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEmailIdentityRequest } from './groupAuth.js';

test('validateEmailIdentityRequest accepts valid email identity', () => {
  const result = validateEmailIdentityRequest('123e4567-e89b-42d3-a456-426614174000', 'User@Example.com');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.groupId, '123e4567-e89b-42d3-a456-426614174000');
  assert.equal(result.email, 'user@example.com');
});

test('validateEmailIdentityRequest requires email', () => {
  const result = validateEmailIdentityRequest('123e4567-e89b-42d3-a456-426614174000', undefined);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.response.status, 400);
  assert.equal((result.response.jsonBody as { error?: string }).error, 'identity_required');
});
