import { createStorageAdapter } from '../storage/storageFactory.js';
import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient } from '@azure/storage-blob';

const streamToText = async (readable: NodeJS.ReadableStream): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of readable) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf-8');
};

const prefix = (): string => process.env.STATE_BLOB_PREFIX?.trim() || 'familyscheduler/groups';

const getBlobClient = (groupId: string, appointmentId: string) => {
  const accountUrl = process.env.AZURE_STORAGE_ACCOUNT_URL?.trim() || '';
  const containerName = process.env.AZURE_STORAGE_CONTAINER?.trim() || '';
  if (!accountUrl || !containerName) throw new Error('Missing Azure Blob config for appointment access');
  const service = new BlobServiceClient(accountUrl, new DefaultAzureCredential());
  return service.getContainerClient(containerName).getBlockBlobClient(appointmentJsonBlobPath(groupId, appointmentId));
};

export const appointmentJsonBlobPath = (groupId: string, appointmentId: string): string => `${prefix()}/${groupId}/appointments/${appointmentId}/appointment.json`;

export const putAppointmentJson = async (groupId: string, appointmentId: string, payload: Record<string, unknown>): Promise<void> => {
  const storage = createStorageAdapter();
  if (!storage.putBinary) throw new Error('Storage adapter missing putBinary');
  const body = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  await storage.putBinary(appointmentJsonBlobPath(groupId, appointmentId), body, 'application/json; charset=utf-8');
};

export const getAppointmentJson = async (groupId: string, appointmentId: string): Promise<Record<string, unknown> | null> => {
  const storage = createStorageAdapter();
  if (!storage.getBinary) throw new Error('Storage adapter missing getBinary');
  try {
    const blob = await storage.getBinary(appointmentJsonBlobPath(groupId, appointmentId));
    const text = await streamToText(blob.stream);
    return JSON.parse(text) as Record<string, unknown>;
  } catch (error) {
    const status = typeof error === 'object' && error !== null && 'statusCode' in error ? Number((error as { statusCode?: unknown }).statusCode) : NaN;
    if (status === 404) return null;
    throw error;
  }
};

export const getAppointmentJsonWithEtag = async (groupId: string, appointmentId: string): Promise<{ doc: Record<string, unknown> | null; etag: string | null }> => {
  const client = getBlobClient(groupId, appointmentId);
  try {
    const blob = await client.download();
    if (!blob.readableStreamBody) return { doc: null, etag: blob.etag ?? null };
    const text = await streamToText(blob.readableStreamBody);
    return { doc: JSON.parse(text) as Record<string, unknown>, etag: blob.etag ?? null };
  } catch (error) {
    const status = typeof error === 'object' && error !== null && 'statusCode' in error ? Number((error as { statusCode?: unknown }).statusCode) : NaN;
    if (status === 404) return { doc: null, etag: null };
    throw error;
  }
};

export const putAppointmentJsonWithEtag = async (groupId: string, appointmentId: string, payload: Record<string, unknown>, expectedEtag: string): Promise<boolean> => {
  const client = getBlobClient(groupId, appointmentId);
  const body = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  try {
    await client.uploadData(body, {
      blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
      conditions: { ifMatch: expectedEtag }
    });
    return true;
  } catch (error) {
    const status = typeof error === 'object' && error !== null && 'statusCode' in error ? Number((error as { statusCode?: unknown }).statusCode) : NaN;
    if (status === 409 || status === 412) return false;
    throw error;
  }
};
