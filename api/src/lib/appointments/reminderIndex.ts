import { getContainerClient } from '../storage/blobClients.js';

const DEFAULT_STATE_BLOB_PREFIX = 'familyscheduler/groups';
const DEFAULT_REMINDER_INDEX_PREFIX = 'familyscheduler/reminder-index';

export type ReminderIndexEntry = {
  reminderId: string;
  groupId: string;
  appointmentId: string;
  dueAtIso: string;
};

const env = () => ({
  connectionString: process.env.AzureWebJobsStorage?.trim() || '',
  accountUrl: process.env.AZURE_STORAGE_ACCOUNT_URL?.trim() || '',
  containerName: (process.env.AZURE_STORAGE_CONTAINER ?? process.env.STATE_CONTAINER)?.trim() || '',
  stateBlobPrefix: process.env.STATE_BLOB_PREFIX?.trim() || DEFAULT_STATE_BLOB_PREFIX,
  reminderIndexPrefix: process.env.REMINDER_INDEX_BLOB_PREFIX?.trim() || DEFAULT_REMINDER_INDEX_PREFIX
});

const reminderBucket = (iso: string): string => iso.slice(0, 16).replace(':', '');
const reminderBlobName = (iso: string): string => `${env().reminderIndexPrefix}/${reminderBucket(iso)}.json`;

const streamToText = async (readable: NodeJS.ReadableStream): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of readable) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf-8');
};

const isHttpStatus = (error: unknown, statuses: number[]): boolean => {
  const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error ? Number((error as { statusCode?: unknown }).statusCode) : NaN;
  return Number.isFinite(statusCode) && statuses.includes(statusCode);
};

const readEntries = async (blobName: string): Promise<ReminderIndexEntry[]> => {
  const cfg = env();
  const container = getContainerClient({ connectionString: cfg.connectionString, accountUrl: cfg.accountUrl, containerName: cfg.containerName });
  const blob = container.getBlockBlobClient(blobName);
  try {
    const res = await blob.download();
    if (!res.readableStreamBody) return [];
    const parsed = JSON.parse(await streamToText(res.readableStreamBody));
    return Array.isArray(parsed) ? parsed as ReminderIndexEntry[] : [];
  } catch (error) {
    if (isHttpStatus(error, [404])) return [];
    throw error;
  }
};

const writeEntries = async (blobName: string, entries: ReminderIndexEntry[]): Promise<void> => {
  const cfg = env();
  const container = getContainerClient({ connectionString: cfg.connectionString, accountUrl: cfg.accountUrl, containerName: cfg.containerName });
  const blob = container.getBlockBlobClient(blobName);
  await blob.uploadData(Buffer.from(`${JSON.stringify(entries, null, 2)}\n`, 'utf-8'), {
    blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' }
  });
};

export const addReminderIndexEntry = async (entry: ReminderIndexEntry): Promise<void> => {
  const blobName = reminderBlobName(entry.dueAtIso);
  const existing = await readEntries(blobName);
  if (existing.some((item) => item.reminderId === entry.reminderId && item.groupId === entry.groupId && item.appointmentId === entry.appointmentId)) return;
  existing.push(entry);
  await writeEntries(blobName, existing);
};

export const removeReminderIndexEntry = async (entry: ReminderIndexEntry): Promise<void> => {
  const blobName = reminderBlobName(entry.dueAtIso);
  const existing = await readEntries(blobName);
  const next = existing.filter((item) => !(item.reminderId === entry.reminderId && item.groupId === entry.groupId && item.appointmentId === entry.appointmentId));
  if (next.length === existing.length) return;
  await writeEntries(blobName, next);
};

export const listDueReminderIndexEntries = async (dueIsos: string[]): Promise<ReminderIndexEntry[]> => {
  const all = await Promise.all(dueIsos.map(async (iso) => readEntries(reminderBlobName(iso))));
  return all.flat();
};
