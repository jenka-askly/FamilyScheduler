import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';

const storage = createStorageAdapter();

export async function groupMeta(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const groupId = new URL(request.url).searchParams.get('groupId')?.trim() ?? '';
  if (!groupId) return { status: 400, jsonBody: { ok: false, error: 'groupId_required' } };

  try {
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
    if (error instanceof GroupNotFoundError) return { status: 404, jsonBody: { ok: false, error: 'group_not_found' } };
    throw error;
  }
}
