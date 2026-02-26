import type { TableEntityResult } from '@azure/data-tables';
import { getTableClient } from '../tables/tablesClient.js';
import { ensureTablesReady } from '../tables/withTables.js';
import { TABLE_KEY_SEP, validateTableKey } from '../tables/tableKeys.js';

const isNotFound = (error: unknown): boolean => {
  const status = typeof error === 'object' && error !== null && 'statusCode' in error ? Number((error as { statusCode?: unknown }).statusCode) : NaN;
  return status === 404;
};

const withRetry = async (fn: () => Promise<void>): Promise<void> => {
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

const getCount = (entity: TableEntityResult<Record<string, unknown>> | null, key: string): number => {
  const value = entity?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

const validateCounterKeys = (tableName: string, pk: string, rk: string, traceId?: string): void => {
  try {
    validateTableKey(pk);
  } catch (_error) {
    console.warn(JSON.stringify({ stage: 'usage_tables_key_validation_failed', traceId: traceId ?? 'unknown', tableName, keyType: 'partitionKey' }));
    throw _error;
  }

  try {
    validateTableKey(rk);
  } catch (_error) {
    console.warn(JSON.stringify({ stage: 'usage_tables_key_validation_failed', traceId: traceId ?? 'unknown', tableName, keyType: 'rowKey' }));
    throw _error;
  }
};

const updateCounterRow = async (tableName: string, pk: string, rk: string, updates: Record<string, number>, nowIso: string, traceId?: string): Promise<void> => {
  validateCounterKeys(tableName, pk, rk, traceId);
  const client = getTableClient(tableName);
  await withRetry(async () => {
    let current: TableEntityResult<Record<string, unknown>> | null = null;
    try {
      current = await client.getEntity(pk, rk);
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }

    const next: Record<string, any> & { partitionKey: string; rowKey: string } = { partitionKey: pk, rowKey: rk, updatedAt: nowIso };
    for (const [key, delta] of Object.entries(updates)) next[key] = getCount(current, key) + delta;

    if (current?.etag) {
      await client.updateEntity(next, 'Merge', { etag: current.etag });
      return;
    }
    await client.createEntity(next);
  });
};

const usageDate = (nowIso: string): string => nowIso.slice(0, 10);
const usageMonth = (nowIso: string): string => nowIso.slice(0, 7);

export const recordOpenAiSuccess = async (userKey: string, model: string, tokensIn: number, tokensOut: number, traceId?: string): Promise<void> => {
  await ensureTablesReady();
  const nowIso = new Date().toISOString();
  const date = usageDate(nowIso);
  const month = usageMonth(nowIso);
  const safeIn = Number.isFinite(tokensIn) ? Math.max(0, Math.floor(tokensIn)) : 0;
  const safeOut = Number.isFinite(tokensOut) ? Math.max(0, Math.floor(tokensOut)) : 0;

  await Promise.all([
    updateCounterRow('UserDailyUsage', userKey, date, { openaiCalls: 1, openaiTokensIn: safeIn, openaiTokensOut: safeOut }, nowIso, traceId),
    updateCounterRow('UserDailyUsageByModel', `${userKey}${TABLE_KEY_SEP}${date}`, model, { calls: 1, tokensIn: safeIn, tokensOut: safeOut }, nowIso, traceId),
    updateCounterRow('DailyUsageByModel', month, `${date}${TABLE_KEY_SEP}${model}`, { calls: 1, tokensIn: safeIn, tokensOut: safeOut }, nowIso, traceId)
  ]);
};

export const recordOpenAiError = async (userKey: string, model: string, traceId?: string): Promise<void> => {
  await ensureTablesReady();
  const nowIso = new Date().toISOString();
  const date = usageDate(nowIso);
  const month = usageMonth(nowIso);
  await Promise.all([
    updateCounterRow('UserDailyUsage', userKey, date, { openaiErrors: 1 }, nowIso, traceId),
    updateCounterRow('UserDailyUsageByModel', `${userKey}${TABLE_KEY_SEP}${date}`, model, { errors: 1 }, nowIso, traceId),
    updateCounterRow('DailyUsageByModel', month, `${date}${TABLE_KEY_SEP}${model}`, { errors: 1 }, nowIso, traceId)
  ]);
};


export const readUserDailyUsage = async (
  userKey: string,
  date: string
): Promise<{ openaiCalls: number; tokensIn: number; tokensOut: number; errors: number } | null> => {
  await ensureTablesReady();
  const client = getTableClient('UserDailyUsage');
  try {
    const entity = await client.getEntity<Record<string, unknown>>(userKey, date);
    return {
      openaiCalls: getCount(entity as TableEntityResult<Record<string, unknown>>, 'openaiCalls'),
      tokensIn: getCount(entity as TableEntityResult<Record<string, unknown>>, 'openaiTokensIn'),
      tokensOut: getCount(entity as TableEntityResult<Record<string, unknown>>, 'openaiTokensOut'),
      errors: getCount(entity as TableEntityResult<Record<string, unknown>>, 'openaiErrors')
    };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
};
