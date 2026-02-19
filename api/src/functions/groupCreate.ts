import { randomBytes, randomUUID } from 'node:crypto';
import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { createEmptyAppState } from '../lib/state.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { PhoneValidationError, validateAndNormalizePhone } from '../lib/validation/phone.js';

type CreateGroupBody = { groupName?: unknown; groupKey?: unknown; creatorPhone?: unknown; creatorName?: unknown };

const storage = createStorageAdapter();

const badRequest = (message: string): HttpResponseInit => ({ status: 400, jsonBody: { error: 'bad_request', message } });

const newPersonId = (): string => `P-${randomBytes(2).toString('hex').toUpperCase()}`;

export async function groupCreate(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as CreateGroupBody;
  const groupName = typeof body.groupName === 'string' ? body.groupName.trim().replace(/\s+/g, ' ') : '';
  const groupKey = typeof body.groupKey === 'string' ? body.groupKey.trim() : '';

  if (!groupName) return badRequest('groupName is required');
  if (groupName.length > 60) return badRequest('groupName must be 60 characters or less');
  if (!/^\d{6}$/.test(groupKey)) return badRequest('groupKey must be exactly 6 digits');
  if (typeof body.creatorPhone !== 'string') return badRequest('creatorPhone is required');
  const creatorName = typeof body.creatorName === 'string' ? body.creatorName.trim().replace(/\s+/g, ' ') : '';
  if (!creatorName) return badRequest('creatorName is required');
  if (creatorName.length > 40) return badRequest('creatorName must be 40 characters or less');

  let creatorPhone: { e164: string; display: string };
  try {
    creatorPhone = validateAndNormalizePhone(body.creatorPhone);
  } catch (error) {
    if (error instanceof PhoneValidationError) return badRequest(error.message);
    throw error;
  }

  const traceId = randomUUID();
  const groupId = randomUUID();
  const now = new Date().toISOString();
  const creatorPersonId = newPersonId();
  const state = createEmptyAppState(groupId, groupName);
  state.createdAt = now;
  state.updatedAt = now;
  state.people = [{ personId: creatorPersonId, name: creatorName, cellE164: creatorPhone.e164, cellDisplay: creatorPhone.display, status: 'active', createdAt: now, timezone: process.env.TZ ?? 'America/Los_Angeles', notes: '' }];

  await storage.initIfMissing(groupId, state);
  context.debug('group_create_success', { traceId, groupId, peopleCount: state.people.length });
  return { status: 200, jsonBody: { groupId, groupName, creatorPersonId, linkPath: `/#/g/${groupId}` } };
}
