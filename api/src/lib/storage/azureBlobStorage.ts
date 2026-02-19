import { createEmptyAppState, normalizeAppState, type AppState } from '../state.js';
import { ConflictError, GroupNotFoundError, type StorageAdapter } from './storage.js';

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';
const DEFAULT_STATE_BLOB_PREFIX = 'familyscheduler/groups';

const stableStringify = (value: AppState): string => `${JSON.stringify(value, null, 2)}\n`;
const normalizeEtag = (value: string | null): string => (value ? value.trim().replace(/^W\//i, '').replace(/^"|"$/g, '') : '');
const formatIfMatch = (etag: string): string => (etag === '*' ? '*' : `"${normalizeEtag(etag)}"`);

const readErrorBody = async (response: Response): Promise<string> => {
  try { return (await response.text()).trim(); } catch { return ''; }
};

const sanitizeGroupId = (groupId: string): string => {
  const trimmed = groupId.trim();
  if (!trimmed) throw new Error('groupId is required');
  if (trimmed.includes('/')) throw new Error('groupId is invalid');
  return trimmed;
};

const toBlobUrl = (sasUrl: string, blobName: string): string => {
  const url = new URL(sasUrl);
  const trimmedPath = url.pathname.replace(/\/+$/, '');
  const encodedBlobName = blobName.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  url.pathname = `${trimmedPath}/${encodedBlobName}`;
  return url.toString();
};

export class AzureBlobStorage implements StorageAdapter {
  private readonly sasUrl: string;
  private readonly stateBlobPrefix: string;

  constructor(options?: { sasUrl?: string; stateBlobPrefix?: string }) {
    const sasUrl = options?.sasUrl ?? process.env.BLOB_SAS_URL;
    if (!sasUrl) throw new Error('BLOB_SAS_URL is required when STORAGE_MODE=azure.');
    this.sasUrl = sasUrl;
    this.stateBlobPrefix = options?.stateBlobPrefix ?? process.env.STATE_BLOB_PREFIX ?? DEFAULT_STATE_BLOB_PREFIX;
  }

  private blobUrl(groupId: string): string {
    return toBlobUrl(this.sasUrl, `${this.stateBlobPrefix}/${sanitizeGroupId(groupId)}/state.json`);
  }

  async initIfMissing(groupId: string, initialState?: AppState): Promise<void> {
    const response = await fetch(this.blobUrl(groupId), {
      method: 'PUT',
      headers: { 'Content-Type': JSON_CONTENT_TYPE, 'If-None-Match': '*', 'x-ms-blob-type': 'BlockBlob' },
      body: stableStringify(normalizeAppState(initialState ?? createEmptyAppState(groupId)))
    });

    if (response.ok || response.status === 412 || response.status === 409) return;
    const detail = await readErrorBody(response);
    throw new Error(`Failed to initialize Azure blob state (${response.status}). ${detail}`.trim());
  }

  async load(groupId: string): Promise<{ state: AppState; etag: string }> {
    const blobUrl = this.blobUrl(groupId);
    const response = await fetch(blobUrl, { method: 'GET' });

    if (response.status === 404) throw new GroupNotFoundError();

    if (!response.ok) {
      const detail = await readErrorBody(response);
      throw new Error(`Failed to read Azure blob state (${response.status}). ${detail}`.trim());
    }

    return { state: normalizeAppState((await response.json()) as AppState), etag: normalizeEtag(response.headers.get('etag')) };
  }

  async save(groupId: string, nextState: AppState, expectedEtag: string): Promise<{ state: AppState; etag: string }> {
    if (!expectedEtag || normalizeEtag(expectedEtag).length === 0) throw new Error('Azure blob writes require expectedEtag.');
    const normalized = normalizeAppState({ ...nextState, groupId, updatedAt: new Date().toISOString() });
    const response = await fetch(this.blobUrl(groupId), {
      method: 'PUT',
      headers: { 'Content-Type': JSON_CONTENT_TYPE, 'If-Match': formatIfMatch(expectedEtag), 'x-ms-blob-type': 'BlockBlob' },
      body: stableStringify(normalized)
    });

    if (response.status === 412 || response.status === 409) throw new ConflictError('State changed during update');
    if (!response.ok) {
      const detail = await readErrorBody(response);
      throw new Error(`Failed to write Azure blob state (${response.status}). ${detail}`.trim());
    }

    return { state: normalized, etag: normalizeEtag(response.headers.get('etag')) };
  }
}
