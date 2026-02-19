import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

const loadGroupCreate = async (tag: string) => {
  process.env.STORAGE_MODE = 'local';
  process.env.LOCAL_STATE_PREFIX = `./.localtest/group-create-${tag}`;
  const mod = await import(`./groupCreate.js?${tag}`);
  return mod.groupCreate as (request: any, context: any) => Promise<any>;
};

test('group create seeds creator in people and returns link payload', async () => {
  const groupCreate = await loadGroupCreate('seeds-person');
  const response = await groupCreate({ json: async () => ({ groupName: 'Family', groupKey: '123456', creatorPhone: '(415) 555-0123', creatorName: 'Joe' }) } as any, { debug: () => {} } as any);

  assert.equal(response.status, 200);
  const body = response.jsonBody as any;
  assert.ok(body.groupId);
  assert.equal(body.groupName, 'Family');
  assert.ok(body.creatorPersonId.startsWith('P-'));
  assert.equal(body.linkPath, `/#/g/${body.groupId}`);

  const statePath = path.resolve(REPO_ROOT, process.env.LOCAL_STATE_PREFIX!, body.groupId, 'state.json');
  const state = JSON.parse(await readFile(statePath, 'utf8')) as any;
  assert.ok(Array.isArray(state.people));
  assert.ok(state.people.length >= 1);
  assert.equal(state.people[0].cellE164, '+14155550123');
  assert.equal(state.people[0].name, 'Joe');
});

test('group create rejects invalid phone', async () => {
  const groupCreate = await loadGroupCreate('invalid-phone');
  const response = await groupCreate({ json: async () => ({ groupName: 'Family', groupKey: '123456', creatorPhone: 'abc', creatorName: 'Joe' }) } as any, { debug: () => {} } as any);
  assert.equal(response.status, 400);
  assert.match((response.jsonBody as any).message, /phone/i);
});
