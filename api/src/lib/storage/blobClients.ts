import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';

export const getBlobServiceClient = (options: { connectionString?: string; accountUrl?: string }): BlobServiceClient => {
  const connectionString = options.connectionString?.trim() || '';
  const accountUrl = options.accountUrl?.trim() || '';
  if (connectionString) return BlobServiceClient.fromConnectionString(connectionString);
  if (accountUrl) return new BlobServiceClient(accountUrl, new DefaultAzureCredential());
  throw new Error('Missing blob config: set AzureWebJobsStorage or *_ACCOUNT_URL');
};

export const getContainerClient = (options: { connectionString?: string; accountUrl?: string; containerName?: string }): ContainerClient => {
  const containerName = options.containerName?.trim() || '';
  if (!containerName) throw new Error('Missing container name: set AZURE_STORAGE_CONTAINER or STATE_CONTAINER');
  return getBlobServiceClient(options).getContainerClient(containerName);
};
