import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeImageBase64 } from './appointmentScan.js';

test('decodeImageBase64 accepts raw base64 payloads', () => {
  const buffer = decodeImageBase64(Buffer.from('hello world').toString('base64'));
  assert.equal(buffer.toString('utf8'), 'hello world');
});

test('decodeImageBase64 accepts data URLs', () => {
  const base64 = Buffer.from('image-bytes').toString('base64');
  const buffer = decodeImageBase64(`data:image/jpeg;base64,${base64}`);
  assert.equal(buffer.toString('utf8'), 'image-bytes');
});

test('decodeImageBase64 rejects malformed base64', () => {
  assert.throws(() => decodeImageBase64('abc'), /invalid_image_base64/);
});
