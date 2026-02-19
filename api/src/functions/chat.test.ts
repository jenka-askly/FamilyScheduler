import test from 'node:test';
import assert from 'node:assert/strict';
import { chat } from './chat.js';

type RouteMap = Record<string, unknown>;

const originalFetch = globalThis.fetch;

const sendChat = async (message: string, sessionId = 'test-session') => chat({
  json: async () => ({ message }),
  headers: { get: (name: string) => (name.toLowerCase() === 'x-session-id' ? sessionId : null) }
} as any, {} as any);

const installFetchStub = (routes: RouteMap): { calls: () => number } => {
  let count = 0;
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    count += 1;
    const body = JSON.parse(String(init?.body ?? '{}')) as { messages?: Array<{ content?: string }> };
    const prompt = body.messages?.[1]?.content ?? '';
    const inputMatch = prompt.match(/User input:\n([\s\S]*?)\n\nContext envelope:/);
    const input = inputMatch?.[1]?.trim() ?? '';
    const mapped = routes[input] ?? { kind: 'clarify', message: 'Could you clarify?' };
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(mapped) } }] })
    } as any;
  }) as typeof fetch;
  return { calls: () => count };
};

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.OPENAI_API_KEY;
});

test('acceptance: show my appt returns list reply', async () => {
  process.env.STORAGE_MODE = 'local';
  process.env.OPENAI_API_KEY = 'sk-test';
  installFetchStub({
    'reset state': { kind: 'proposal', message: 'Reset state', actions: [{ type: 'reset_state' }] },
    'add appt Dentist': { kind: 'proposal', message: 'Add Dentist', actions: [{ type: 'add_appointment', title: 'Dentist' }] },
    'show my appt': { kind: 'reply', message: 'Listing appointments', actions: [{ type: 'list_appointments' }] }
  });

  await sendChat('reset state');
  await sendChat('confirm');
  await sendChat('add appt Dentist');
  await sendChat('confirm');

  const listed = await sendChat('show my appt');
  assert.equal((listed.jsonBody as any).kind, 'reply');
  assert.match((listed.jsonBody as any).assistantText, /APPT-1 — Dentist/);
});

test('acceptance: update appt proposal then confirm applies', async () => {
  process.env.STORAGE_MODE = 'local';
  process.env.OPENAI_API_KEY = 'sk-test';
  installFetchStub({
    'reset state': { kind: 'proposal', message: 'Reset state', actions: [{ type: 'reset_state' }] },
    'add appt Dentist': { kind: 'proposal', message: 'Add Dentist', actions: [{ type: 'add_appointment', title: 'Dentist' }] },
    'update appt 1 date to March 3 2026 10-11': {
      kind: 'proposal',
      message: 'Reschedule APPT-1 to March 3, 2026 10-11.',
      actions: [{ type: 'reschedule_appointment', code: 'appt 1', start: '2026-03-03T10:00:00-08:00', end: '2026-03-03T11:00:00-08:00' }]
    }
  });

  await sendChat('reset state', 'session-2');
  await sendChat('confirm', 'session-2');
  await sendChat('add appt Dentist', 'session-2');
  await sendChat('confirm', 'session-2');

  const proposal = await sendChat('update appt 1 date to March 3 2026 10-11', 'session-2');
  assert.equal((proposal.jsonBody as any).kind, 'proposal');

  const applied = await sendChat('yes', 'session-2');
  assert.equal((applied.jsonBody as any).kind, 'applied');
  assert.match((applied.jsonBody as any).assistantText, /Rescheduled APPT-1/);
});

test('acceptance: pending proposal yes confirms deterministically without openai call', async () => {
  process.env.STORAGE_MODE = 'local';
  process.env.OPENAI_API_KEY = 'sk-test';
  const tracker = installFetchStub({
    'reset state': { kind: 'proposal', message: 'Reset state', actions: [{ type: 'reset_state' }] },
    'add appt Dentist': { kind: 'proposal', message: 'Add Dentist', actions: [{ type: 'add_appointment', title: 'Dentist' }] }
  });

  await sendChat('reset state', 'session-3');
  await sendChat('confirm', 'session-3');
  const proposal = await sendChat('add appt Dentist', 'session-3');
  assert.equal((proposal.jsonBody as any).kind, 'proposal');

  const before = tracker.calls();
  await sendChat('yes', 'session-3');
  assert.equal(tracker.calls(), before);
});

test('acceptance: random yes with no proposal asks clarify', async () => {
  process.env.STORAGE_MODE = 'local';
  process.env.OPENAI_API_KEY = 'sk-test';
  installFetchStub({});

  const response = await sendChat('yes', 'session-4');
  assert.equal((response.jsonBody as any).kind, 'clarify');
  assert.equal((response.jsonBody as any).question, 'What should I confirm?');
});

test('acceptance: unknown code returns clarify', async () => {
  process.env.STORAGE_MODE = 'local';
  process.env.OPENAI_API_KEY = 'sk-test';
  installFetchStub({
    'reset state': { kind: 'proposal', message: 'Reset state', actions: [{ type: 'reset_state' }] },
    'update appt 999 title to x': { kind: 'proposal', message: 'Update APPT-999', actions: [{ type: 'update_appointment_title', code: 'APPT-999', title: 'x' }] }
  });

  await sendChat('reset state', 'session-5');
  await sendChat('confirm', 'session-5');
  const response = await sendChat('update appt 999 title to x', 'session-5');
  assert.equal((response.jsonBody as any).kind, 'clarify');
  assert.match((response.jsonBody as any).question, /cannot find APPT-999/i);
});
