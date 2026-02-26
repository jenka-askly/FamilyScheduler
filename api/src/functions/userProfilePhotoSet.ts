import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { HttpError, requireSessionFromRequest } from '../lib/auth/sessions.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { userProfilePhotoBlobKey, userProfilePhotoMetaBlobKey } from '../lib/userProfilePhoto.js';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);

const extractFile = async (request: HttpRequest): Promise<File | null> => {
  const form = await request.formData();
  const value = form.get('file');
  return value instanceof File ? value : null;
};

export async function userProfilePhotoSet(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = ensureTraceId(new URL(request.url).searchParams.get('traceId'));

  let session;
  try {
    session = await requireSessionFromRequest(request, traceId);
  } catch (error) {
    if (error instanceof HttpError) return error.response;
    throw error;
  }

  const storage = createStorageAdapter();
  if (!storage.putBinary) return errorResponse(500, 'storage_missing_binary', 'Storage adapter missing putBinary', traceId);

  let file: File | null;
  try {
    file = await extractFile(request);
  } catch {
    return errorResponse(400, 'invalid_multipart', 'Expected multipart/form-data with file field', traceId);
  }

  if (!file) return errorResponse(400, 'missing_file', 'file is required', traceId);
  const mime = file.type.toLowerCase();
  if (!ALLOWED_TYPES.has(mime)) return errorResponse(400, 'invalid_image_mime', 'Only JPEG/PNG files are allowed', traceId);

  const bytes = Buffer.from(await file.arrayBuffer());
  const updatedAtUtc = new Date().toISOString();
  await storage.putBinary(userProfilePhotoBlobKey(session.email), bytes, 'image/jpeg', {
    kind: 'user-profile-photo',
    userId: session.email,
    updatedAtUtc,
    traceId
  });

  await storage.putBinary(userProfilePhotoMetaBlobKey(session.email), Buffer.from(JSON.stringify({ updatedAtUtc }), 'utf8'), 'application/json', {
    kind: 'user-profile-photo-meta',
    userId: session.email,
    updatedAtUtc,
    traceId
  });

  return { status: 200, jsonBody: { ok: true, updatedAtUtc, traceId } };
}
