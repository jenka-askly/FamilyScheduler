import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { ExpiredTokenError, InvalidTokenError, sign, verify, type MagicLinkPayload } from './magicLink.js';

const SECRET = 'test-secret';

const createPayload = (overrides: Partial<MagicLinkPayload> = {}): MagicLinkPayload => {
  const now = Math.floor(Date.now() / 1000);
  return {
    v: 1,
    sub: 'person@example.com',
    jti: randomUUID(),
    purpose: 'login',
    iat: now,
    exp: now + 300,
    ...overrides
  };
};

test('verifies valid signed payload', () => {
  const token = sign(createPayload(), SECRET);
  const payload = verify(token, SECRET);
  assert.equal(payload.sub, 'person@example.com');
  assert.equal(payload.purpose, 'login');
});

test('rejects tampered payload', () => {
  const token = sign(createPayload(), SECRET);
  const [payload, signature] = token.split('.');
  const tamperedPayload = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')), sub: 'attacker@example.com' })).toString('base64url');
  const tamperedToken = `${tamperedPayload}.${signature}`;
  assert.throws(() => verify(tamperedToken, SECRET), InvalidTokenError);
});

test('rejects expired exp', () => {
  const now = Math.floor(Date.now() / 1000);
  const token = sign(createPayload({ iat: now - 10, exp: now - 1 }), SECRET);
  assert.throws(() => verify(token, SECRET), ExpiredTokenError);
});

test('rejects wrong purpose', () => {
  const payload = { ...createPayload(), purpose: 'other' } as unknown as MagicLinkPayload;
  const token = sign(payload, SECRET);
  assert.throws(() => verify(token, SECRET), InvalidTokenError);
});
