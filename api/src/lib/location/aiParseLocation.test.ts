import test from 'node:test';
import assert from 'node:assert/strict';
import { aiParseLocation } from './aiParseLocation.js';

test('aiParseLocation falls back to heuristic when api key missing', async () => {
  delete process.env.OPENAI_API_KEY;
  const parsed = await aiParseLocation('Kaiser\tRedwood City');
  assert.equal(parsed.display, 'Kaiser, Redwood City');
  assert.equal(parsed.mapQuery, 'Kaiser, Redwood City');
  assert.equal(parsed.address, '');
});

test('aiParseLocation parses and clamps model json response', async () => {
  process.env.OPENAI_API_KEY = 'sk-test';
  const originalFetch = global.fetch;
  global.fetch = ((async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify({
        name: 'EvergreenHealth Medical Center Diagnostic Imaging',
        address: '12040 NE 128th Street Blue 1-122, Kirkland, WA 98034',
        directions: 'Blue wing RM 122 (same floor as the mammogram)',
        display: 'EvergreenHealth Medical Center Diagnostic Imaging — Blue wing RM 122 (same floor as the mammogram)\n12040 NE 128th Street Blue 1-122, Kirkland, WA 98034',
        mapQuery: '12040 NE 128th Street Blue 1-122, Kirkland, WA 98034'
      }) } }]
    })
  })) as unknown) as typeof fetch;

  const parsed = await aiParseLocation('raw value');
  assert.equal(parsed.address.includes('Kirkland, WA 98034'), true);
  assert.equal(parsed.directions.includes('Blue wing RM 122'), true);
  assert.equal(parsed.display.includes('\n'), true);
  assert.equal(parsed.mapQuery.startsWith('12040 NE 128th Street'), true);

  global.fetch = originalFetch;
});
