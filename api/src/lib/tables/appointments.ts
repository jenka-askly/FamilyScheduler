import { createStorageAdapter } from '../storage/storageFactory.js';

const streamToText = async (readable: NodeJS.ReadableStream): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of readable) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf-8');
};

const prefix = (): string => process.env.STATE_BLOB_PREFIX?.trim() || 'familyscheduler/groups';

export const appointmentJsonBlobPath = (groupId: string, appointmentId: string): string => `${prefix()}/${groupId}/appointments/${appointmentId}/appointment.json`;

export const putAppointmentJson = async (groupId: string, appointmentId: string, payload: Record<string, unknown>): Promise<void> => {
  const storage = createStorageAdapter();
  if (!storage.putBinary) throw new Error('Storage adapter missing putBinary');
  const body = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  await storage.putBinary(appointmentJsonBlobPath(groupId, appointmentId), body, 'application/json; charset=utf-8');
};

export const getAppointmentJson = async (groupId: string, appointmentId: string): Promise<Record<string, unknown> | null> => {
  const storage = createStorageAdapter();
  if (!storage.getBinary) throw new Error('Storage adapter missing getBinary');
  try {
    const blob = await storage.getBinary(appointmentJsonBlobPath(groupId, appointmentId));
    const text = await streamToText(blob.stream);
    return JSON.parse(text) as Record<string, unknown>;
  } catch (error) {
    const status = typeof error === 'object' && error !== null && 'statusCode' in error ? Number((error as { statusCode?: unknown }).statusCode) : NaN;
    if (status === 404) return null;
    throw error;
  }
};
