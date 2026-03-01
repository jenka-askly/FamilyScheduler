import test from 'node:test';
import assert from 'node:assert/strict';

import { REQUIRED_TABLES } from './tablesClient.js';

test('REQUIRED_TABLES includes GroupInviteTokens', () => {
  assert.equal(REQUIRED_TABLES.includes('GroupInviteTokens'), true);
});
