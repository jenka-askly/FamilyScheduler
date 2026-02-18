import test from 'node:test';
import assert from 'node:assert/strict';
import { chat } from './chat.js';

const sendChat = async (message: string) => chat({ json: async () => ({ message }) } as any, {} as any);

const resetState = async () => {
  const resetProposal = await sendChat('reset state');
  assert.equal(resetProposal.status, 200);
  assert.equal((resetProposal.jsonBody as any).kind, 'proposal');

  const resetApplied = await sendChat('confirm');
  assert.equal(resetApplied.status, 200);
  assert.equal((resetApplied.jsonBody as any).kind, 'applied');
};

test('who is available in march query is normalized across punctuation/case', async () => {
  process.env.STORAGE_MODE = 'local';
  await resetState();

  const uppercaseQuestion = await sendChat('Who is available in March?');
  const lowercase = await sendChat('who is available in march');

  assert.equal((uppercaseQuestion.jsonBody as any).kind, 'reply');
  assert.equal((lowercase.jsonBody as any).kind, 'reply');
  assert.equal((uppercaseQuestion.jsonBody as any).assistantText, (lowercase.jsonBody as any).assistantText);
});

test('mutations still require confirm', async () => {
  process.env.STORAGE_MODE = 'local';
  await resetState();

  const addResponse = await sendChat('add appt Team sync');
  assert.equal(addResponse.status, 200);
  assert.equal((addResponse.jsonBody as any).kind, 'proposal');
});

test('delete APPT-1 still parses as mutation proposal', async () => {
  process.env.STORAGE_MODE = 'local';
  await resetState();

  const deleteResponse = await sendChat('delete APPT-1');
  assert.equal(deleteResponse.status, 200);
  assert.equal((deleteResponse.jsonBody as any).kind, 'proposal');
});
