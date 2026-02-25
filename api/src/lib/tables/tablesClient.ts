import { TableClient, TableServiceClient } from '@azure/data-tables';

export const REQUIRED_TABLES = [
  'Groups',
  'UserGroups',
  'GroupMembers',
  'AppointmentsIndex',
  'DailyMetrics',
  'UserDailyUsage',
  'UserDailyUsageByModel',
  'DailyUsageByModel'
] as const;

let tableServiceClient: TableServiceClient | null = null;
let tablesInitPromise: Promise<void> | null = null;

const getConnectionString = (): string => {
  const value = process.env.AZURE_TABLES_CONNECTION_STRING?.trim();
  if (!value) throw new Error('AZURE_TABLES_CONNECTION_STRING is not configured');
  return value;
};

export const getTableServiceClient = (): TableServiceClient => {
  if (tableServiceClient) return tableServiceClient;
  tableServiceClient = TableServiceClient.fromConnectionString(getConnectionString());
  return tableServiceClient;
};

export const getTableClient = (tableName: string): TableClient => TableClient.fromConnectionString(getConnectionString(), tableName);

export const ensureTablesExist = async (tableNames: readonly string[]): Promise<void> => {
  const service = getTableServiceClient();
  for (const tableName of tableNames) {
    await service.createTable(tableName).catch((error: unknown) => {
      const status = typeof error === 'object' && error !== null && 'statusCode' in error ? Number((error as { statusCode?: unknown }).statusCode) : NaN;
      if (status === 409) return;
      throw error;
    });
  }
};

export const ensureTablesInitialized = async (): Promise<void> => {
  if (!tablesInitPromise) {
    tablesInitPromise = ensureTablesExist(REQUIRED_TABLES);
  }
  return tablesInitPromise;
};
