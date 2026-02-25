import { apiFetch } from '../apiUrl';

const createTraceId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

type SpinoffPayload = { ok?: boolean; newGroupId?: string; message?: string; traceId?: string };

export type SpinoffBreakoutResult =
  | { ok: true; urlToOpen: string; newGroupId: string }
  | { ok: false; message: string; traceId?: string };

export async function spinoffBreakoutGroup({
  sourceGroupId,
  groupName = ''
}: {
  sourceGroupId: string;
  groupName?: string;
}): Promise<SpinoffBreakoutResult> {
  const traceId = createTraceId();
  try {
    const response = await apiFetch('/api/ignite/spinoff', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sourceGroupId, traceId, groupName })
    });
    const data = await response.json() as SpinoffPayload;
    if (!response.ok || !data.ok || !data.newGroupId) {
      const resolvedTraceId = data.traceId ?? traceId;
      return {
        ok: false,
        traceId: resolvedTraceId,
        message: data.message ?? 'Unable to create breakout group.'
      };
    }

    const nextHash = `/g/${data.newGroupId}/ignite`;
    const handoffPath = `/#/handoff?groupId=${encodeURIComponent(data.newGroupId)}&next=${encodeURIComponent(nextHash)}`;
    return {
      ok: true,
      newGroupId: data.newGroupId,
      urlToOpen: `${window.location.origin}${handoffPath}`
    };
  } catch {
    return {
      ok: false,
      traceId,
      message: 'Unable to create breakout group.'
    };
  }
}
