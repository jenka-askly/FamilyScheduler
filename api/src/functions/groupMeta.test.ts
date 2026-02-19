import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const GROUP_ID = '22222222-2222-4222-8222-222222222222';

const loadGroupMeta = async (tag: string) => {
  process.env.LOCAL_STATE_PREFIX = `./.localtest/group-meta-${tag}`;
  const mod = await import(`./groupMeta.js?${tag}`);
  return mod.groupMeta as (request: any, context: any) => Promise<any>;
};

const seedState = async (prefix: string) => {
  const dir = path.resolve(REPO_ROOT, prefix, GROUP_ID);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'state.json'), JSON.stringify({
    groupId: GROUP_ID,
    groupName: 'Meta Test Group',
    people: [],
    appointments: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
  }), 'utf-8');
};

test('groupMeta returns public group metadata', async () => {
  const tag = 'meta-ok';
  await seedState(`./.localtest/group-meta-${tag}`);
  const groupMeta = await loadGroupMeta(tag);
  const response = await groupMeta({ url: `http://localhost/api/group/meta?groupId=${GROUP_ID}` } as any, {} as any);
  assert.equal(response.status, 200);
  assert.equal((response.jsonBody as any).ok, true);
  assert.equal((response.jsonBody as any).groupName, 'Meta Test Group');
});

test('groupMeta returns group_not_found for unknown group', async () => {
  const groupMeta = await loadGroupMeta('meta-missing');
  const response = await groupMeta({ url: 'http://localhost/api/group/meta?groupId=33333333-3333-4333-8333-333333333333' } as any, {} as any);
  assert.equal(response.status, 404);
  assert.equal((response.jsonBody as any).error, 'group_not_found');
});
