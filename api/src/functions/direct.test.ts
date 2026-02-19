import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const GROUP_ID = '22222222-2222-4222-8222-222222222222';
const PHONE = '+14155550123';

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

const loadDirect = async (tag: string) => {
  process.env.STORAGE_MODE = 'local';
  process.env.LOCAL_STATE_PREFIX = `./.localtest/direct-${tag}`;
  await seedState(process.env.LOCAL_STATE_PREFIX);
  const mod = await import(`./direct.js?${tag}`);
  return mod.direct as (request: any, context: any) => Promise<any>;
};


test('direct returns group_not_found when group is missing', async () => {
  process.env.STORAGE_MODE = 'local';
  process.env.LOCAL_STATE_PREFIX = './.localtest/direct-missing';
  const tag = 'missing-group';
  const mod = await import(`./direct.js?${tag}`);
  const direct = mod.direct as (request: any, context: any) => Promise<any>;
  const response = await direct({ json: async () => ({ groupId: '44444444-4444-4444-8444-444444444444', phone: PHONE, action: { type: 'create_blank_appointment' } }) } as any, {} as any);
  assert.equal(response.status, 404);
  assert.equal((response.jsonBody as any).error, 'group_not_found');
});

test('direct endpoint enforces group/phone and mutates for allowed member', async () => {
  const direct = await loadDirect('flow');
  const denied = await direct({ json: async () => ({ groupId: GROUP_ID, phone: '+14155550124', action: { type: 'create_blank_appointment' } }) } as any, {} as any);
  assert.equal(denied.status, 403);

  const ok = await direct({ json: async () => ({ groupId: GROUP_ID, phone: PHONE, action: { type: 'create_blank_appointment' } }) } as any, {} as any);
  assert.equal((ok.jsonBody as any).ok, true);
  assert.equal((ok.jsonBody as any).snapshot.appointments.length, 1);
});
