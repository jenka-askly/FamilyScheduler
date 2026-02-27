import { getAppointmentJson, putAppointmentJson } from './appointments.js';
import { adjustGroupCounters, findAppointmentIndexById, purgeAfterAt, upsertAppointmentIndex } from './entities.js';

export type SoftDeleteAppointmentResult =
  | { ok: true; appointmentId: string }
  | { ok: false; message: string };

// Keep scanStatus aligned with existing scan-delete semantics so all delete entry points
// produce consistent snapshot filtering and lifecycle fields.
export const softDeleteAppointmentById = async (
  groupId: string,
  appointmentId: string,
  userKey: string,
  nowIso = new Date().toISOString()
): Promise<SoftDeleteAppointmentResult> => {
  const index = await findAppointmentIndexById(groupId, appointmentId);
  if (!index) return { ok: false, message: `Not found: ${appointmentId}` };

  const wasUpcoming = Boolean(index.startTime)
    && Number.isFinite(Date.parse(index.startTime as string))
    && Date.parse(index.startTime as string) >= Date.parse(nowIso)
    && !index.isDeleted;

  await upsertAppointmentIndex({
    ...index,
    isDeleted: true,
    deletedAt: nowIso,
    deletedByUserKey: userKey,
    purgeAfterAt: purgeAfterAt(nowIso),
    status: 'deleted',
    updatedAt: nowIso
  });

  if (wasUpcoming) {
    await adjustGroupCounters(groupId, { appointmentCountUpcoming: -1 });
  }

  const doc = await getAppointmentJson(groupId, appointmentId);
  if (doc) {
    await putAppointmentJson(groupId, appointmentId, {
      ...doc,
      scanStatus: 'deleted',
      isDeleted: true,
      deletedAt: nowIso,
      deletedByUserKey: userKey,
      purgeAfterAt: purgeAfterAt(nowIso),
      updatedAt: nowIso
    });
  }

  return { ok: true, appointmentId };
};
