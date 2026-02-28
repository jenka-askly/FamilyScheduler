import { strict as assert } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { buildSessionDebugText } from './sessionDebug.ts';

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
