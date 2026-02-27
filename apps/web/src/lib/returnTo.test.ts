import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { buildLoginPathWithNextFromHash, getSafeNextPathFromHash, sanitizeReturnTo } from './returnTo.ts';

describe('returnTo helpers', () => {
  it('keeps in-app group route for login next', () => {
    assert.equal(getSafeNextPathFromHash('#/g/group-123/app'), '/g/group-123/app');
  });

  it('falls back to root for invalid next values', () => {
    assert.equal(sanitizeReturnTo('https://malicious.example/evil'), '/');
    assert.equal(getSafeNextPathFromHash('#https://malicious.example/evil'), '/');
  });

  it('builds login path with encoded current in-app hash route', () => {
    assert.equal(buildLoginPathWithNextFromHash('#/g/abc/app?x=1'), '/login?next=%2Fg%2Fabc%2Fapp%3Fx%3D1');
  });

  it('falls back to root login next for unsafe hash routes', () => {
    assert.equal(buildLoginPathWithNextFromHash('#https://malicious.example/evil'), '/login?next=%2F');
    assert.equal(buildLoginPathWithNextFromHash('#//malicious.example/evil'), '/login?next=%2F');
  });

});
