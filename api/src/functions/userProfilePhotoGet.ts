import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { HttpError, requireSessionFromRequest } from '../lib/auth/sessions.js';
import { errorResponse } from '../lib/http/errorResponse.js';
import { ensureTraceId } from '../lib/logging/authLogs.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { userProfilePhotoBlobKey } from '../lib/userProfilePhoto.js';

const isBlobNotFound = (error: unknown): boolean => {
  const details = error as { statusCode?: number; code?: string };
  return details?.statusCode === 404 || details?.code === 'BlobNotFound';
};

export async function userProfilePhotoGet(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
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
    const blob = await storage.getBinary(userProfilePhotoBlobKey(session.email));
    return {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000'
      },
      body: blob.stream as any
    };
  } catch (error) {
    if (isBlobNotFound(error)) return errorResponse(404, 'profile_photo_not_found', 'Profile photo not found', traceId);
    throw error;
  }
}
