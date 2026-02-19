import type { AppState } from '../state.js';

export interface StorageAdapter {
  load(groupId: string): Promise<{ state: AppState; etag: string }>;
  save(groupId: string, nextState: AppState, expectedEtag: string): Promise<{ state: AppState; etag: string }>;
  initIfMissing(groupId: string, initialState?: AppState): Promise<void>;
}

export class ConflictError extends Error {
  constructor(message = 'State conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}
