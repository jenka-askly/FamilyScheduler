import test from 'node:test';
import assert from 'node:assert/strict';
import { groupInviteEmail } from './groupInviteEmail.js';

test('groupInviteEmail returns 400 for invalid email format', async () => {
  const response = await groupInviteEmail({
    json: async () => ({ groupId: 'g1', recipientEmail: 'bad-email' })
  } as any, {} as any);

  assert.equal(response.status, 400);
  const body = response.jsonBody as any;
  assert.equal(body.error, 'invalid_email');
});
