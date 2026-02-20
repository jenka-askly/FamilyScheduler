import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const GROUP_ID = '11111111-1111-4111-8111-111111111111';
const PHONE = '+14155550123';

const originalFetch = globalThis.fetch;

const seedState = async (prefix: string) => {
  const dir = path.resolve(REPO_ROOT, prefix, GROUP_ID);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'state.json'), JSON.stringify({
    schemaVersion: 3,
    groupId: GROUP_ID,
    groupName: 'Test Group',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    people: [{ personId: 'P-1', name: 'Creator', cellE164: PHONE, cellDisplay: '(415) 555-0123', status: 'active' }],
    appointments: [],
    rules: [],
    history: []
  }, null, 2));
};

const loadChat = async (tag: string) => {
  process.env.STORAGE_MODE = 'local';
  process.env.LOCAL_STATE_PREFIX = `./.localtest/chat-${tag}`;
  await seedState(process.env.LOCAL_STATE_PREFIX);
  const mod = await import(`./chat.js?${tag}`);
  return mod.chat as (request: any, context: any) => Promise<any>;
};

const installFetchStub = () => {
  globalThis.fetch = (async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ kind: 'reply', message: 'ok', actions: [{ type: 'list_people' }] }) } }] }) }) as any) as typeof fetch;
};

test.afterEach(() => { globalThis.fetch = originalFetch; });

test('chat returns 403 when phone is not allowed', async () => {
  const chat = await loadChat('denied');
  const response = await chat({ json: async () => ({ groupId: GROUP_ID, phone: '+14155550124', message: 'help' }), headers: { get: () => 's1' } } as any, {} as any);
  assert.equal(response.status, 403);
  assert.equal((response.jsonBody as any).error, 'not_allowed');
});


test('chat returns group_not_found when group is missing', async () => {
  process.env.STORAGE_MODE = 'local';
  process.env.LOCAL_STATE_PREFIX = './.localtest/chat-missing';
  const tag = 'missing-group';
  const mod = await import(`./chat.js?${tag}`);
  const chat = mod.chat as (request: any, context: any) => Promise<any>;
  const response = await chat({ json: async () => ({ groupId: '33333333-3333-4333-8333-333333333333', phone: PHONE, message: 'help' }), headers: { get: () => 's1' } } as any, {} as any);
  assert.equal(response.status, 404);
  assert.equal((response.jsonBody as any).error, 'group_not_found');
});


test('chat returns 502 with structured error when OpenAI call fails', async () => {
  process.env.OPENAI_API_KEY = 'sk-invalid';
  globalThis.fetch = (async () => ({
    ok: false,
    status: 401,
    text: async () => 'invalid api key'
  })) as any;
  const chat = await loadChat('openai-fail');
  const response = await chat({ json: async () => ({ groupId: GROUP_ID, phone: PHONE, message: 'list people' }), headers: { get: () => 's1' } } as any, {} as any);
  assert.equal(response.status, 502);
  assert.equal((response.jsonBody as any).error, 'OPENAI_CALL_FAILED');
  assert.match((response.jsonBody as any).message, /OpenAI HTTP 401/);
});


test('chat works for allowed phone', async () => {
  installFetchStub();
  const chat = await loadChat('allowed');
  const response = await chat({ json: async () => ({ groupId: GROUP_ID, phone: PHONE, message: 'list people' }), headers: { get: () => 's1' } } as any, {} as any);
  assert.equal(response.status, 200);
  assert.ok((response.jsonBody as any).snapshot);
});
