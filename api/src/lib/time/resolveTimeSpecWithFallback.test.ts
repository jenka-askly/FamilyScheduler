import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTimeSpecWithFallback } from './resolveTimeSpecWithFallback.js';

const NOW = new Date('2026-01-01T12:00:00.000Z');

test.afterEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  delete process.env.TIME_RESOLVE_MODEL;
  delete process.env.TIME_RESOLVE_OPENAI_FALLBACK;
});

test('AI-first returns resolved interval with provenance', async () => {
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.OPENAI_MODEL = 'gpt-test';

  const fetchMock = mock.method(global, 'fetch', async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      id: 'resp_123',
      output_text: JSON.stringify({
        status: 'resolved',
        startUtc: '2026-01-02T09:00:00.000Z',
        endUtc: '2026-01-02T10:30:00.000Z',
        durationSource: 'suggested',
        durationConfidence: 0.72,
        durationReason: 'Typical appointment window inferred from phrase.',
        missing: [],
        assumptions: []
      })
    })
  }) as unknown as Response);

  const result = await resolveTimeSpecWithFallback({ whenText: '3/3 1pm', timezone: 'America/Los_Angeles', now: NOW, traceId: 'trace-1', context: { log: () => {} } as any });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.usedFallback, true);
  assert.equal(result.fallbackAttempted, true);
  assert.equal(result.time.intent.status, 'resolved');
  assert.equal(result.time.resolved?.durationSource, 'suggested');
  assert.notEqual(result.time.resolved?.endUtc, '2026-01-02T09:01:00.000Z');
  assert.equal(result.opId, 'resp_123');
  assert.equal(fetchMock.mock.callCount(), 1);
  fetchMock.mock.restore();
});

test('OpenAI failure falls back to deterministic parse', async () => {
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.OPENAI_MODEL = 'gpt-test';

  const fetchMock = mock.method(global, 'fetch', async () => ({ ok: false, status: 503, text: async () => 'upstream failed' }) as unknown as Response);

  const result = await resolveTimeSpecWithFallback({ whenText: 'tomorrow 1pm', timezone: 'America/Los_Angeles', now: NOW, traceId: 'trace-2', context: { log: () => {} } as any });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.time.intent.status, 'resolved');
  assert.equal(result.fallbackAttempted, true);
  assert.equal(result.usedFallback, false);
  assert.equal(fetchMock.mock.callCount(), 1);
  fetchMock.mock.restore();
});


test('AI bad partial payload falls back to deterministic partial for time-only input', async () => {
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.OPENAI_MODEL = 'gpt-test';

  const fetchMock = mock.method(global, 'fetch', async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      id: 'resp_bad',
      output_text: JSON.stringify({
        status: 'partial',
        missing: []
      })
    })
  }) as unknown as Response);

  const result = await resolveTimeSpecWithFallback({ whenText: '8pm', timezone: 'America/Los_Angeles', now: NOW, traceId: 'trace-3', context: { log: () => {} } as any });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.time.intent.status, 'unresolved');
  assert.deepEqual(result.time.intent.missing, ['date']);
  assert.equal(result.fallbackAttempted, true);
  assert.equal(result.usedFallback, false);
  assert.equal(fetchMock.mock.callCount(), 1);
  fetchMock.mock.restore();
});
