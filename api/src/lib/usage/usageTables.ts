import type { TableEntityResult } from '@azure/data-tables';
import { getTableClient } from '../tables/tablesClient.js';
import { ensureTablesReady } from '../tables/withTables.js';

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

const updateCounterRow = async (tableName: string, pk: string, rk: string, updates: Record<string, number>, nowIso: string): Promise<void> => {
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

export const recordOpenAiSuccess = async (userKey: string, model: string, tokensIn: number, tokensOut: number): Promise<void> => {
  await ensureTablesReady();
  const nowIso = new Date().toISOString();
  const date = usageDate(nowIso);
  const month = usageMonth(nowIso);
  const safeIn = Number.isFinite(tokensIn) ? Math.max(0, Math.floor(tokensIn)) : 0;
  const safeOut = Number.isFinite(tokensOut) ? Math.max(0, Math.floor(tokensOut)) : 0;

  await Promise.all([
    updateCounterRow('UserDailyUsage', userKey, date, { openaiCalls: 1, openaiTokensIn: safeIn, openaiTokensOut: safeOut }, nowIso),
    updateCounterRow('UserDailyUsageByModel', `${userKey}#${date}`, model, { calls: 1, tokensIn: safeIn, tokensOut: safeOut }, nowIso),
    updateCounterRow('DailyUsageByModel', month, `${date}#${model}`, { calls: 1, tokensIn: safeIn, tokensOut: safeOut }, nowIso)
  ]);
};

export const recordOpenAiError = async (userKey: string, model: string): Promise<void> => {
  await ensureTablesReady();
  const nowIso = new Date().toISOString();
  const date = usageDate(nowIso);
  const month = usageMonth(nowIso);
  await Promise.all([
    updateCounterRow('UserDailyUsage', userKey, date, { openaiErrors: 1 }, nowIso),
    updateCounterRow('UserDailyUsageByModel', `${userKey}#${date}`, model, { errors: 1 }, nowIso),
    updateCounterRow('DailyUsageByModel', month, `${date}#${model}`, { errors: 1 }, nowIso)
  ]);
};
