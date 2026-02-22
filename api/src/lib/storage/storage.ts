import type { AppState } from '../state.js';

export interface StorageAdapter {
  load(groupId: string): Promise<{ state: AppState; etag: string }>;
  save(groupId: string, nextState: AppState, expectedEtag: string): Promise<{ state: AppState; etag: string }>;
  initIfMissing(groupId: string, initialState?: AppState): Promise<void>;
  putBinary?(blobName: string, bytes: Uint8Array | Buffer, contentType: string, metadata?: Record<string, string>): Promise<void>;
  getBinary?(blobName: string): Promise<{ contentType: string; contentLength?: number; stream: NodeJS.ReadableStream }>;
  deleteBlob?(blobName: string): Promise<void>;
}

export class ConflictError extends Error {
  constructor(message = 'State conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class GroupNotFoundError extends Error {
  constructor(message = 'Group not found') {
    super(message);
    this.name = 'GroupNotFoundError';
  }
}
