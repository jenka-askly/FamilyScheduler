import type { AppState } from '../state.js';

export interface StorageAdapter {
  getState(): Promise<{ state: AppState; etag: string }>;
  putState(nextState: AppState, expectedEtag: string): Promise<{ state: AppState; etag: string }>;
  initIfMissing(): Promise<void>;
}

export class ConflictError extends Error {
  constructor(message = 'State conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}
