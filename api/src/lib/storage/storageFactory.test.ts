import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorageAdapter, describeStorageTarget, setStorageAdapterForTests } from './storageFactory.js';

const clear = () => {
  delete process.env.STATE_CONTAINER;
  delete process.env.AzureWebJobsStorage;
  delete process.env.AZURE_STORAGE_ACCOUNT_URL;
  delete process.env.STORAGE_ACCOUNT_URL;
  setStorageAdapterForTests(null);
};

test.afterEach(() => clear());

test('requires container', () => {
  process.env.AzureWebJobsStorage = 'UseDevelopmentStorage=true';
  assert.throws(() => createStorageAdapter(), /STATE_CONTAINER/);
});

test('supports AzureWebJobsStorage precedence', () => {
  process.env.STATE_CONTAINER = 'state';
  process.env.AzureWebJobsStorage = 'UseDevelopmentStorage=true';
  process.env.AZURE_STORAGE_ACCOUNT_URL = 'https://fallback.example';
  assert.doesNotThrow(() => createStorageAdapter());
});

test('supports AAD fallback when connection string absent', () => {
  process.env.STATE_CONTAINER = 'state';
  process.env.AZURE_STORAGE_ACCOUNT_URL = 'https://fallback.example';
  assert.doesNotThrow(() => createStorageAdapter());
});


test('describeStorageTarget returns blobNameForGroup details', () => {
  process.env.STATE_CONTAINER = 'state';
  process.env.STATE_BLOB_PREFIX = 'custom/groups';
  process.env.AzureWebJobsStorage = 'UseDevelopmentStorage=true';

  const target = describeStorageTarget();
  assert.equal(target.storageMode, 'azure_connection_string');
  assert.equal(target.containerName, 'state');
  assert.equal(target.stateBlobPrefix, 'custom/groups');
  assert.equal(target.blobNameForGroup('group-123'), 'custom/groups/group-123/state.json');
});
