import { randomBytes, randomUUID } from 'node:crypto';
import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { MissingConfigError } from '../lib/errors/configError.js';
import { errorResponse, logConfigMissing } from '../lib/http/errorResponse.js';
import { createEmptyAppState } from '../lib/state.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { isPlausibleEmail, normalizeEmail } from '../lib/auth/requireMembership.js';

type CreateGroupBody = { groupName?: unknown; groupKey?: unknown; creatorEmail?: unknown; creatorName?: unknown; traceId?: unknown };

const badRequest = (message: string, traceId: string): HttpResponseInit => ({ status: 400, jsonBody: { ok: false, error: 'bad_request', message, traceId } });

const newPersonId = (): string => `P-${randomBytes(2).toString('hex').toUpperCase()}`;

export async function groupCreate(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as CreateGroupBody;
  const traceId = typeof body.traceId === 'string' && body.traceId.trim() ? body.traceId.trim() : randomUUID();
  const groupName = typeof body.groupName === 'string' ? body.groupName.trim().replace(/\s+/g, ' ') : '';
  const groupKey = typeof body.groupKey === 'string' ? body.groupKey.trim() : '';

  if (!groupName) return badRequest('groupName is required', traceId);
  if (groupName.length > 60) return badRequest('groupName must be 60 characters or less', traceId);
  if (!/^\d{6}$/.test(groupKey)) return badRequest('groupKey must be exactly 6 digits', traceId);
  if (typeof body.creatorEmail !== 'string') return badRequest('creatorEmail is required', traceId);
  if (!isPlausibleEmail(body.creatorEmail)) return badRequest('creatorEmail is invalid', traceId);
  const creatorEmail = normalizeEmail(body.creatorEmail);
  const creatorName = typeof body.creatorName === 'string' ? body.creatorName.trim().replace(/\s+/g, ' ') : '';
  if (!creatorName) return badRequest('creatorName is required', traceId);
  if (creatorName.length > 40) return badRequest('creatorName must be 40 characters or less', traceId);

  const groupId = randomUUID();
  const now = new Date().toISOString();
  const creatorPersonId = newPersonId();
  const state = createEmptyAppState(groupId, groupName);
  state.createdAt = now;
  state.updatedAt = now;
  state.people = [{ personId: creatorPersonId, name: creatorName, cellE164: '', cellDisplay: '', status: 'active', createdAt: now, timezone: process.env.TZ ?? 'America/Los_Angeles', notes: '' }];
  state.members = [{ memberId: creatorPersonId, email: creatorEmail, status: 'active', joinedAt: now }];

  try {
    const storage = createStorageAdapter();
    await storage.initIfMissing(groupId, state);
  } catch (error) {
    if (error instanceof MissingConfigError) {
      logConfigMissing('groupCreate', traceId, error.missing);
      return errorResponse(500, 'CONFIG_MISSING', error.message, traceId, { missing: error.missing });
    }
    throw error;
  }
  context.debug('group_create_success', { traceId, groupId, peopleCount: state.people.length });
  return { status: 200, jsonBody: { groupId, groupName, creatorPersonId, linkPath: `/#/g/${groupId}` } };
}
