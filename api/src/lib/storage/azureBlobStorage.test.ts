import test from 'node:test';
import assert from 'node:assert/strict';
import { formatIfMatch, normalizeEtag } from './azureBlobStorage.js';

test('normalizeEtag strips weak prefix and quotes', () => {
  assert.equal(normalizeEtag('W/"abc"'), 'abc');
  assert.equal(normalizeEtag('"abc"'), 'abc');
  assert.equal(normalizeEtag('abc'), 'abc');
  assert.equal(normalizeEtag(null), '');
});

test('formatIfMatch enforces quoted etag', () => {
  assert.equal(formatIfMatch('abc'), '"abc"');
  assert.equal(formatIfMatch('"abc"'), '"abc"');
  assert.equal(formatIfMatch('W/"abc"'), '"abc"');
  assert.equal(formatIfMatch('*'), '*');
  assert.throws(() => formatIfMatch(''), /expectedEtag/i);
});
