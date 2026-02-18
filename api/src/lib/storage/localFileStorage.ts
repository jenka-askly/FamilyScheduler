import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEmptyAppState, type AppState } from '../state.js';
import { ConflictError, type StorageAdapter } from './storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const API_DIR = path.resolve(__dirname, '../../..');
const REPO_ROOT = path.resolve(API_DIR, '..');
const DEFAULT_LOCAL_STATE_PATH = './.local/state.json';

const stableStringify = (value: AppState): string => `${JSON.stringify(value, null, 2)}\n`;

const computeEtag = (contents: string): string => createHash('sha256').update(contents).digest('hex');

const resolveStatePath = (): string => {
  const configuredPath = process.env.LOCAL_STATE_PATH ?? DEFAULT_LOCAL_STATE_PATH;
  return path.isAbsolute(configuredPath) ? configuredPath : path.resolve(REPO_ROOT, configuredPath);
};

const readStateFile = async (filePath: string): Promise<{ state: AppState; raw: string; etag: string }> => {
  const raw = await fs.readFile(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as AppState;
  return {
    state: parsed,
    raw,
    etag: computeEtag(raw)
  };
};

export class LocalFileStorage implements StorageAdapter {
  private readonly filePath: string;

  constructor() {
    this.filePath = resolveStatePath();
  }

  async initIfMissing(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });

    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, stableStringify(createEmptyAppState()), 'utf-8');
    }
  }

  async getState(): Promise<{ state: AppState; etag: string }> {
    await this.initIfMissing();
    const loaded = await readStateFile(this.filePath);

    return {
      state: loaded.state,
      etag: loaded.etag
    };
  }

  async putState(nextState: AppState, expectedEtag: string): Promise<{ state: AppState; etag: string }> {
    await this.initIfMissing();

    const current = await readStateFile(this.filePath);

    if (current.etag !== expectedEtag) {
      throw new ConflictError('State changed during update');
    }

    const nextContents = stableStringify(nextState);
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;

    await fs.writeFile(tempPath, nextContents, 'utf-8');
    await fs.rename(tempPath, this.filePath);

    return {
      state: nextState,
      etag: computeEtag(nextContents)
    };
  }
}

export const createStorageAdapter = (): StorageAdapter => {
  const storageMode = process.env.STORAGE_MODE ?? 'local';

  if (storageMode !== 'local') {
    throw new Error(`Unsupported STORAGE_MODE: ${storageMode}`);
  }

  return new LocalFileStorage();
};
