import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { applyIgniteJoinSessionResult, clearIgniteGraceStorageKeys } from './igniteJoinSession.ts';

const createStorage = (seed: Record<string, string> = {}) => {
  const data = new Map(Object.entries(seed));
  return {
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    getItem: (key: string) => data.get(key) ?? null
  };
};

describe('ignite breakout join session storage', () => {
  it('clears grace keys when durable session exists', () => {
    const storage = createStorage({
      'fs.sessionId': 'durable-123',
      'fs.igniteGraceSessionId': 'grace-123',
      'fs.igniteGraceGroupId': 'group-old',
      'fs.igniteGraceExpiresAtUtc': '2099-01-01T00:00:00.000Z'
    });

    applyIgniteJoinSessionResult({
      storage,
      hasDsid: true,
      targetGroupId: 'group-new',
      responseSessionId: undefined,
      graceExpiresAtUtc: undefined
    });

    assert.equal(storage.getItem('fs.sessionId'), 'durable-123');
    assert.equal(storage.getItem('fs.igniteGraceSessionId'), null);
    assert.equal(storage.getItem('fs.igniteGraceGroupId'), null);
    assert.equal(storage.getItem('fs.igniteGraceExpiresAtUtc'), null);
  });

  it('stores grace keys and keeps fs.sessionId empty when durable session is absent', () => {
    const storage = createStorage();

    applyIgniteJoinSessionResult({
      storage,
      hasDsid: false,
      targetGroupId: 'group-breakout',
      responseSessionId: 'grace-xyz',
      graceExpiresAtUtc: '2099-01-01T00:00:00.000Z'
    });

    assert.equal(storage.getItem('fs.sessionId'), null);
    assert.equal(storage.getItem('fs.igniteGraceSessionId'), 'grace-xyz');
    assert.equal(storage.getItem('fs.igniteGraceGroupId'), 'group-breakout');
    assert.equal(storage.getItem('fs.igniteGraceExpiresAtUtc'), '2099-01-01T00:00:00.000Z');
  });

  it('clear helper removes all grace keys', () => {
    const storage = createStorage({
      'fs.igniteGraceSessionId': 'grace-1',
      'fs.igniteGraceGroupId': 'group-1',
      'fs.igniteGraceExpiresAtUtc': '2099-01-01T00:00:00.000Z'
    });

    clearIgniteGraceStorageKeys(storage);

    assert.equal(storage.getItem('fs.igniteGraceSessionId'), null);
    assert.equal(storage.getItem('fs.igniteGraceGroupId'), null);
    assert.equal(storage.getItem('fs.igniteGraceExpiresAtUtc'), null);
  });
});
