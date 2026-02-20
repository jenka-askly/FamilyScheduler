import { randomUUID } from 'node:crypto';
import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { MissingConfigError } from '../lib/errors/configError.js';
import { errorResponse, logConfigMissing } from '../lib/http/errorResponse.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';

export async function groupMeta(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = randomUUID();
  const groupId = new URL(request.url).searchParams.get('groupId')?.trim() ?? '';
  if (!groupId) return errorResponse(400, 'groupId_required', 'groupId is required', traceId);

  try {
    const storage = createStorageAdapter();
    const loaded = await storage.load(groupId);
    return {
      status: 200,
      jsonBody: {
        ok: true,
        groupId: loaded.state.groupId,
        groupName: loaded.state.groupName
      }
    };
  } catch (error) {
    if (error instanceof MissingConfigError) {
      logConfigMissing('groupMeta', traceId, error.missing);
      return errorResponse(500, 'CONFIG_MISSING', error.message, traceId, { missing: error.missing });
    }
    if (error instanceof GroupNotFoundError) return errorResponse(404, 'group_not_found', 'Group not found', traceId);
    throw error;
  }
}
