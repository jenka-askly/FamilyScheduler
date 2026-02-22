import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTimeSpecWithFallback, TimeResolveFallbackError } from './resolveTimeSpecWithFallback.js';

const NOW = new Date('2026-01-01T12:00:00.000Z');

test.afterEach(() => {
  delete process.env.TIME_RESOLVE_OPENAI_FALLBACK;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  delete process.env.TIME_RESOLVE_MODEL;
});

test('deterministic resolved does not call OpenAI', async () => {
  process.env.TIME_RESOLVE_OPENAI_FALLBACK = '1';
  const fetchMock = mock.method(global, 'fetch', async () => {
    throw new Error('fetch should not be called');
  });

  const result = await resolveTimeSpecWithFallback({ whenText: '3/3 1pm', timezone: 'America/Los_Angeles', now: NOW, traceId: 'trace-1', context: {} as any });

  assert.equal(result.usedFallback, false);
  assert.equal(result.fallbackAttempted, false);
  assert.equal(result.time.intent.status, 'resolved');
  assert.equal(fetchMock.mock.callCount(), 0);
  fetchMock.mock.restore();
});

test('deterministic unresolved triggers OpenAI when enabled', async () => {
  process.env.TIME_RESOLVE_OPENAI_FALLBACK = '1';
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.OPENAI_MODEL = 'gpt-test';

  const fetchMock = mock.method(global, 'fetch', async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify({ status: 'resolved', startUtc: '2026-01-02T23:00:00.000Z', endUtc: null, missing: [], assumptions: [] }) } }]
    })
  }) as unknown as Response);

  const result = await resolveTimeSpecWithFallback({ whenText: 'tomorrow 3pm', timezone: 'America/Los_Angeles', now: NOW, traceId: 'trace-2', context: {} as any });
  assert.equal(result.fallbackAttempted, true);
  assert.equal(result.usedFallback, true);
  assert.equal(result.time.intent.status, 'resolved');
  assert.equal(fetchMock.mock.callCount(), 1);
  fetchMock.mock.restore();
});

test('fallback disabled keeps unresolved local parse', async () => {
  process.env.TIME_RESOLVE_OPENAI_FALLBACK = '0';
  const fetchMock = mock.method(global, 'fetch', async () => {
    throw new Error('fetch should not be called');
  });

  const result = await resolveTimeSpecWithFallback({ whenText: 'tomorrow 3pm', timezone: 'America/Los_Angeles', now: NOW, traceId: 'trace-3', context: {} as any });
  assert.equal(result.fallbackAttempted, false);
  assert.equal(result.usedFallback, false);
  assert.equal(result.time.intent.status, 'unresolved');
  assert.equal(fetchMock.mock.callCount(), 0);
  fetchMock.mock.restore();
});

test('OpenAI failure throws typed error', async () => {
  process.env.TIME_RESOLVE_OPENAI_FALLBACK = '1';
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.OPENAI_MODEL = 'gpt-test';

  const fetchMock = mock.method(global, 'fetch', async () => ({ ok: false, status: 503, json: async () => ({}) }) as unknown as Response);

  await assert.rejects(
    resolveTimeSpecWithFallback({ whenText: 'tomorrow 3pm', timezone: 'America/Los_Angeles', now: NOW, traceId: 'trace-4', context: {} as any }),
    (error: unknown) => error instanceof TimeResolveFallbackError && error.code === 'OPENAI_CALL_FAILED'
  );

  fetchMock.mock.restore();
});
