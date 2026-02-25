import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createIgniteGraceSession, requireSessionFromRequest, HttpError } from './sessions.js';
import { setStorageAdapterForTests } from '../storage/storageFactory.js';
import type { StorageAdapter } from '../storage/storage.js';

const sessionBlobByName = new Map<string, Buffer>();

const adapter: StorageAdapter = {
  async initIfMissing() {},
  async load() { throw new Error('not_implemented'); },
  async save() { throw new Error('not_implemented'); },
  async putBinary(blobName, bytes) {
    sessionBlobByName.set(blobName, Buffer.from(bytes));
  },
  async getBinary(blobName) {
    const found = sessionBlobByName.get(blobName);
    if (!found) {
      const err = new Error('BlobNotFound') as Error & { code?: string; statusCode?: number };
      err.code = 'BlobNotFound';
      err.statusCode = 404;
      throw err;
    }
    return { contentType: 'application/json', stream: Readable.from(found) };
  }
};

test.beforeEach(() => {
  sessionBlobByName.clear();
  setStorageAdapterForTests(adapter);
});

test.after(() => {
  setStorageAdapterForTests(null);
});

test('ignite grace session resolves for matching group in validity window', async () => {
  const created = await createIgniteGraceSession('person@example.com', 'group-1', 30, { scopeIgniteSessionId: 'ignite-1' });
  const request = { headers: new Headers({ 'x-session-id': created.sessionId }) } as any;

  const resolved = await requireSessionFromRequest(request, 'trace-1', { groupId: 'group-1' });

  assert.equal(resolved.email, 'person@example.com');
  assert.equal(resolved.kind, 'igniteGrace');
  assert.equal(resolved.scopeGroupId, 'group-1');
});

test('ignite grace session is rejected for scope mismatch', async () => {
  const created = await createIgniteGraceSession('person@example.com', 'group-1', 30);
  const request = { headers: new Headers({ 'x-session-id': created.sessionId }) } as any;

  await assert.rejects(
    () => requireSessionFromRequest(request, 'trace-2', { groupId: 'group-2' }),
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.response.status, 403);
      assert.equal((error.response.jsonBody as any)?.code, 'AUTH_SESSION_SCOPE_VIOLATION');
      return true;
    }
  );
});
