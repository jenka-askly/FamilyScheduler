import { MissingConfigError } from '../errors/configError.js';
import { AzureBlobStorage } from './azureBlobStorage.js';
import type { StorageAdapter } from './storage.js';

const DEFAULT_STATE_BLOB_PREFIX = 'familyscheduler/groups';

let singleton: StorageAdapter | null = null;
let testOverride: StorageAdapter | null = null;

const readConfig = (): { connectionString: string; accountUrl: string; containerName: string; stateBlobPrefix: string } => {
  const containerName = process.env.STATE_CONTAINER?.trim() || '';
  const connectionString = process.env.AzureWebJobsStorage?.trim() || '';
  const accountUrl = process.env.AZURE_STORAGE_ACCOUNT_URL?.trim() || process.env.STORAGE_ACCOUNT_URL?.trim() || '';
  const missing: string[] = [];
  if (!containerName) missing.push('STATE_CONTAINER');
  if (!connectionString && !accountUrl) missing.push('AzureWebJobsStorage|AZURE_STORAGE_ACCOUNT_URL');
  if (missing.length > 0) throw new MissingConfigError(missing);

  return {
    connectionString,
    accountUrl,
    containerName,
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

export { MissingConfigError };
