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

test('clarification reply fills missing personName for list availability', async () => {
  process.env.STORAGE_MODE = 'local';
  await resetState();

  const mark = await sendChat('mark Joe unavailable 2026-03-10 10:00-11:00 busy');
  assert.equal((mark.jsonBody as any).kind, 'proposal');
  const markApplied = await sendChat('confirm');
  assert.equal((markApplied.jsonBody as any).kind, 'applied');

  const clarify = await sendChat('list my availability');
  assert.equal((clarify.jsonBody as any).kind, 'clarify');
  assert.equal((clarify.jsonBody as any).question, 'Whose availability?');

  const resolved = await sendChat('Joe');
  assert.equal((resolved.jsonBody as any).kind, 'reply');
  assert.match((resolved.jsonBody as any).assistantText, /AVL-JOE-1/);
});

test('I am Joe sets identity immediately', async () => {
  process.env.STORAGE_MODE = 'local';
  await resetState();

  const response = await sendChat('I am Joe');
  assert.equal((response.jsonBody as any).kind, 'reply');
  assert.equal((response.jsonBody as any).assistantText, 'Got it. You are Joe.');
});

test('cancel clears pending clarification', async () => {
  process.env.STORAGE_MODE = 'local';
  await resetState();

  const clarify = await sendChat('list my availability');
  assert.equal((clarify.jsonBody as any).kind, 'clarify');

  const cancelled = await sendChat('cancel');
  assert.equal((cancelled.jsonBody as any).kind, 'reply');
  assert.equal((cancelled.jsonBody as any).assistantText, 'Cancelled.');

  const next = await sendChat('Joe');
  assert.equal((next.jsonBody as any).kind, 'reply');
  assert.equal((next.jsonBody as any).assistantText, 'Natural language parsing is disabled. Try commands: help');
});
