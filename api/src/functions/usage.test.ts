import test from 'node:test';
import assert from 'node:assert/strict';
import { usage } from './usage.js';
import { setUsageMeterStoreForTests, type UsageMeterRecord } from '../lib/usageMeter.js';

test.afterEach(() => {
  setUsageMeterStoreForTests(null);
  delete process.env.USAGE_DAILY_REQUEST_LIMIT;
  delete process.env.USAGE_DAILY_TOKEN_LIMIT;
});

const makeStore = (record: UsageMeterRecord | null, trackingAvailable = true) => ({
  trackingAvailable,
  async load() { return record; },
  async update() { throw new Error('not used'); }
});

test('usage returns unknown only when no meter and tracking unavailable', async () => {
  setUsageMeterStoreForTests(makeStore(null, false));
  const response = await usage({} as any, {} as any);
  assert.equal(response.status, 200);
  assert.equal((response.jsonBody as any).usageState, 'unknown');
  assert.equal(typeof (response.jsonBody as any).usageSummary, 'string');
  assert.notEqual((response.jsonBody as any).usageSummary.trim(), '');
});

test('usage returns ok with deterministic summary when meter exists', async () => {
  setUsageMeterStoreForTests(makeStore({
    windowStartISO: '2026-01-01',
    requests: 12,
    tokensIn: 12000,
    tokensOut: 6000,
    lastSuccessAtISO: '2026-01-01T12:00:00.000Z'
  }));
  process.env.USAGE_DAILY_REQUEST_LIMIT = '200';
  process.env.USAGE_DAILY_TOKEN_LIMIT = '200000';

  const response = await usage({} as any, {} as any);
  assert.equal((response.jsonBody as any).usageState, 'ok');
  assert.match((response.jsonBody as any).usageSummary, /\d+\/200 req/);
  assert.match((response.jsonBody as any).usageSummary, /tokens/);
  assert.notEqual((response.jsonBody as any).usageSummary.trim(), '');
  assert.equal(Number.isNaN(Date.parse((response.jsonBody as any).updatedAt)), false);
});

test('usage returns warning near limit and for recent error', async () => {
  process.env.USAGE_DAILY_REQUEST_LIMIT = '100';
  setUsageMeterStoreForTests(makeStore({
    windowStartISO: new Date().toISOString().slice(0, 10),
    requests: 70,
    tokensIn: 0,
    tokensOut: 0,
    lastErrorAtISO: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    lastErrorSummary: 'OpenAI HTTP 500'
  }));

  const response = await usage({} as any, {} as any);
  assert.equal((response.jsonBody as any).usageState, 'warning');
  assert.match((response.jsonBody as any).usageSummary, /last error/i);
});

test('usage returns limit_reached when over request limit', async () => {
  process.env.USAGE_DAILY_REQUEST_LIMIT = '10';
  setUsageMeterStoreForTests(makeStore({
    windowStartISO: new Date().toISOString().slice(0, 10),
    requests: 10,
    tokensIn: 0,
    tokensOut: 0
  }));

  const response = await usage({} as any, {} as any);
  assert.equal((response.jsonBody as any).usageState, 'limit_reached');
  assert.notEqual((response.jsonBody as any).usageSummary.trim(), '');
});
