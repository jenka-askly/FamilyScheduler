import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTimeSpecWithFallback } from './resolveTimeSpecWithFallback.js';

const NOW = new Date('2026-01-01T12:00:00.000Z');

test.afterEach(() => {
  delete process.env.TIME_RESOLVE_OPENAI_FALLBACK;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  delete process.env.TIME_RESOLVE_MODEL;
});

test('AI-first returns resolved result from OpenAI', async () => {
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.OPENAI_MODEL = 'gpt-test';

  const fetchMock = mock.method(global, 'fetch', async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      id: 'resp_123',
      output_text: JSON.stringify({ status: 'resolved', startUtc: '2026-01-02T21:00:00.000Z', endUtc: '2026-01-02T21:01:00.000Z', assumptions: [], evidenceSnippets: [] })
    })
  }) as unknown as Response);

  const result = await resolveTimeSpecWithFallback({ whenText: 'tomorrow 1pm', timezone: 'America/Los_Angeles', now: NOW, traceId: 'trace-1', context: { log: () => {} } as any });

  assert.equal(result.usedFallback, false);
  assert.equal(result.fallbackAttempted, true);
  assert.equal(result.time.intent.status, 'resolved');
  assert.equal(result.opId, 'resp_123');
  assert.equal(fetchMock.mock.callCount(), 1);
  fetchMock.mock.restore();
});

test('OpenAI failure gracefully falls back to deterministic parser', async () => {
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.OPENAI_MODEL = 'gpt-test';

  const fetchMock = mock.method(global, 'fetch', async () => ({ ok: false, status: 503, json: async () => ({}) }) as unknown as Response);

  const result = await resolveTimeSpecWithFallback({ whenText: '3/3 1pm', timezone: 'America/Los_Angeles', now: NOW, traceId: 'trace-2', context: { log: () => {} } as any });
  assert.equal(result.fallbackAttempted, true);
  assert.equal(result.usedFallback, true);
  assert.equal(result.time.intent.status, 'resolved');
  assert.equal(fetchMock.mock.callCount(), 1);
  fetchMock.mock.restore();
});

test('disabled AI keeps deterministic unresolved local parse', async () => {
  process.env.TIME_RESOLVE_OPENAI_FALLBACK = '0';
  const fetchMock = mock.method(global, 'fetch', async () => {
    throw new Error('fetch should not be called');
  });

  const result = await resolveTimeSpecWithFallback({ whenText: 'tomorrow 3pm', timezone: 'America/Los_Angeles', now: NOW, traceId: 'trace-3', context: { log: () => {} } as any });
  assert.equal(result.fallbackAttempted, false);
  assert.equal(result.usedFallback, false);
  assert.equal(result.time.intent.status, 'unresolved');
  assert.equal(fetchMock.mock.callCount(), 0);
  fetchMock.mock.restore();
});


test('AI bad response does not silently fallback', async () => {
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.OPENAI_MODEL = 'gpt-test';

  const fetchMock = mock.method(global, 'fetch', async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      id: 'resp_bad',
      output_text: JSON.stringify({ status: 'resolved', startUtc: 'not-iso', endUtc: 'not-iso' })
    })
  }) as unknown as Response);

  await assert.rejects(
    resolveTimeSpecWithFallback({ whenText: 'tomorrow 1pm', timezone: 'America/Los_Angeles', now: NOW, traceId: 'trace-4', context: { log: () => {} } as any }),
    /Resolved output missing valid UTC interval/
  );

  assert.equal(fetchMock.mock.callCount(), 1);
  fetchMock.mock.restore();
});
