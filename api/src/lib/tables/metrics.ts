import type { TableEntityResult } from '@azure/data-tables';
import { getTableClient } from './tablesClient.js';
import { dateKey, getNumeric, monthKey } from './entities.js';

const withRetries = async (fn: () => Promise<void>): Promise<void> => {
  for (let i = 0; i < 3; i += 1) {
    try {
      await fn();
      return;
    } catch (error) {
      const status = typeof error === 'object' && error !== null && 'statusCode' in error ? Number((error as { statusCode?: unknown }).statusCode) : NaN;
      if ((status === 409 || status === 412) && i < 2) continue;
      throw error;
    }
  }
};

const upsertCounter = async (column: string, incrementBy = 1, nowIso = new Date().toISOString()): Promise<void> => {
  const pk = monthKey(nowIso);
  const rk = dateKey(nowIso);
  const client = getTableClient('DailyMetrics');
  await withRetries(async () => {
    let current: TableEntityResult<Record<string, unknown>> | null = null;
    try {
      current = await client.getEntity(pk, rk);
    } catch (error) {
      const status = typeof error === 'object' && error !== null && 'statusCode' in error ? Number((error as { statusCode?: unknown }).statusCode) : NaN;
      if (status !== 404) throw error;
    }

    const next = {
      partitionKey: pk,
      rowKey: rk,
      newUsers: getNumeric(current ?? {}, 'newUsers'),
      newGroups: getNumeric(current ?? {}, 'newGroups'),
      newAppointments: getNumeric(current ?? {}, 'newAppointments'),
      invitesSent: getNumeric(current ?? {}, 'invitesSent'),
      invitesAccepted: getNumeric(current ?? {}, 'invitesAccepted'),
      updatedAt: nowIso,
      [column]: getNumeric(current ?? {}, column) + incrementBy
    };

    if (current?.etag) {
      await client.updateEntity(next, 'Replace', { etag: current.etag });
      return;
    }
    await client.createEntity(next);
  });
};

export const incrementDailyMetric = async (column: 'newGroups' | 'newAppointments' | 'invitesSent' | 'invitesAccepted', incrementBy = 1): Promise<void> => {
  await upsertCounter(column, incrementBy);
};
