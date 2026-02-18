import { AzureBlobStorage } from './azureBlobStorage.js';
import { LocalFileStorage } from './localFileStorage.js';
import type { StorageAdapter } from './storage.js';

const validateAzureMode = (): void => {
  if (!process.env.BLOB_SAS_URL) {
    throw new Error('BLOB_SAS_URL is required when STORAGE_MODE=azure.');
  }
};

export const createStorageAdapter = (): StorageAdapter => {
  const storageMode = (process.env.STORAGE_MODE ?? 'local').toLowerCase();

  if (storageMode === 'local') {
    return new LocalFileStorage();
  }

  if (storageMode === 'azure') {
    validateAzureMode();
    return new AzureBlobStorage();
  }

  throw new Error(`Unsupported STORAGE_MODE: ${storageMode}. Expected one of: local, azure.`);
};
