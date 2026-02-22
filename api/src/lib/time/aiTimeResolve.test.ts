import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTimeSpecWithFallback } from './aiTimeResolve.js';

const NOW = new Date('2026-01-01T12:00:00.000Z');

test('resolveTimeSpecWithFallback keeps deterministic resolved result without fallback', async () => {
  process.env.TIME_RESOLVE_OPENAI_FALLBACK = '1';
  const fetchMock = mock.method(global, 'fetch', async () => {
    throw new Error('fetch should not be called');
  });

  const result = await resolveTimeSpecWithFallback({ whenText: '3/3 1pm', timezone: 'America/Los_Angeles', now: NOW });
  assert.equal(result.usedFallback, false);
  assert.equal(result.time.intent.status, 'resolved');

  assert.equal(fetchMock.mock.callCount(), 0);
  fetchMock.mock.restore();
});

test('resolveTimeSpecWithFallback uses OpenAI when deterministic parse is unresolved', async () => {
  process.env.TIME_RESOLVE_OPENAI_FALLBACK = '1';
  process.env.OPENAI_API_KEY = 'sk-test';

  const fetchMock = mock.method(global, 'fetch', async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify({ status: 'resolved', startUtc: '2026-01-02T21:00:00.000Z', endUtc: null, missing: [], assumptions: [] }) } }]
    })
  }) as unknown as Response);

  const result = await resolveTimeSpecWithFallback({ whenText: 'tomorrow at 1pm', timezone: 'America/Los_Angeles', now: NOW });
  assert.equal(result.usedFallback, true);
  assert.equal(result.time.intent.status, 'resolved');
  assert.equal(result.time.resolved?.startUtc, '2026-01-02T21:00:00.000Z');
  assert.equal(fetchMock.mock.callCount(), 1);

  fetchMock.mock.restore();
});

test('resolveTimeSpecWithFallback leaves unresolved when fallback is disabled', async () => {
  process.env.TIME_RESOLVE_OPENAI_FALLBACK = '0';
  const fetchMock = mock.method(global, 'fetch', async () => {
    throw new Error('fetch should not be called');
  });

  const result = await resolveTimeSpecWithFallback({ whenText: 'tomorrow at 1pm', timezone: 'America/Los_Angeles', now: NOW });
  assert.equal(result.usedFallback, false);
  assert.notEqual(result.time.intent.status, 'resolved');
  assert.equal(fetchMock.mock.callCount(), 0);

  fetchMock.mock.restore();
});
