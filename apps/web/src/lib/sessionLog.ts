const debugAuthLogsEnabled = import.meta.env?.VITE_DEBUG_AUTH_LOGS === 'true';

export const sessionLog = (event: string, data?: Record<string, unknown>): void => {
  if (!debugAuthLogsEnabled) return;
  if (data) {
    console.log('[SESSION]', event, data);
    return;
  }
  console.log('[SESSION]', event);
};
