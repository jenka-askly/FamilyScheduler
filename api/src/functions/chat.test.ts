import test from 'node:test';
import assert from 'node:assert/strict';
import { chat } from './chat.js';

const sendChat = async (message: string) => chat({ json: async () => ({ message }) } as any, {} as any);

const resetState = async () => {
  await sendChat('cancel');
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
  assert.deepEqual((addResponse.jsonBody as any).snapshot.appointments, []);
  assert.deepEqual((addResponse.jsonBody as any).snapshot.availability, []);
});

test('responses include snapshot and applied updates it', async () => {
  process.env.STORAGE_MODE = 'local';
  await resetState();

  const proposal = await sendChat('add appt Dentist');
  assert.equal((proposal.jsonBody as any).kind, 'proposal');
  assert.equal((proposal.jsonBody as any).snapshot.appointments.length, 0);

  const applied = await sendChat('confirm');
  assert.equal((applied.jsonBody as any).kind, 'applied');
  assert.equal((applied.jsonBody as any).snapshot.appointments.length, 1);
  assert.equal((applied.jsonBody as any).snapshot.appointments[0].title, 'Dentist');

  const clarify = await sendChat('list my availability');
  assert.equal((clarify.jsonBody as any).kind, 'clarify');
  assert.equal((clarify.jsonBody as any).snapshot.appointments.length, 1);
  assert.deepEqual((clarify.jsonBody as any).snapshot.availability, []);
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

test('identity is used for show my availability query', async () => {
  process.env.STORAGE_MODE = 'local';
  await resetState();

  const setIdentity = await sendChat('I am Joe');
  assert.equal((setIdentity.jsonBody as any).kind, 'reply');

  const mark = await sendChat('mark me unavailable 2026-03-10 10:00-11:00 busy');
  assert.equal((mark.jsonBody as any).kind, 'proposal');
  await sendChat('confirm');

  const showMine = await sendChat('show my availability');
  assert.equal((showMine.jsonBody as any).kind, 'reply');
  assert.match((showMine.jsonBody as any).assistantText, /AVL-JOE-1/);
});

test('missing identity triggers clarify and resolving personName executes query without setting identity', async () => {
  process.env.STORAGE_MODE = 'local';
  await resetState();

  const mark = await sendChat('mark Joe unavailable 2026-03-10 10:00-11:00 busy');
  assert.equal((mark.jsonBody as any).kind, 'proposal');
  await sendChat('confirm');

  const askMine = await sendChat('show my availability');
  assert.equal((askMine.jsonBody as any).kind, 'clarify');
  assert.equal((askMine.jsonBody as any).question, 'Whose availability?');

  const resolved = await sendChat('joe');
  assert.equal((resolved.jsonBody as any).kind, 'reply');
  assert.match((resolved.jsonBody as any).assistantText, /AVL-JOE-1/);

  const markMe = await sendChat('mark me unavailable 2026-03-11 10:00-11:00 busy');
  assert.equal((markMe.jsonBody as any).kind, 'proposal');
  assert.match((markMe.jsonBody as any).assistantText, /Mark me unavailable/i);
});

test('bare name without pending clarification does not set identity', async () => {
  process.env.STORAGE_MODE = 'local';
  await resetState();

  const bare = await sendChat('joe');
  assert.equal((bare.jsonBody as any).kind, 'reply');
  assert.equal((bare.jsonBody as any).assistantText, 'Natural language parsing is disabled. Try commands: help');

  const markMe = await sendChat('mark me unavailable 2026-03-12 10:00-11:00 busy');
  assert.equal((markMe.jsonBody as any).kind, 'proposal');
  assert.match((markMe.jsonBody as any).assistantText, /Mark me unavailable/i);
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


test('delete dentist clarify binds follow-up code and confirms deletion flow', async () => {
  process.env.STORAGE_MODE = 'local';
  await resetState();

  const addFirst = await sendChat('add appt Dentist');
  assert.equal((addFirst.jsonBody as any).kind, 'proposal');
  await sendChat('confirm');

  const addOther = await sendChat('add appt Team sync');
  assert.equal((addOther.jsonBody as any).kind, 'proposal');
  await sendChat('confirm');

  const addThird = await sendChat('add appt Dentist follow-up');
  assert.equal((addThird.jsonBody as any).kind, 'proposal');
  await sendChat('confirm');

  const clarify = await sendChat('Delete the dentist one');
  assert.equal((clarify.jsonBody as any).kind, 'clarify');
  assert.match((clarify.jsonBody as any).question, /APPT-1/);
  assert.match((clarify.jsonBody as any).question, /APPT-3/);

  const proposal = await sendChat('APPt1');
  assert.equal((proposal.jsonBody as any).kind, 'proposal');
  assert.match((proposal.jsonBody as any).assistantText, /delete APPT-1/i);

  const applied = await sendChat('confirm');
  assert.equal((applied.jsonBody as any).kind, 'applied');

  const list = await sendChat('list appointments');
  assert.equal((list.jsonBody as any).kind, 'reply');
  assert.doesNotMatch((list.jsonBody as any).assistantText, /APPT-1\s+—/);
  assert.match((list.jsonBody as any).assistantText, /APPT-3\s+—/);
});

test('clarification persists on invalid code replies', async () => {
  process.env.STORAGE_MODE = 'local';
  await resetState();

  await sendChat('add appt Dentist');
  await sendChat('confirm');
  await sendChat('add appt Dentist follow-up');
  await sendChat('confirm');

  const clarify = await sendChat('Delete the dentist one');
  assert.equal((clarify.jsonBody as any).kind, 'clarify');

  const nonsense = await sendChat('what?');
  assert.equal((nonsense.jsonBody as any).kind, 'clarify');
  assert.match((nonsense.jsonBody as any).question, /Which code should I use/i);
});

test('reschedule with flexible date defaults to all-day and confirms with contains confirm text', async () => {
  process.env.STORAGE_MODE = 'local';
  await resetState();

  await sendChat('add appt Dentist');
  await sendChat('confirm');

  const proposal = await sendChat('change appt1 to Feb 19 2026');
  assert.equal((proposal.jsonBody as any).kind, 'proposal');
  assert.match((proposal.jsonBody as any).assistantText, /Reschedule APPT-1 to 2026-02-19 \(all day\)\. Confirm\?/i);

  const applied = await sendChat('ok confirm');
  assert.equal((applied.jsonBody as any).kind, 'applied');
  assert.match((applied.jsonBody as any).assistantText, /Rescheduled APPT-1/i);
});

test('reschedule with morning maps to deterministic range', async () => {
  process.env.STORAGE_MODE = 'local';
  await resetState();

  await sendChat('add appt Dentist');
  await sendChat('confirm');

  const proposal = await sendChat('change appt1 to March 10 morning');
  assert.equal((proposal.jsonBody as any).kind, 'proposal');

  const applied = await sendChat('confirm please');
  assert.equal((applied.jsonBody as any).kind, 'applied');
  assert.match((applied.jsonBody as any).assistantText, /09:00–12:00/);
});

test('seattle time and la time resolve to same pacific timezone', async () => {
  process.env.STORAGE_MODE = 'local';
  await resetState();

  const response = await sendChat('Seattle time vs LA time');
  assert.equal((response.jsonBody as any).kind, 'reply');
  assert.equal((response.jsonBody as any).assistantText, 'Same Pacific timezone.');
});

test('show my appt lists appointments directly', async () => {
  process.env.STORAGE_MODE = 'local';
  await resetState();

  await sendChat('add appt Dentist');
  await sendChat('confirm');

  const listed = await sendChat('show my appt');
  assert.equal((listed.jsonBody as any).kind, 'reply');
  assert.match((listed.jsonBody as any).assistantText, /APPT-1 — Dentist/);
});

test('cancel keyword anywhere cancels pending proposal', async () => {
  process.env.STORAGE_MODE = 'local';
  await resetState();

  await sendChat('add appt Dentist');
  const cancelled = await sendChat('west coast cancel');
  assert.equal((cancelled.jsonBody as any).kind, 'reply');
  assert.equal((cancelled.jsonBody as any).assistantText, 'Cancelled.');
});
