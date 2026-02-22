import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { parseTimeSpecAIWithMeta } from './parseTimeSpecAI.js';

test.afterEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  delete process.env.TIME_RESOLVE_MODEL;
});

test('parseTimeSpecAI resolves multilingual relative phrase', async () => {
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.OPENAI_MODEL = 'gpt-test';

  const fetchMock = mock.method(global, 'fetch', async (_input: unknown, init: { body?: BodyInit | null } | undefined) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, any>;
    assert.equal(body.response_format?.type, 'json_schema');
    assert.equal(body.response_format?.json_schema?.name, 'time_spec_parse');
    assert.equal(body.response_format?.json_schema?.strict, true);
    assert.equal(body.response_format?.json_schema?.schema?.required?.includes('status'), true);

    return ({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'resp_mx',
        output_text: JSON.stringify({ status: 'resolved', startUtc: '2026-01-02T21:00:00.000Z', endUtc: '2026-01-02T21:01:00.000Z', assumptions: ['mañana interpreted as tomorrow'] })
      })
    }) as unknown as Response;
  });

  const result = await parseTimeSpecAIWithMeta({
    originalText: 'mañana a la 1pm',
    timezone: 'America/Los_Angeles',
    nowIso: '2026-01-01T12:00:00.000Z',
    locale: 'es'
  });

  assert.equal(result.time.intent.status, 'resolved');
  assert.equal(result.time.resolved?.timezone, 'America/Los_Angeles');
  assert.equal(result.meta.opId, 'resp_mx');
  assert.equal(result.meta.provider, 'openai');
  assert.equal(result.meta.modelOrDeployment, 'gpt-test');
  assert.equal(fetchMock.mock.callCount(), 1);
  fetchMock.mock.restore();
});
