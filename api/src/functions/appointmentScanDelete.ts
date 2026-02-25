import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { errorResponse } from '../lib/http/errorResponse.js';
import { requireSessionEmail } from '../lib/auth/requireSession.js';
import { ensureTablesReady } from '../lib/tables/withTables.js';
import { requireGroupMembership } from '../lib/tables/membership.js';
import { adjustGroupCounters, findAppointmentIndexById, purgeAfterAt, upsertAppointmentIndex } from '../lib/tables/entities.js';
import { getAppointmentJson, putAppointmentJson } from '../lib/tables/appointments.js';
import { userKeyFromEmail } from '../lib/identity/userKey.js';

export async function appointmentScanDelete(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = `scan-del-${Date.now()}`;
  const body = await request.json() as { groupId?: unknown; appointmentId?: unknown };
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  if (!groupId) return errorResponse(400, 'invalid_group_id', 'groupId is required', traceId);
  const session = await requireSessionEmail(request, traceId, { groupId });
  if (!session.ok) return session.response;
  const appointmentId = typeof body.appointmentId === 'string' ? body.appointmentId.trim() : '';
  if (!appointmentId) return errorResponse(400, 'appointment_required', 'appointmentId is required', traceId);

  await ensureTablesReady();
  const member = await requireGroupMembership({ groupId, email: session.email, traceId, allowStatuses: ['active'] });
  if (!member.ok) return member.response;

  const index = await findAppointmentIndexById(groupId, appointmentId);
  if (!index) return errorResponse(404, 'not_found', 'Appointment not found', traceId);
  const now = new Date().toISOString();
  const wasUpcoming = Boolean(index.startTime) && Number.isFinite(Date.parse(index.startTime as string)) && Date.parse(index.startTime as string) >= Date.parse(now) && !index.isDeleted;
  await upsertAppointmentIndex({ ...index, isDeleted: true, deletedAt: now, deletedByUserKey: userKeyFromEmail(session.email), purgeAfterAt: purgeAfterAt(now), status: 'deleted', updatedAt: now });
  if (wasUpcoming) {
    await adjustGroupCounters(groupId, { appointmentCountUpcoming: -1 });
  }

  const doc = await getAppointmentJson(groupId, appointmentId);
  if (doc) {
    await putAppointmentJson(groupId, appointmentId, { ...doc, scanStatus: 'deleted', isDeleted: true, deletedAt: now, deletedByUserKey: userKeyFromEmail(session.email), purgeAfterAt: purgeAfterAt(now), updatedAt: now });
  }

  return { status: 200, jsonBody: { ok: true, traceId } };
}
