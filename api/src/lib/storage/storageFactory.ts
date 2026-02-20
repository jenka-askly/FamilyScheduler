import { MissingConfigError } from '../errors/configError.js';
import { AzureBlobStorage } from './azureBlobStorage.js';
import type { StorageAdapter } from './storage.js';

const DEFAULT_STATE_BLOB_PREFIX = 'familyscheduler/groups';

let singleton: StorageAdapter | null = null;
let testOverride: StorageAdapter | null = null;

const required = ['STORAGE_ACCOUNT_URL', 'STATE_CONTAINER'] as const;

const readConfig = (): { accountUrl: string; containerName: string; stateBlobPrefix: string } => {
  const missing = required.filter((key) => !process.env[key] || process.env[key]?.trim().length === 0);
  if (missing.length > 0) throw new MissingConfigError(missing as string[]);

  return {
    accountUrl: process.env.STORAGE_ACCOUNT_URL!.trim(),
    containerName: process.env.STATE_CONTAINER!.trim(),
    stateBlobPrefix: process.env.STATE_BLOB_PREFIX?.trim() || DEFAULT_STATE_BLOB_PREFIX
  };
};

export const createStorageAdapter = (): StorageAdapter => {
  if (testOverride) return testOverride;
  if (singleton) return singleton;

  const config = readConfig();
  singleton = new AzureBlobStorage(config);
  return singleton;
};

export const setStorageAdapterForTests = (adapter: StorageAdapter | null): void => {
  testOverride = adapter;
  singleton = null;
};
