import type { TableEntityResult } from '@azure/data-tables';
import { getTableClient } from './tablesClient.js';
import { TABLE_KEY_SEP } from './tableKeys.js';
const listAppointmentIndexesForGroupForTests: { fn: ((groupId: string, max?: number) => Promise<AppointmentsIndexEntity[]>) | null } = { fn: null };
const upsertAppointmentIndexForTests: { fn: ((entity: AppointmentsIndexEntity) => Promise<void>) | null } = { fn: null };
const findAppointmentIndexByIdForTests: { fn: ((groupId: string, appointmentId: string) => Promise<AppointmentsIndexEntity | null>) | null } = { fn: null };


export const GROUPS_TABLE = 'Groups';
export const USER_GROUPS_TABLE = 'UserGroups';
export const GROUP_MEMBERS_TABLE = 'GroupMembers';
export const APPOINTMENTS_INDEX_TABLE = 'AppointmentsIndex';
export const USER_PROFILES_TABLE = 'UserProfiles';
export const APPOINTMENT_PARTICIPANTS_TABLE = 'AppointmentParticipants';

export type MembershipStatus = 'active' | 'invited' | 'removed';

export type GroupEntity = {
  partitionKey: 'group';
  rowKey: string;
  groupId: string;
  groupName: string;
  createdAt: string;
  updatedAt: string;
  createdByUserKey: string;
  isDeleted: boolean;
  memberCountActive?: number;
  memberCountInvited?: number;
  appointmentCountUpcoming?: number;
  deletedAt?: string;
  deletedByUserKey?: string;
  purgeAfterAt?: string;
};

export type UserGroupsEntity = {
  partitionKey: string;
  rowKey: string;
  groupId: string;
  status: MembershipStatus;
  invitedAt?: string;
  joinedAt?: string;
  removedAt?: string;
  updatedAt: string;
};

export type GroupMembersEntity = {
  partitionKey: string;
  rowKey: string;
  userKey: string;
  email: string;
  status: MembershipStatus;
  invitedAt?: string;
  joinedAt?: string;
  removedAt?: string;
  updatedAt: string;
};

export type AppointmentsIndexEntity = {
  partitionKey: string;
  rowKey: string;
  appointmentId: string;
  startTime?: string;
  startTimeDt?: Date;
  status: string;
  hasScan: boolean;
  scanCapturedAt?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  deletedAt?: string;
  deletedByUserKey?: string;
  purgeAfterAt?: string;
};


export type UserProfileEntity = {
  partitionKey: string;
  rowKey: 'profile';
  userKey: string;
  email?: string;
  displayName?: string;
  photoKey?: string;
  timezone?: string;
  locale?: string;
  createdAt: string;
  updatedAt: string;
};

export type AppointmentParticipantEntity = {
  partitionKey: string;
  rowKey: string;
  groupId: string;
  appointmentId: string;
  userKey: string;
  status: string;
  role?: string;
  assignedAt?: string;
  assignedByUserKey?: string;
  updatedAt: string;
};

const isNotFound = (error: unknown): boolean => {
  const status = typeof error === 'object' && error !== null && 'statusCode' in error ? Number((error as { statusCode?: unknown }).statusCode) : NaN;
  return status === 404;
};

export const purgeAfterAt = (deletedAt: string): string => new Date(Date.parse(deletedAt) + 30 * 24 * 60 * 60 * 1000).toISOString();
export const dateKey = (iso: string): string => iso.slice(0, 10);
export const monthKey = (iso: string): string => iso.slice(0, 7);
export const rowKeyFromIso = (iso: string, id: string): string => `${iso.replace(/[-:]/g, '').replace('.000', '').replace(/\..+Z$/, 'Z')}${TABLE_KEY_SEP}${id}`;

export const getGroupEntity = async (groupId: string): Promise<GroupEntity | null> => {
  try {
    return await getTableClient(GROUPS_TABLE).getEntity<GroupEntity>('group', groupId);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
};

export const getGroupMemberEntity = async (groupId: string, userKey: string): Promise<GroupMembersEntity | null> => {
  try {
    return await getTableClient(GROUP_MEMBERS_TABLE).getEntity<GroupMembersEntity>(groupId, userKey);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
};

export const getUserGroupEntity = async (userKey: string, groupId: string): Promise<UserGroupsEntity | null> => {
  try {
    return await getTableClient(USER_GROUPS_TABLE).getEntity<UserGroupsEntity>(userKey, groupId);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
};

export const upsertGroupMember = async (entity: GroupMembersEntity): Promise<void> => {
  await getTableClient(GROUP_MEMBERS_TABLE).upsertEntity(entity, 'Merge');
};

export const upsertUserGroup = async (entity: UserGroupsEntity): Promise<void> => {
  await getTableClient(USER_GROUPS_TABLE).upsertEntity(entity, 'Merge');
};

export const upsertGroup = async (entity: GroupEntity): Promise<void> => {
  await getTableClient(GROUPS_TABLE).upsertEntity(entity, 'Merge');
};

export const restoreGroupById = async (group: GroupEntity, restoredAt: string): Promise<void> => {
  await upsertGroup({
    ...group,
    isDeleted: false,
    deletedAt: undefined,
    deletedByUserKey: undefined,
    purgeAfterAt: undefined,
    updatedAt: restoredAt
  });
};

const withRetries = async (fn: () => Promise<void>): Promise<void> => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await fn();
      return;
    } catch (error) {
      const status = typeof error === 'object' && error !== null && 'statusCode' in error ? Number((error as { statusCode?: unknown }).statusCode) : NaN;
      if ((status === 409 || status === 412) && attempt < 2) continue;
      throw error;
    }
  }
};

export const adjustGroupCounters = async (
  groupId: string,
  deltas: { memberCountActive?: number; memberCountInvited?: number; appointmentCountUpcoming?: number }
): Promise<void> => {
  const client = getTableClient(GROUPS_TABLE);
  await withRetries(async () => {
    const current = await client.getEntity<GroupEntity>('group', groupId);
    const updatedAt = new Date().toISOString();
    const next = {
      partitionKey: 'group' as const,
      rowKey: groupId,
      updatedAt,
      memberCountActive: Math.max(0, getNumeric(current, 'memberCountActive') + (deltas.memberCountActive ?? 0)),
      memberCountInvited: Math.max(0, getNumeric(current, 'memberCountInvited') + (deltas.memberCountInvited ?? 0)),
      appointmentCountUpcoming: Math.max(0, getNumeric(current, 'appointmentCountUpcoming') + (deltas.appointmentCountUpcoming ?? 0))
    };
    await client.updateEntity(next, 'Merge', { etag: current.etag });
  });
};

export const listActiveGroups = async (): Promise<GroupEntity[]> => {
  const result: GroupEntity[] = [];
  const client = getTableClient(GROUPS_TABLE);
  const iter = client.listEntities<GroupEntity>({ queryOptions: { filter: `PartitionKey eq 'group' and isDeleted ne true` } });
  for await (const entity of iter) result.push(entity);
  return result;
};

export const getAppointmentIndexEntity = async (groupId: string, rowKey: string): Promise<AppointmentsIndexEntity | null> => {
  try {
    return await getTableClient(APPOINTMENTS_INDEX_TABLE).getEntity<AppointmentsIndexEntity>(groupId, rowKey);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
};

export const findAppointmentIndexById = async (groupId: string, appointmentId: string): Promise<AppointmentsIndexEntity | null> => {
  if (findAppointmentIndexByIdForTests.fn) return findAppointmentIndexByIdForTests.fn(groupId, appointmentId);
  const client = getTableClient(APPOINTMENTS_INDEX_TABLE);
  const iter = client.listEntities<AppointmentsIndexEntity>({ queryOptions: { filter: `PartitionKey eq '${groupId}' and appointmentId eq '${appointmentId}'` } });
  for await (const entity of iter) return entity;
  return null;
};

export const listAppointmentIndexesForGroup = async (groupId: string, max = 500): Promise<AppointmentsIndexEntity[]> => {
  if (listAppointmentIndexesForGroupForTests.fn) return listAppointmentIndexesForGroupForTests.fn(groupId, max);
  const escapedGroupId = groupId.replace(/'/g, "''");
  const entities: AppointmentsIndexEntity[] = [];
  const client = getTableClient(APPOINTMENTS_INDEX_TABLE);
  const iter = client.listEntities<AppointmentsIndexEntity>({
    queryOptions: {
      filter: `PartitionKey eq '${escapedGroupId}' and isDeleted ne true`
    }
  });
  for await (const entity of iter) {
    entities.push(entity);
    if (entities.length >= max) break;
  }
  entities.sort((a, b) => {
    const aMs = Date.parse(a.updatedAt ?? '') || 0;
    const bMs = Date.parse(b.updatedAt ?? '') || 0;
    if (bMs !== aMs) return bMs - aMs;
    return a.appointmentId.localeCompare(b.appointmentId);
  });
  return entities;
};

export const setListAppointmentIndexesForGroupForTests = (fn: ((groupId: string, max?: number) => Promise<AppointmentsIndexEntity[]>) | null): void => {
  listAppointmentIndexesForGroupForTests.fn = fn;
};

export const upsertAppointmentIndex = async (entity: AppointmentsIndexEntity): Promise<void> => {
  if (upsertAppointmentIndexForTests.fn) return upsertAppointmentIndexForTests.fn(entity);
  const { startTime, ...rest } = entity;
  const parsed = typeof startTime === 'string' ? Date.parse(startTime) : Number.NaN;
  const entityToUpsert: AppointmentsIndexEntity = Number.isFinite(parsed)
    ? {
        ...rest,
        startTime,
        startTimeDt: new Date(parsed)
      }
    : rest;
  await getTableClient(APPOINTMENTS_INDEX_TABLE).upsertEntity(entityToUpsert, 'Merge');
};


export const setUpsertAppointmentIndexForTests = (fn: ((entity: AppointmentsIndexEntity) => Promise<void>) | null): void => {
  upsertAppointmentIndexForTests.fn = fn;
};

export const setFindAppointmentIndexByIdForTests = (fn: ((groupId: string, appointmentId: string) => Promise<AppointmentsIndexEntity | null>) | null): void => {
  findAppointmentIndexByIdForTests.fn = fn;
};
export const listUserGroups = async (userKey: string, max = 200): Promise<UserGroupsEntity[]> => {
  const result: UserGroupsEntity[] = [];
  const client = getTableClient(USER_GROUPS_TABLE);
  const iter = client.listEntities<UserGroupsEntity>({ queryOptions: { filter: `PartitionKey eq '${userKey}'` } });
  for await (const entity of iter) {
    result.push(entity);
    if (result.length >= max) break;
  }
  return result;
};


export const getUserProfileEntity = async (userKey: string): Promise<UserProfileEntity | null> => {
  try {
    return await getTableClient(USER_PROFILES_TABLE).getEntity<UserProfileEntity>(userKey, 'profile');
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
};

export const upsertUserProfile = async (params: {
  userKey: string;
  displayName?: string;
  email?: string;
  photoKey?: string;
  timezone?: string;
  locale?: string;
  updatedAt: string;
  createdAt?: string;
}): Promise<void> => {
  const existing = await getUserProfileEntity(params.userKey);
  await getTableClient(USER_PROFILES_TABLE).upsertEntity({
    partitionKey: params.userKey,
    rowKey: 'profile',
    userKey: params.userKey,
    ...(params.displayName ? { displayName: params.displayName } : {}),
    ...(params.email ? { email: params.email } : {}),
    ...(params.photoKey ? { photoKey: params.photoKey } : {}),
    ...(params.timezone ? { timezone: params.timezone } : {}),
    ...(params.locale ? { locale: params.locale } : {}),
    createdAt: existing?.createdAt ?? params.createdAt ?? params.updatedAt,
    updatedAt: params.updatedAt
  }, 'Merge');
};

export const listGroupMembers = async (groupId: string, allowStatuses: MembershipStatus[] = ['active', 'invited']): Promise<GroupMembersEntity[]> => {
  const escapedGroupId = groupId.replace(/'/g, "''");
  const members: GroupMembersEntity[] = [];
  const client = getTableClient(GROUP_MEMBERS_TABLE);
  const iter = client.listEntities<GroupMembersEntity>({ queryOptions: { filter: `PartitionKey eq '${escapedGroupId}'` } });
  for await (const member of iter) {
    if (allowStatuses.includes(member.status)) members.push(member);
  }
  members.sort((a, b) => (a.email ?? '').localeCompare(b.email ?? ''));
  return members;
};

export const listAppointmentParticipants = async (groupId: string, appointmentId: string): Promise<AppointmentParticipantEntity[]> => {
  const partitionKey = `g:${groupId}|a:${appointmentId}`.replace(/'/g, "''");
  const entities: AppointmentParticipantEntity[] = [];
  const client = getTableClient(APPOINTMENT_PARTICIPANTS_TABLE);
  const iter = client.listEntities<AppointmentParticipantEntity>({ queryOptions: { filter: `PartitionKey eq '${partitionKey}'` } });
  for await (const entity of iter) entities.push(entity);
  entities.sort((a, b) => a.userKey.localeCompare(b.userKey));
  return entities;
};

export const upsertAppointmentParticipant = async (params: {
  groupId: string;
  appointmentId: string;
  userKey: string;
  status: string;
  role?: string;
  assignedAt?: string;
  assignedByUserKey?: string;
  updatedAt: string;
}): Promise<void> => {
  await getTableClient(APPOINTMENT_PARTICIPANTS_TABLE).upsertEntity({
    partitionKey: `g:${params.groupId}|a:${params.appointmentId}`,
    rowKey: params.userKey,
    groupId: params.groupId,
    appointmentId: params.appointmentId,
    userKey: params.userKey,
    status: params.status,
    ...(params.role ? { role: params.role } : {}),
    ...(params.assignedAt ? { assignedAt: params.assignedAt } : {}),
    ...(params.assignedByUserKey ? { assignedByUserKey: params.assignedByUserKey } : {}),
    updatedAt: params.updatedAt
  }, 'Merge');
};

export const deleteAppointmentParticipant = async (groupId: string, appointmentId: string, userKey: string): Promise<void> => {
  await getTableClient(APPOINTMENT_PARTICIPANTS_TABLE).deleteEntity(`g:${groupId}|a:${appointmentId}`, userKey);
};

export const getNumeric = (entity: TableEntityResult<Record<string, unknown>> | Record<string, unknown>, key: string): number => {
  const value = entity[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};
