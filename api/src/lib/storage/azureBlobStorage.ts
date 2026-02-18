import { createEmptyAppState, type AppState } from '../state.js';
import { ConflictError, type StorageAdapter } from './storage.js';

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';

const stableStringify = (value: AppState): string => `${JSON.stringify(value, null, 2)}\n`;

const normalizeEtag = (value: string | null): string => {
  if (!value) {
    return '';
  }

  return value.trim().replace(/^W\//i, '').replace(/^"|"$/g, '');
};

const formatIfMatch = (etag: string): string => (etag === '*' ? '*' : `"${normalizeEtag(etag)}"`);

const isBlobUrl = (sasUrl: string): boolean => {
  const [urlWithoutQuery] = sasUrl.split('?');
  return urlWithoutQuery.toLowerCase().endsWith('.json');
};

const toBlobUrl = (sasUrl: string, blobName: string): string => {
  if (isBlobUrl(sasUrl)) {
    return sasUrl;
  }

  const url = new URL(sasUrl);
  const trimmedPath = url.pathname.replace(/\/+$/, '');
  const encodedBlobName = blobName
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  url.pathname = `${trimmedPath}/${encodedBlobName}`;
  return url.toString();
};

const readErrorBody = async (response: Response): Promise<string> => {
  try {
    return (await response.text()).trim();
  } catch {
    return '';
  }
};

export class AzureBlobStorage implements StorageAdapter {
  private readonly blobUrl: string;

  constructor(options?: { sasUrl?: string; stateBlobName?: string }) {
    const sasUrl = options?.sasUrl ?? process.env.BLOB_SAS_URL;
    if (!sasUrl) {
      throw new Error('BLOB_SAS_URL is required when STORAGE_MODE=azure.');
    }

    const stateBlobName = options?.stateBlobName ?? process.env.STATE_BLOB_NAME ?? 'state.json';
    this.blobUrl = toBlobUrl(sasUrl, stateBlobName);
  }

  async initIfMissing(): Promise<void> {
    const response = await fetch(this.blobUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': JSON_CONTENT_TYPE,
        'If-None-Match': '*',
        'x-ms-blob-type': 'BlockBlob'
      },
      body: stableStringify(createEmptyAppState())
    });

    if (response.ok || response.status === 412) {
      return;
    }

    const detail = await readErrorBody(response);
    throw new Error(`Failed to initialize Azure blob state (${response.status}). ${detail}`.trim());
  }

  async getState(): Promise<{ state: AppState; etag: string }> {
    const response = await fetch(this.blobUrl, { method: 'GET' });

    if (response.status === 404) {
      await this.initIfMissing();
      const reloaded = await fetch(this.blobUrl, { method: 'GET' });

      if (!reloaded.ok) {
        const detail = await readErrorBody(reloaded);
        throw new Error(`Failed to read Azure blob state after initialization (${reloaded.status}). ${detail}`.trim());
      }

      return {
        state: (await reloaded.json()) as AppState,
        etag: normalizeEtag(reloaded.headers.get('etag'))
      };
    }

    if (!response.ok) {
      const detail = await readErrorBody(response);
      throw new Error(`Failed to read Azure blob state (${response.status}). ${detail}`.trim());
    }

    return {
      state: (await response.json()) as AppState,
      etag: normalizeEtag(response.headers.get('etag'))
    };
  }

  async putState(nextState: AppState, expectedEtag: string): Promise<{ state: AppState; etag: string }> {
    if (!expectedEtag || normalizeEtag(expectedEtag).length === 0) {
      throw new Error('Azure blob writes require expectedEtag.');
    }

    const response = await fetch(this.blobUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': JSON_CONTENT_TYPE,
        'If-Match': formatIfMatch(expectedEtag),
        'x-ms-blob-type': 'BlockBlob'
      },
      body: stableStringify(nextState)
    });

    if (response.status === 412 || response.status === 409) {
      const latestEtag = normalizeEtag(response.headers.get('etag'));
      throw new ConflictError(latestEtag ? `State changed during update (latest etag: ${latestEtag})` : 'State changed during update');
    }

    if (!response.ok) {
      const detail = await readErrorBody(response);
      throw new Error(`Failed to write Azure blob state (${response.status}). ${detail}`.trim());
    }

    return {
      state: nextState,
      etag: normalizeEtag(response.headers.get('etag'))
    };
  }
}
