import { ensureTablesInitialized } from './tablesClient.js';

export const ensureTablesReady = async (): Promise<void> => {
  await ensureTablesInitialized();
};
