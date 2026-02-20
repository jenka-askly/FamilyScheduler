import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { diagnoseOpenAiConnectivity, parseToActions } from './openaiClient.js';
import { buildContext } from './buildContext.js';
import { createEmptyAppState } from '../state.js';

const originalFetch = globalThis.fetch;

const createContext = () => buildContext({ state: createEmptyAppState(), history: [] });

test.afterEach(async () => {
  globalThis.fetch = originalFetch;
  delete process.env.OPENAI_LOG_ENABLED;
  delete process.env.OPENAI_LOG_DIR;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
});

test('OPENAI_LOG_ENABLED=true writes redacted request and response NDJSON lines', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openai-logs-'));
  process.env.OPENAI_LOG_ENABLED = 'true';
  process.env.OPENAI_LOG_DIR = tmpDir;
  process.env.OPENAI_API_KEY = 'sk-test-secret';

  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify({ kind: 'reply', message: 'help', actions: [{ type: 'help' }] }) } }]
    })
  })) as unknown as typeof fetch;

  const parsed = await parseToActions('help https://example.test?sig=abc123', createContext(), { traceId: 'trace-1', sessionIdHash: 'sess-1' });
  assert.equal(parsed.kind, 'reply');

  const logPath = path.join(tmpDir, 'openai.ndjson');
  const file = await fs.readFile(logPath, 'utf8');
  const lines = file.trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(lines.length, 2);
  assert.equal(lines[0].type, 'openai_request');
  assert.equal(lines[1].type, 'openai_response');
  assert.equal(lines[0].traceId, 'trace-1');
  assert.equal(lines[1].sessionIdHash, 'sess-1');
  assert.doesNotMatch(file, /sk-/i);
  assert.equal(file.includes('sig=abc123'), false);
  assert.equal(file.includes('sig=[REDACTED]'), true);
});

test('parseToActions logs and throws on non-200 OpenAI HTTP response', async () => {
  process.env.OPENAI_API_KEY = 'sk-test-secret';
  const consoleErrorCalls: unknown[][] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => { consoleErrorCalls.push(args); };

  globalThis.fetch = (async () => ({
    ok: false,
    status: 401,
    text: async () => 'invalid key details that should be truncated'
  })) as unknown as typeof fetch;

  await assert.rejects(
    parseToActions('help', createContext(), { traceId: 'trace-http-fail', sessionIdHash: 'sess-http-fail' }),
    /OpenAI HTTP 401/
  );

  console.error = originalConsoleError;
  const tags = consoleErrorCalls.map((args) => String(args[0]));
  assert.equal(tags.includes('openai_http_error'), true);
  assert.equal(tags.includes('openai_call_failed'), true);
});


test('diagnoseOpenAiConnectivity reports missing api key safely', async () => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  const result = await diagnoseOpenAiConnectivity(1000);
  assert.equal(result.ok, false);
  assert.equal(result.hasApiKey, false);
  assert.equal(result.model, 'gpt-4.1-mini');
  assert.match(result.lastError ?? '', /OPENAI_API_KEY/i);
});

test('diagnoseOpenAiConnectivity succeeds on model endpoint', async () => {
  process.env.OPENAI_API_KEY = 'sk-test-secret';
  process.env.OPENAI_MODEL = 'gpt-4.1-mini';
  globalThis.fetch = (async () => ({ ok: true, status: 200 })) as unknown as typeof fetch;
  const result = await diagnoseOpenAiConnectivity(1000);
  assert.equal(result.ok, true);
  assert.equal(result.hasApiKey, true);
  assert.equal(result.model, 'gpt-4.1-mini');
});
test('OPENAI_LOG_ENABLED=false does not write log file', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openai-logs-off-'));
  process.env.OPENAI_LOG_ENABLED = 'false';
  process.env.OPENAI_LOG_DIR = tmpDir;
  process.env.OPENAI_API_KEY = 'sk-test-secret';

  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify({ kind: 'reply', message: 'help', actions: [{ type: 'help' }] }) } }]
    })
  })) as unknown as typeof fetch;

  await parseToActions('help', createContext(), { traceId: 'trace-2', sessionIdHash: 'sess-2' });

  await assert.rejects(fs.stat(path.join(tmpDir, 'openai.ndjson')));
});
