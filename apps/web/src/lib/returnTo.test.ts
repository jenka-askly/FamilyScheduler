import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { getSafeNextPathFromHash, sanitizeReturnTo } from './returnTo.ts';

describe('returnTo helpers', () => {
  it('keeps in-app group route for login next', () => {
    assert.equal(getSafeNextPathFromHash('#/g/group-123/app'), '/g/group-123/app');
  });

  it('falls back to root for invalid next values', () => {
    assert.equal(sanitizeReturnTo('https://malicious.example/evil'), '/');
    assert.equal(getSafeNextPathFromHash('#https://malicious.example/evil'), '/');
  });
});
