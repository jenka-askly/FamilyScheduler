import test from 'node:test';
import assert from 'node:assert/strict';
import { getOpenAIClient } from './openaiClient.js';

test.afterEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  delete process.env.TIME_RESOLVE_MODEL;
  delete process.env.AZURE_OPENAI_ENDPOINT;
  delete process.env.AZURE_OPENAI_API_KEY;
  delete process.env.AZURE_OPENAI_DEPLOYMENT;
  delete process.env.AZURE_OPENAI_API_VERSION;
});

test('getOpenAIClient selects OpenAI provider by default', () => {
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.OPENAI_MODEL = 'gpt-4.1-mini';

  const client = getOpenAIClient();

  assert.equal(client.provider, 'openai');
  assert.equal(client.modelOrDeployment, 'gpt-4.1-mini');
  assert.equal(client.requestUrl, 'https://api.openai.com/v1/responses');
  assert.match(client.headers.Authorization ?? '', /^Bearer /);
});

test('getOpenAIClient selects Azure provider when endpoint is configured', () => {
  process.env.AZURE_OPENAI_ENDPOINT = 'https://unit-test.openai.azure.com/';
  process.env.AZURE_OPENAI_API_KEY = 'azure-key';
  process.env.AZURE_OPENAI_DEPLOYMENT = 'gpt-4o-mini-deploy';
  process.env.AZURE_OPENAI_API_VERSION = '2025-03-01-preview';

  const client = getOpenAIClient();

  assert.equal(client.provider, 'azure');
  assert.equal(client.modelOrDeployment, 'gpt-4o-mini-deploy');
  assert.equal(client.requestUrl, 'https://unit-test.openai.azure.com/openai/responses?api-version=2025-03-01-preview');
  assert.equal(client.headers['api-key'], 'azure-key');
});
