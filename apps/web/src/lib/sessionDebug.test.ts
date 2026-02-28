import { strict as assert } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { buildSessionDebugText, clearAllSessionKeys, clearDurableSessionKeys, clearGraceSessionKeys } from './sessionDebug.ts';

type WindowWithStorage = Window & typeof globalThis;

const originalWindow = globalThis.window;

const createStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    }
  };
};

beforeEach(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: createStorage(),
      location: { hash: '#/g/group-1/app?from=test' }
    } as Partial<WindowWithStorage>
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
});

describe('buildSessionDebugText', () => {
  it('includes required keys', () => {
    const text = buildSessionDebugText({ hash: '#/g/group-1/app?from=test', groupId: 'group-1' });

    assert.match(text, /timestampUtc:/);
    assert.match(text, /hash: #\/g\/group-1\/app\?from=test/);
    assert.match(text, /groupId: group-1/);
    assert.match(text, /localStorage\.fs\.sessionId:/);
    assert.match(text, /localStorage\.fs\.igniteGraceSessionId:/);
    assert.match(text, /computed\.getSessionId\(\):/);
    assert.match(text, /computed\.buildLoginPathWithNextFromHash\(hash\): \/login\?next=/);
  });

  it('masks session ids and never leaks raw values', () => {
    const durable = 'durablesession-1234567890';
    const grace = 'gracesession-0987654321';
    window.localStorage.setItem('fs.sessionId', durable);
    window.localStorage.setItem('fs.igniteGraceSessionId', grace);
    window.localStorage.setItem('fs.igniteGraceGroupId', 'group-1');

    const text = buildSessionDebugText({ hash: '#/g/group-1/app', groupId: 'group-1' });

    assert.doesNotMatch(text, new RegExp(durable));
    assert.doesNotMatch(text, new RegExp(grace));
    assert.match(text, /durabl…7890/);
    assert.match(text, /graces…4321/);
  });

  it('handles missing groupId and invalid expiry safely', () => {
    window.localStorage.setItem('fs.igniteGraceExpiresAtUtc', 'not-a-date');
    window.localStorage.setItem('fs.igniteGraceSessionId', 'short-id');

    const text = buildSessionDebugText({ hash: '#/g/group-1/app' });

    assert.match(text, /groupId: /);
    assert.match(text, /localStorage\.fs\.igniteGraceExpiresAtUtc: not-a-date/);
    assert.match(text, /localStorage\.fs\.igniteGraceSessionId: \*\*\*/);
    assert.match(text, /computed\.isIgniteGraceGuestForGroup\(groupId\): false/);
  });
});

describe('session key clear helpers', () => {
  it('clears durable keys only', () => {
    window.localStorage.setItem('fs.sessionId', 'durable-1234567890');
    window.localStorage.setItem('fs.sessionEmail', 'member@example.com');
    window.localStorage.setItem('fs.sessionName', 'Member');
    window.localStorage.setItem('fs.igniteGraceSessionId', 'grace-1234567890');

    clearDurableSessionKeys();

    assert.equal(window.localStorage.getItem('fs.sessionId'), null);
    assert.equal(window.localStorage.getItem('fs.sessionEmail'), null);
    assert.equal(window.localStorage.getItem('fs.sessionName'), null);
    assert.equal(window.localStorage.getItem('fs.igniteGraceSessionId'), 'grace-1234567890');
  });

  it('clears grace keys only', () => {
    window.localStorage.setItem('fs.sessionId', 'durable-1234567890');
    window.localStorage.setItem('fs.igniteGraceSessionId', 'grace-1234567890');
    window.localStorage.setItem('fs.igniteGraceGroupId', 'group-1');
    window.localStorage.setItem('fs.igniteGraceExpiresAtUtc', '2099-01-01T00:00:00.000Z');

    clearGraceSessionKeys();

    assert.equal(window.localStorage.getItem('fs.igniteGraceSessionId'), null);
    assert.equal(window.localStorage.getItem('fs.igniteGraceGroupId'), null);
    assert.equal(window.localStorage.getItem('fs.igniteGraceExpiresAtUtc'), null);
    assert.equal(window.localStorage.getItem('fs.sessionId'), 'durable-1234567890');
  });

  it('clears all known session keys', () => {
    window.localStorage.setItem('fs.sessionId', 'durable-1234567890');
    window.localStorage.setItem('fs.sessionEmail', 'member@example.com');
    window.localStorage.setItem('fs.sessionName', 'Member');
    window.localStorage.setItem('fs.igniteGraceSessionId', 'grace-1234567890');
    window.localStorage.setItem('fs.igniteGraceGroupId', 'group-1');
    window.localStorage.setItem('fs.igniteGraceExpiresAtUtc', '2099-01-01T00:00:00.000Z');

    clearAllSessionKeys();

    assert.equal(window.localStorage.getItem('fs.sessionId'), null);
    assert.equal(window.localStorage.getItem('fs.sessionEmail'), null);
    assert.equal(window.localStorage.getItem('fs.sessionName'), null);
    assert.equal(window.localStorage.getItem('fs.igniteGraceSessionId'), null);
    assert.equal(window.localStorage.getItem('fs.igniteGraceGroupId'), null);
    assert.equal(window.localStorage.getItem('fs.igniteGraceExpiresAtUtc'), null);
  });

  it('does not throw when localStorage is unavailable', () => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: undefined });

    assert.doesNotThrow(() => clearDurableSessionKeys());
    assert.doesNotThrow(() => clearGraceSessionKeys());
    assert.doesNotThrow(() => clearAllSessionKeys());
  });
});
