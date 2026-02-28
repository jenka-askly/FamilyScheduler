import { randomBytes, randomUUID } from 'node:crypto';
import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { MissingConfigError } from '../lib/errors/configError.js';
import { errorResponse, logConfigMissing } from '../lib/http/errorResponse.js';
import { createEmptyAppState } from '../lib/state.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { isPlausibleEmail, normalizeEmail } from '../lib/auth/requireMembership.js';
import { requireSessionEmail } from '../lib/auth/requireSession.js';
import { userKeyFromEmail } from '../lib/identity/userKey.js';
import { incrementDailyMetric } from '../lib/tables/metrics.js';
import { getUserProfileEntity, upsertGroup, upsertGroupMember, upsertUserGroup } from '../lib/tables/entities.js';
import { ensureTablesReady } from '../lib/tables/withTables.js';

type CreateGroupBody = { groupName?: unknown; creatorEmail?: unknown; creatorName?: unknown; traceId?: unknown };

const badRequest = (message: string, traceId: string): HttpResponseInit => ({ status: 400, jsonBody: { ok: false, error: 'bad_request', message, traceId } });

const newPersonId = (): string => `P-${randomBytes(2).toString('hex').toUpperCase()}`;

export async function groupCreate(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as CreateGroupBody;
  const traceId = typeof body.traceId === 'string' && body.traceId.trim() ? body.traceId.trim() : randomUUID();
  const groupName = typeof body.groupName === 'string' ? body.groupName.trim().replace(/\s+/g, ' ') : '';
  if (!groupName) return badRequest('groupName is required', traceId);
  if (groupName.length > 60) return badRequest('groupName must be 60 characters or less', traceId);

  let creatorEmail: string | null = null;
  const session = await requireSessionEmail(request, traceId);
  if (session.ok) creatorEmail = normalizeEmail(session.email);

  if (!creatorEmail) {
    if (typeof body.creatorEmail !== 'string') return badRequest('creatorEmail is required', traceId);
    if (!isPlausibleEmail(body.creatorEmail)) return badRequest('creatorEmail is invalid', traceId);
    creatorEmail = normalizeEmail(body.creatorEmail);
  }

  const groupId = randomUUID();
  const now = new Date().toISOString();
  const creatorUserKey = userKeyFromEmail(creatorEmail);
  const creatorPersonId = newPersonId();

  try {
    await ensureTablesReady();
    const creatorProfile = await getUserProfileEntity(creatorUserKey);
    const creatorName = typeof creatorProfile?.displayName === 'string' ? creatorProfile.displayName.trim().replace(/\s+/g, ' ') : '';
    if (!creatorName) {
      return { status: 400, jsonBody: { ok: false, error: 'PROFILE_INCOMPLETE', message: 'Display name required', traceId } };
    }

    const state = createEmptyAppState(groupId, groupName);
    state.createdAt = now;
    state.updatedAt = now;
    state.people = [{ personId: creatorPersonId, name: creatorName, email: creatorEmail, status: 'active', createdAt: now, timezone: process.env.TZ ?? 'America/Los_Angeles', notes: '' }];

    await upsertGroup({
      partitionKey: 'group',
      rowKey: groupId,
      groupId,
      groupName,
      createdAt: now,
      updatedAt: now,
      createdByUserKey: creatorUserKey,
      isDeleted: false,
      memberCountActive: 1,
      memberCountInvited: 0,
      appointmentCountUpcoming: 0
    });
    await upsertGroupMember({ partitionKey: groupId, rowKey: creatorUserKey, userKey: creatorUserKey, email: creatorEmail, status: 'active', joinedAt: now, updatedAt: now });
    await upsertUserGroup({ partitionKey: creatorUserKey, rowKey: groupId, groupId, status: 'active', joinedAt: now, updatedAt: now });
    await incrementDailyMetric('newGroups', 1);

    const storage = createStorageAdapter();
    await storage.initIfMissing(groupId, state);

    context.debug('group_create_success', { traceId, groupId, peopleCount: state.people.length });
    return { status: 200, jsonBody: { groupId, groupName, creatorPersonId, linkPath: `/#/g/${groupId}` } };
  } catch (error) {
    if (error instanceof MissingConfigError) {
      logConfigMissing('groupCreate', traceId, error.missing);
      return errorResponse(500, 'CONFIG_MISSING', error.message, traceId, { missing: error.missing });
    }
    throw error;
  }
}
