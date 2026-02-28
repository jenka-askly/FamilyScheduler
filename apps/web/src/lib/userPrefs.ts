import { apiFetch } from './apiUrl';

export type UserPrefs = {
  emailUpdatesEnabled: boolean;
  mutedGroupIds: string[];
};

type UserPreferencesPayload = {
  ok?: boolean;
  emailUpdatesEnabled?: boolean;
  mutedGroupIds?: string[];
  message?: string;
  traceId?: string;
};

const withTrace = (message: string | undefined, traceId?: string): string => `${message ?? 'Unable to update preferences.'}${traceId ? ` (trace: ${traceId})` : ''}`;

export const getUserPreferences = async (): Promise<{ ok: true; prefs: UserPrefs } | { ok: false; message: string }> => {
  const response = await apiFetch('/api/user/preferences');
  const payload = await response.json() as UserPreferencesPayload;
  if (!response.ok || !payload.ok || typeof payload.emailUpdatesEnabled !== 'boolean') {
    return { ok: false, message: withTrace(payload.message ?? 'Unable to load notification preferences.', payload.traceId) };
  }
  return {
    ok: true,
    prefs: {
      emailUpdatesEnabled: payload.emailUpdatesEnabled,
      mutedGroupIds: Array.isArray(payload.mutedGroupIds) ? payload.mutedGroupIds : []
    }
  };
};

export const setUserPreferencesPatch = async (patch: { emailUpdatesEnabled?: boolean; mutedGroupIds?: string[] }): Promise<{ ok: true; prefs: UserPrefs } | { ok: false; message: string }> => {
  const response = await apiFetch('/api/user/preferences', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch)
  });
  const payload = await response.json() as UserPreferencesPayload;
  if (!response.ok || !payload.ok || typeof payload.emailUpdatesEnabled !== 'boolean') {
    return { ok: false, message: withTrace(payload.message ?? 'Unable to save notification preferences.', payload.traceId) };
  }
  return {
    ok: true,
    prefs: {
      emailUpdatesEnabled: payload.emailUpdatesEnabled,
      mutedGroupIds: Array.isArray(payload.mutedGroupIds) ? payload.mutedGroupIds : []
    }
  };
};
