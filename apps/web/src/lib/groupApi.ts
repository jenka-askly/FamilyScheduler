import { apiFetch } from './apiUrl';

type DeleteGroupResponse = {
  ok?: boolean;
  message?: string;
  traceId?: string;
  deletedAt?: string;
};

type RestoreGroupResponse = {
  ok?: boolean;
  message?: string;
  traceId?: string;
};

export const deleteGroup = async (groupId: string): Promise<{ ok: boolean; deletedAt?: string; message?: string }> => {
  const response = await apiFetch('/api/group/delete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ groupId })
  });
  const payload = await response.json() as DeleteGroupResponse;
  if (!response.ok || !payload.ok) {
    return { ok: false, message: `${payload.message ?? 'Unable to delete group right now.'}${payload.traceId ? ` (trace: ${payload.traceId})` : ''}` };
  }
  return { ok: true, deletedAt: payload.deletedAt };
};

export const restoreGroup = async (groupId: string): Promise<{ ok: boolean; message?: string }> => {
  const response = await apiFetch('/api/group/restore', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ groupId })
  });
  const payload = await response.json() as RestoreGroupResponse;
  if (!response.ok || !payload.ok) {
    return { ok: false, message: `${payload.message ?? 'Unable to restore group right now.'}${payload.traceId ? ` (trace: ${payload.traceId})` : ''}` };
  }
  return { ok: true, message: payload.message };
};
