import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient } from '@azure/storage-blob';
import { createEmptyAppState, normalizeAppState, type AppState } from '../state.js';
import { ConflictError, GroupNotFoundError, type StorageAdapter } from './storage.js';

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';
const DEFAULT_STATE_BLOB_PREFIX = 'familyscheduler/groups';

const stableStringify = (value: AppState): string => `${JSON.stringify(value, null, 2)}\n`;

export const normalizeEtag = (value: string | null | undefined): string => (value ? value.trim().replace(/^W\//i, '').replace(/^"|"$/g, '') : '');
export const formatIfMatch = (etag: string): string => {
  if (etag === '*') return '*';
  const normalized = normalizeEtag(etag);
  if (!normalized) throw new Error('Azure blob writes require expectedEtag.');
  return `"${normalized}"`;
};

const sanitizeGroupId = (groupId: string): string => {
  const trimmed = groupId.trim();
  if (!trimmed) throw new Error('groupId is required');
  if (trimmed.includes('/')) throw new Error('groupId is invalid');
  return trimmed;
};

const isHttpStatus = (error: unknown, statuses: number[]): boolean => {
  const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
    ? Number((error as { statusCode?: unknown }).statusCode)
    : NaN;
  return Number.isFinite(statusCode) && statuses.includes(statusCode);
};

const streamToText = async (readable: NodeJS.ReadableStream): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of readable) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf-8');
};

export class AzureBlobStorage implements StorageAdapter {
  private readonly containerClient;
  private readonly stateBlobPrefix: string;

  constructor(options: { accountUrl: string; containerName: string; stateBlobPrefix?: string }) {
    const credential = new DefaultAzureCredential();
    const serviceClient = new BlobServiceClient(options.accountUrl, credential);
    this.containerClient = serviceClient.getContainerClient(options.containerName);
    this.stateBlobPrefix = options.stateBlobPrefix ?? DEFAULT_STATE_BLOB_PREFIX;
  }

  private blobName(groupId: string): string {
    return `${this.stateBlobPrefix}/${sanitizeGroupId(groupId)}/state.json`;
  }

  async initIfMissing(groupId: string, initialState?: AppState): Promise<void> {
    const blobClient = this.containerClient.getBlockBlobClient(this.blobName(groupId));
    const body = stableStringify(normalizeAppState(initialState ?? createEmptyAppState(groupId)));
    try {
      await blobClient.upload(body, Buffer.byteLength(body), {
        blobHTTPHeaders: { blobContentType: JSON_CONTENT_TYPE },
        conditions: { ifNoneMatch: '*' }
      });
    } catch (error) {
      if (isHttpStatus(error, [409, 412])) return;
      throw error;
    }
  }

  async load(groupId: string): Promise<{ state: AppState; etag: string }> {
    const blobClient = this.containerClient.getBlockBlobClient(this.blobName(groupId));
    try {
      const response = await blobClient.download();
      if (!response.readableStreamBody) throw new Error('Azure blob response missing body.');
      const raw = await streamToText(response.readableStreamBody);
      return { state: normalizeAppState(JSON.parse(raw) as AppState), etag: normalizeEtag(response.etag) };
    } catch (error) {
      if (isHttpStatus(error, [404])) throw new GroupNotFoundError();
      throw error;
    }
  }



  async putBinary(blobName: string, bytes: Uint8Array | Buffer, contentType: string, metadata?: Record<string, string>): Promise<void> {
    const blobClient = this.containerClient.getBlockBlobClient(blobName);
    await blobClient.uploadData(bytes, {
      blobHTTPHeaders: { blobContentType: contentType },
      metadata
    });
  }

  async getBinary(blobName: string): Promise<{ contentType: string; contentLength?: number; stream: NodeJS.ReadableStream }> {
    const blobClient = this.containerClient.getBlockBlobClient(blobName);
    const response = await blobClient.download();
    if (!response.readableStreamBody) throw new Error('Azure blob response missing body.');
    return {
      contentType: response.contentType ?? 'application/octet-stream',
      contentLength: response.contentLength,
      stream: response.readableStreamBody
    };
  }

  async deleteBlob(blobName: string): Promise<void> {
    const blobClient = this.containerClient.getBlockBlobClient(blobName);
    await blobClient.deleteIfExists();
  }

  async save(groupId: string, nextState: AppState, expectedEtag: string): Promise<{ state: AppState; etag: string }> {
    const normalized = normalizeAppState({ ...nextState, groupId, updatedAt: new Date().toISOString() });
    const body = stableStringify(normalized);
    const blobClient = this.containerClient.getBlockBlobClient(this.blobName(groupId));

    try {
      const response = await blobClient.upload(body, Buffer.byteLength(body), {
        blobHTTPHeaders: { blobContentType: JSON_CONTENT_TYPE },
        conditions: { ifMatch: formatIfMatch(expectedEtag) }
      });
      return { state: normalized, etag: normalizeEtag(response.etag) };
    } catch (error) {
      if (isHttpStatus(error, [409, 412])) throw new ConflictError('State changed during update');
      throw error;
    }
  }
}
