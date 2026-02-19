import { promises as fs } from 'node:fs';
import path from 'node:path';

export const ensureDirExists = async (dir: string): Promise<void> => {
  await fs.mkdir(dir, { recursive: true });
};

const rotateIfNeeded = async (filePath: string, maxBytes: number): Promise<void> => {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) return;
  let stats;
  try {
    stats = await fs.stat(filePath);
  } catch {
    return;
  }
  if (stats.size <= maxBytes) return;

  const { dir, name, ext } = path.parse(filePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rotatedPath = path.join(dir, `${name}.${timestamp}${ext || '.ndjson'}`);
  await fs.rename(filePath, rotatedPath);
};

export const appendLine = async (filePath: string, obj: unknown): Promise<void> => {
  const maxBytes = Number(process.env.OPENAI_LOG_MAX_BYTES ?? '5242880');
  await rotateIfNeeded(filePath, maxBytes);
  await fs.appendFile(filePath, `${JSON.stringify(obj)}\n`, 'utf8');
};
