import { strict as assert } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { getGraceDebugText } from './graceDebug.ts';

type WindowWithStorage = Window & typeof globalThis;

const originalWindow = globalThis.window;
const originalDateNow = Date.now;

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
  const storage = createStorage();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: storage, location: { hash: '#/g/group-1/app?debugGrace=1' } } as Partial<WindowWithStorage>
  });
});

afterEach(() => {
  Date.now = originalDateNow;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
});

describe('getGraceDebugText', () => {
  it('returns expected keys and masks sensitive values', () => {
    window.localStorage.setItem('fs.sessionId', 'durablesession-1234567890');
    window.localStorage.setItem('fs.igniteGraceSessionId', 'gracesession-0987654321');
    window.localStorage.setItem('fs.igniteGraceGroupId', 'group-1');
    window.localStorage.setItem('fs.igniteGraceExpiresAtUtc', '2100-01-01T00:00:00.000Z');

    const text = getGraceDebugText({ groupId: 'group-1', hash: '#/g/group-1/app?debugGrace=1' });

    assert.match(text, /timestampUtc:/);
    assert.match(text, /routeGroupId: group-1/);
    assert.match(text, /durableSessionPresent: true/);
    assert.match(text, /graceSessionIdPresent: true/);
    assert.match(text, /isIgniteGraceGuestForGroup: false/);
    assert.match(text, /loginPathWithNextFromHash: \/login\?next=/);
    assert.doesNotMatch(text, /durablesession-1234567890/);
    assert.doesNotMatch(text, /gracesession-0987654321/);
    assert.match(text, /durableSessionIdMasked: durabl…7890/);
    assert.match(text, /graceSessionIdMasked: graces…4321/);
  });

  it('handles invalid expiry gracefully', () => {
    window.localStorage.setItem('fs.igniteGraceSessionId', 'grace-abc1234567');
    window.localStorage.setItem('fs.igniteGraceGroupId', 'group-1');
    window.localStorage.setItem('fs.igniteGraceExpiresAtUtc', 'not-a-date');

    const text = getGraceDebugText({ groupId: 'group-1', hash: '#/g/group-1/app' });

    assert.match(text, /graceExpired: unknown/);
  });
});
