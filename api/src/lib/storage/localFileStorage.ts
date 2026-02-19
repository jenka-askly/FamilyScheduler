import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEmptyAppState, normalizeAppState, type AppState } from '../state.js';
import { ConflictError, type StorageAdapter } from './storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const API_DIR = path.resolve(__dirname, '../../..');
const REPO_ROOT = path.resolve(API_DIR, '..');
const DEFAULT_LOCAL_STATE_PREFIX = './.localstate/familyscheduler/groups';
const DEFAULT_STATE_BLOB_PREFIX = 'familyscheduler/groups';

const stableStringify = (value: AppState): string => `${JSON.stringify(value, null, 2)}\n`;
const computeEtag = (contents: string): string => createHash('sha256').update(contents).digest('hex');

const sanitizeGroupId = (groupId: string): string => {
  const trimmed = groupId.trim();
  if (!trimmed) throw new Error('groupId is required');
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) throw new Error('groupId is invalid');
  return trimmed;
};

const resolvePrefixPath = (): string => {
  if (process.env.LOCAL_STATE_PREFIX) {
    return path.isAbsolute(process.env.LOCAL_STATE_PREFIX) ? process.env.LOCAL_STATE_PREFIX : path.resolve(REPO_ROOT, process.env.LOCAL_STATE_PREFIX);
  }

  const blobPrefix = process.env.STATE_BLOB_PREFIX ?? DEFAULT_STATE_BLOB_PREFIX;
  const relative = `.localstate/${blobPrefix}`;
  return path.resolve(REPO_ROOT, relative);
};

const readStateFile = async (filePath: string): Promise<{ state: AppState; raw: string; etag: string }> => {
  const raw = await fs.readFile(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as AppState;
  return { state: normalizeAppState(parsed), raw, etag: computeEtag(raw) };
};

export class LocalFileStorage implements StorageAdapter {
  private readonly prefixPath: string;

  constructor() {
    this.prefixPath = process.env.LOCAL_STATE_PREFIX
      ? resolvePrefixPath()
      : path.resolve(REPO_ROOT, DEFAULT_LOCAL_STATE_PREFIX);
  }

  private getStatePath(groupId: string): string {
    return path.join(this.prefixPath, sanitizeGroupId(groupId), 'state.json');
  }

  async initIfMissing(groupId: string, initialState?: AppState): Promise<void> {
    const filePath = this.getStatePath(groupId);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, stableStringify(normalizeAppState(initialState ?? createEmptyAppState(groupId))), 'utf-8');
    }
  }

  async load(groupId: string): Promise<{ state: AppState; etag: string }> {
    await this.initIfMissing(groupId);
    const loaded = await readStateFile(this.getStatePath(groupId));
    return { state: loaded.state, etag: loaded.etag };
  }

  async save(groupId: string, nextState: AppState, expectedEtag: string): Promise<{ state: AppState; etag: string }> {
    const filePath = this.getStatePath(groupId);
    await this.initIfMissing(groupId);
    const current = await readStateFile(filePath);
    if (current.etag !== expectedEtag) throw new ConflictError('State changed during update');

    const normalized = normalizeAppState({ ...nextState, groupId, updatedAt: new Date().toISOString() });
    const nextContents = stableStringify(normalized);
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tempPath, nextContents, 'utf-8');
    await fs.rename(tempPath, filePath);
    return { state: normalized, etag: computeEtag(nextContents) };
  }
}
