import test from 'node:test';
import assert from 'node:assert/strict';
import { authRequestLink } from './authRequestLink.js';

const originalEnv = {
  MAGIC_LINK_SECRET: process.env.MAGIC_LINK_SECRET,
  AZURE_COMMUNICATION_CONNECTION_STRING: process.env.AZURE_COMMUNICATION_CONNECTION_STRING,
  EMAIL_SENDER_ADDRESS: process.env.EMAIL_SENDER_ADDRESS,
  WEB_BASE_URL: process.env.WEB_BASE_URL
};

test.afterEach(() => {
  if (originalEnv.MAGIC_LINK_SECRET) process.env.MAGIC_LINK_SECRET = originalEnv.MAGIC_LINK_SECRET; else delete process.env.MAGIC_LINK_SECRET;
  if (originalEnv.AZURE_COMMUNICATION_CONNECTION_STRING) process.env.AZURE_COMMUNICATION_CONNECTION_STRING = originalEnv.AZURE_COMMUNICATION_CONNECTION_STRING; else delete process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
  if (originalEnv.EMAIL_SENDER_ADDRESS) process.env.EMAIL_SENDER_ADDRESS = originalEnv.EMAIL_SENDER_ADDRESS; else delete process.env.EMAIL_SENDER_ADDRESS;
  if (originalEnv.WEB_BASE_URL) process.env.WEB_BASE_URL = originalEnv.WEB_BASE_URL; else delete process.env.WEB_BASE_URL;
});

test('authRequestLink tolerates missing headers object', async () => {
  process.env.MAGIC_LINK_SECRET = 'test-secret';
  process.env.AZURE_COMMUNICATION_CONNECTION_STRING = 'Endpoint=https://example/;AccessKey=test';
  process.env.EMAIL_SENDER_ADDRESS = 'noreply@example.com';
  process.env.WEB_BASE_URL = '';

  const response = await authRequestLink({ json: async () => ({ email: 'person@example.com', traceId: 't-auth-no-headers' }) } as any, {} as any);

  assert.equal(response.status, 500);
  assert.equal((response.jsonBody as any).error, 'config_missing');
  assert.equal((response.jsonBody as any).code, 'CONFIG_MISSING');
  assert.deepEqual((response.jsonBody as any).missing, ['WEB_BASE_URL']);
});


test('authRequestLink returns BAD_JSON for invalid request body', async () => {
  const response = await authRequestLink({ json: async () => { throw new Error('invalid-json'); } } as any, {} as any);

  assert.equal(response.status, 400);
  assert.equal((response.jsonBody as any).ok, false);
  assert.equal((response.jsonBody as any).error, 'bad_request');
  assert.equal((response.jsonBody as any).code, 'BAD_JSON');
  assert.equal(typeof (response.jsonBody as any).traceId, 'string');
});

test('authRequestLink returns CONFIG_MISSING with missing list sorted', async () => {
  delete process.env.MAGIC_LINK_SECRET;
  delete process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
  delete process.env.EMAIL_SENDER_ADDRESS;

  const response = await authRequestLink({ json: async () => ({ email: 'person@example.com', traceId: 't-auth-config-missing' }) } as any, {} as any);

  assert.equal(response.status, 500);
  assert.equal((response.jsonBody as any).ok, false);
  assert.equal((response.jsonBody as any).error, 'config_missing');
  assert.equal((response.jsonBody as any).code, 'CONFIG_MISSING');
  assert.deepEqual((response.jsonBody as any).missing, [
    'AZURE_COMMUNICATION_CONNECTION_STRING',
    'EMAIL_SENDER_ADDRESS',
    'MAGIC_LINK_SECRET'
  ]);
});
