import { randomUUID } from 'node:crypto';
import { getContainerClient } from '../storage/blobClients.js';

export const EVENTS_DIR = 'events';
export const EVENTS_CHUNK_SIZE = 200;

const DEFAULT_STATE_BLOB_PREFIX = 'familyscheduler/groups';
const DEFAULT_MAX_RETRIES = 4;

export type AppointmentEventType =
  | 'USER_MESSAGE'
  | 'SYSTEM_CONFIRMATION'
  | 'FIELD_CHANGED'
  | 'PROPOSAL_CREATED'
  | 'PROPOSAL_CANCELED'
  | 'RECONCILIATION_CHANGED'
  | 'CONSTRAINT_ADDED'
  | 'CONSTRAINT_REMOVED'
  | 'SUGGESTION_CREATED'
  | 'SUGGESTION_APPLIED'
  | 'NOTIFICATION_SENT';

export type AppointmentEvent = {
  id: string;
  tsUtc: string;
  type: AppointmentEventType;
  actor: { actorType: 'HUMAN' | 'SYSTEM' | 'AGENT'; userKey?: string; email?: string };
  payload: Record<string, unknown>;
  sourceMessageId?: string;
  sourceTextSnapshot?: string;
  clientRequestId?: string;
  proposalId?: string;
};

export type EventCursor = { chunkId: number; index: number };

const padChunkId = (chunkId: number): string => chunkId.toString().padStart(6, '0');

const parseChunkId = (blobName: string): number => {
  const match = blobName.match(/\/(\d{6})\.json$/);
  return match ? Number(match[1]) : 0;
};

const streamToText = async (readable: NodeJS.ReadableStream): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of readable) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf-8');
};

const env = () => ({
  connectionString: process.env.AzureWebJobsStorage?.trim() || '',
  accountUrl: process.env.AZURE_STORAGE_ACCOUNT_URL?.trim() || '',
  containerName: (process.env.AZURE_STORAGE_CONTAINER ?? process.env.STATE_CONTAINER)?.trim() || '',
  stateBlobPrefix: process.env.STATE_BLOB_PREFIX?.trim() || DEFAULT_STATE_BLOB_PREFIX
});

const eventChunkBlobName = (groupId: string, appointmentId: string, chunkId: number): string => `${env().stateBlobPrefix}/${groupId}/appointments/${appointmentId}/${EVENTS_DIR}/${padChunkId(chunkId)}.json`;
const eventsPrefix = (groupId: string, appointmentId: string): string => `${env().stateBlobPrefix}/${groupId}/appointments/${appointmentId}/${EVENTS_DIR}/`;

const createContainerClient = () => {
  const cfg = env();
  return getContainerClient({
    connectionString: cfg.connectionString,
    accountUrl: cfg.accountUrl,
    containerName: cfg.containerName
  });
};

const isHttpStatus = (error: unknown, statuses: number[]): boolean => {
  const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error ? Number((error as { statusCode?: unknown }).statusCode) : NaN;
  return Number.isFinite(statusCode) && statuses.includes(statusCode);
};

const readChunkWithMeta = async (groupId: string, appointmentId: string, chunkId: number): Promise<{ events: AppointmentEvent[]; etag: string | null; exists: boolean }> => {
  const container = createContainerClient();
  const client = container.getBlockBlobClient(eventChunkBlobName(groupId, appointmentId, chunkId));
  try {
    const response = await client.download();
    if (!response.readableStreamBody) return { events: [], etag: null, exists: true };
    const raw = await streamToText(response.readableStreamBody);
    const parsed = JSON.parse(raw);
    return { events: Array.isArray(parsed) ? parsed as AppointmentEvent[] : [], etag: response.etag ?? null, exists: true };
  } catch (error) {
    if (isHttpStatus(error, [404])) return { events: [], etag: null, exists: false };
    throw error;
  }
};

const uploadChunk = async (groupId: string, appointmentId: string, chunkId: number, events: AppointmentEvent[], expectedEtag: string | null): Promise<boolean> => {
  const container = createContainerClient();
  const client = container.getBlockBlobClient(eventChunkBlobName(groupId, appointmentId, chunkId));
  const body = Buffer.from(`${JSON.stringify(events, null, 2)}\n`, 'utf-8');
  try {
    await client.uploadData(body, {
      blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
      conditions: expectedEtag ? { ifMatch: expectedEtag } : { ifNoneMatch: '*' }
    });
    return true;
  } catch (error) {
    if (isHttpStatus(error, [409, 412])) return false;
    throw error;
  }
};

export async function listEventChunks(groupId: string, appointmentId: string): Promise<string[]> {
  const container = createContainerClient();
  const prefix = eventsPrefix(groupId, appointmentId);
  const names: string[] = [];
  for await (const blob of container.listBlobsFlat({ prefix })) {
    if (blob.name.endsWith('.json')) names.push(blob.name);
  }
  return names.sort((a, b) => parseChunkId(a) - parseChunkId(b));
}

export async function readEventChunk(groupId: string, appointmentId: string, chunkId: number): Promise<AppointmentEvent[]> {
  const chunk = await readChunkWithMeta(groupId, appointmentId, chunkId);
  return chunk.events;
}

export async function appendEvent(
  groupId: string,
  appointmentId: string,
  event: AppointmentEvent,
  options: { idempotencyKey?: string }
): Promise<{ appended: boolean; event: AppointmentEvent; chunkId: number }> {
  const idempotencyKey = options.idempotencyKey?.trim();
  const eventToAppend = { ...event, id: event.id || randomUUID(), tsUtc: event.tsUtc || new Date().toISOString() };

  for (let attempt = 1; attempt <= DEFAULT_MAX_RETRIES; attempt += 1) {
    const chunks = await listEventChunks(groupId, appointmentId);
    const latestChunkId = chunks.length ? parseChunkId(chunks[chunks.length - 1]) : 1;
    const latest = await readChunkWithMeta(groupId, appointmentId, latestChunkId);

    if (idempotencyKey && latest.events.some((entry) => entry.clientRequestId === idempotencyKey)) {
      return { appended: false, event: eventToAppend, chunkId: latestChunkId };
    }

    if (!latest.exists || latest.events.length < EVENTS_CHUNK_SIZE) {
      const nextEvents = [...latest.events, eventToAppend];
      const ok = await uploadChunk(groupId, appointmentId, latestChunkId, nextEvents, latest.etag);
      if (ok) return { appended: true, event: eventToAppend, chunkId: latestChunkId };
      continue;
    }

    const nextChunkId = latestChunkId + 1;
    const ok = await uploadChunk(groupId, appointmentId, nextChunkId, [eventToAppend], null);
    if (ok) return { appended: true, event: eventToAppend, chunkId: nextChunkId };
  }

  throw new Error('Failed to append appointment event due to repeated conflicts');
}

export async function getRecentEvents(
  groupId: string,
  appointmentId: string,
  limit: number,
  cursor?: EventCursor
): Promise<{ events: AppointmentEvent[]; nextCursor: EventCursor | null }> {
  const chunks = await listEventChunks(groupId, appointmentId);
  if (chunks.length === 0) return { events: [], nextCursor: null };

  let chunkPos = cursor ? chunks.findIndex((name) => parseChunkId(name) === cursor.chunkId) : chunks.length - 1;
  if (chunkPos < 0) chunkPos = chunks.length - 1;

  let upperBound = cursor ? cursor.index : Number.MAX_SAFE_INTEGER;
  const page: AppointmentEvent[] = [];
  let nextCursor: EventCursor | null = null;

  while (chunkPos >= 0 && page.length < limit) {
    const chunkId = parseChunkId(chunks[chunkPos]);
    const events = await readEventChunk(groupId, appointmentId, chunkId);
    const start = Math.min(upperBound, events.length);
    for (let idx = start - 1; idx >= 0 && page.length < limit; idx -= 1) {
      page.push(events[idx]);
      nextCursor = { chunkId, index: idx };
    }
    chunkPos -= 1;
    upperBound = Number.MAX_SAFE_INTEGER;
  }

  return {
    events: page,
    nextCursor: (chunkPos >= 0 || (nextCursor && nextCursor.index > 0)) ? nextCursor : null
  };
}

export async function hasLatestChunkIdempotencyKey(groupId: string, appointmentId: string, clientRequestId: string): Promise<boolean> {
  const chunks = await listEventChunks(groupId, appointmentId);
  if (chunks.length === 0) return false;
  const latestChunkId = parseChunkId(chunks[chunks.length - 1]);
  const latest = await readChunkWithMeta(groupId, appointmentId, latestChunkId);
  return latest.events.some((entry) => entry.clientRequestId === clientRequestId);
}
