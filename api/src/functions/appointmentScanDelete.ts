import { HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { errorResponse } from '../lib/http/errorResponse.js';
import { requireSessionEmail } from '../lib/auth/requireSession.js';
import { ensureTablesReady } from '../lib/tables/withTables.js';
import { requireGroupMembership } from '../lib/tables/membership.js';
import { softDeleteAppointmentById } from '../lib/tables/appointmentSoftDelete.js';
import { userKeyFromEmail } from '../lib/identity/userKey.js';

export async function appointmentScanDelete(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const traceId = `scan-del-${Date.now()}`;
  const body = await request.json() as { groupId?: unknown; email?: unknown; appointmentId?: unknown };
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  if (!groupId) return errorResponse(400, 'invalid_group_id', 'groupId is required', traceId);
  const session = await requireSessionEmail(request, traceId, { groupId });
  if (!session.ok) return session.response;
  const appointmentId = typeof body.appointmentId === 'string' ? body.appointmentId.trim() : '';
  if (!appointmentId) return errorResponse(400, 'appointment_required', 'appointmentId is required', traceId);

  await ensureTablesReady();
  const member = await requireGroupMembership({ groupId, email: session.email, traceId, allowStatuses: ['active'] });
  if (!member.ok) return member.response;

  const result = await softDeleteAppointmentById(groupId, appointmentId, userKeyFromEmail(session.email));
  if (!result.ok) return errorResponse(404, 'not_found', result.message, traceId);

  return { status: 200, jsonBody: { ok: true, traceId } };
}
