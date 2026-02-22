import test from 'node:test';
import assert from 'node:assert/strict';
import { usage } from './usage.js';

test('usage returns default usage state payload', async () => {
  const response = await usage({} as any, {} as any);
  assert.equal(response.status, 200);
  assert.equal((response.jsonBody as any).usageState, 'unknown');
  assert.equal((response.jsonBody as any).usageSummary, 'usage data not configured');
  assert.equal(typeof (response.jsonBody as any).updatedAt, 'string');
  assert.equal(Number.isNaN(Date.parse((response.jsonBody as any).updatedAt)), false);
});
