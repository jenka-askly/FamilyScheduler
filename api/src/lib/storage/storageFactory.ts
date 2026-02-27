import { MissingConfigError } from '../errors/configError.js';
import { AzureBlobStorage } from './azureBlobStorage.js';
import type { StorageAdapter } from './storage.js';

const DEFAULT_STATE_BLOB_PREFIX = 'familyscheduler/groups';

let singleton: StorageAdapter | null = null;
let testOverride: StorageAdapter | null = null;

export type StorageTarget = {
  storageMode: 'azure_connection_string' | 'azure_account_url' | 'unconfigured';
  accountUrl?: string;
  containerName?: string;
  stateBlobPrefix?: string;
  blobNameForGroup: (groupId: string) => string;
};

const sanitizeGroupId = (groupId: string): string => {
  const trimmed = groupId.trim();
  if (!trimmed) throw new Error('groupId is required');
  if (trimmed.includes('/')) throw new Error('groupId is invalid');
  return trimmed;
};

const readStorageTargetConfig = (): { connectionString: string; accountUrl: string; containerName: string; stateBlobPrefix: string } => ({
  containerName: process.env.STATE_CONTAINER?.trim() || '',
  connectionString: process.env.AzureWebJobsStorage?.trim() || '',
  accountUrl: process.env.AZURE_STORAGE_ACCOUNT_URL?.trim() || process.env.STORAGE_ACCOUNT_URL?.trim() || '',
  stateBlobPrefix: process.env.STATE_BLOB_PREFIX?.trim() || DEFAULT_STATE_BLOB_PREFIX
});

const readConfig = (): { connectionString: string; accountUrl: string; containerName: string; stateBlobPrefix: string } => {
  const { containerName, connectionString, accountUrl, stateBlobPrefix } = readStorageTargetConfig();
  const missing: string[] = [];
  if (!containerName) missing.push('STATE_CONTAINER');
  if (!connectionString && !accountUrl) missing.push('AzureWebJobsStorage|AZURE_STORAGE_ACCOUNT_URL');
  if (missing.length > 0) throw new MissingConfigError(missing);

  return {
    connectionString,
    accountUrl,
    containerName,
    stateBlobPrefix
  };
};

export const describeStorageTarget = (): StorageTarget => {
  const config = readStorageTargetConfig();
  return {
    storageMode: config.connectionString ? 'azure_connection_string' : (config.accountUrl ? 'azure_account_url' : 'unconfigured'),
    accountUrl: config.accountUrl || undefined,
    containerName: config.containerName || undefined,
    stateBlobPrefix: config.stateBlobPrefix || undefined,
    blobNameForGroup: (groupId: string): string => `${config.stateBlobPrefix}/${sanitizeGroupId(groupId)}/state.json`
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
