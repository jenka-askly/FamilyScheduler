import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { HttpError, requireSessionFromRequest } from '../lib/auth/sessions.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { userProfilePhotoMetaBlobKey } from '../lib/userProfilePhoto.js';

const streamToString = async (stream: NodeJS.ReadableStream): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
};

const isBlobNotFound = (error: unknown): boolean => {
  const details = error as { statusCode?: number; code?: string };
  return details?.statusCode === 404 || details?.code === 'BlobNotFound';
};

export async function userProfilePhotoMeta(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = ensureTraceId(new URL(request.url).searchParams.get('traceId'));

  let session;
  try {
    session = await requireSessionFromRequest(request, traceId);
  } catch (error) {
    if (error instanceof HttpError) return error.response;
    throw error;
  }

  const storage = createStorageAdapter();
  if (!storage.getBinary) return errorResponse(500, 'storage_missing_binary', 'Storage adapter missing getBinary', traceId);

  try {
    const metaBlob = await storage.getBinary(userProfilePhotoMetaBlobKey(session.email));
    const raw = await streamToString(metaBlob.stream);
    const parsed = JSON.parse(raw) as { updatedAtUtc?: string };
    return { status: 200, jsonBody: { ok: true, hasPhoto: true, updatedAtUtc: parsed.updatedAtUtc ?? '' } };
  } catch (error) {
    if (isBlobNotFound(error)) return { status: 200, jsonBody: { ok: true, hasPhoto: false } };
    throw error;
  }
}
