import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { findActivePersonByPhone, validateJoinRequest } from '../lib/groupAuth.js';
import { sendEmail } from '../lib/email/acsEmail.js';
import { MissingConfigError } from '../lib/errors/configError.js';
import { errorResponse, logConfigMissing } from '../lib/http/errorResponse.js';
import { ensureTraceId, logAuth } from '../lib/logging/authLogs.js';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { GroupNotFoundError } from '../lib/storage/storage.js';

type JoinBody = { groupId?: unknown; phone?: unknown; traceId?: unknown; email?: unknown };

const getEmailDomain = (email: string): string => {
  const [, domain = 'unknown'] = email.split('@');
  return domain.toLowerCase();
};

const isPlausibleEmail = (email: string): boolean => {
  const trimmed = email.trim();
  const atIdx = trimmed.indexOf('@');
  if (atIdx <= 0) return false;
  const domain = trimmed.slice(atIdx + 1);
  return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.');
};

const resolveOrigin = (request: HttpRequest): string | null => {
  const origin = request.headers.get('origin');
  if (origin) return origin;
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (!forwardedHost) return null;
  return `https://${forwardedHost}`;
};

const sanitizeErrorMessage = (input: unknown): string => {
  if (typeof input !== 'string') return 'unknown';
  return input.slice(0, 180);
};

export async function groupJoin(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json() as JoinBody;
  const traceId = ensureTraceId(body.traceId);
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const validated = validateJoinRequest(body.groupId, body.phone);
  if (!validated.ok) {
    logAuth({ traceId, stage: 'join_out', ok: false, error: 'invalid_request' });
    return {
      ...validated.response,
      jsonBody: { ...(validated.response.jsonBody as Record<string, unknown>), traceId }
    };
  }

  logAuth({ traceId, stage: 'join_in', groupId: validated.groupId, phoneProvided: true });

  try {
    const storage = createStorageAdapter();
    const loaded = await storage.load(validated.groupId);
    const person = findActivePersonByPhone(loaded.state, validated.phoneE164);
    logAuth({ traceId, stage: 'join_check', groupId: validated.groupId, matchedPeopleCount: person ? 1 : 0, ok: !!person });
    if (!person) {
      logAuth({ traceId, stage: 'join_out', ok: false, error: 'not_allowed' });
      return errorResponse(403, 'not_allowed', 'Not allowed', traceId);
    }

    let emailSent = false;
    if (!email) {
      console.log({ event: 'email_send_skipped', reason: 'missing_email', traceId, groupId: validated.groupId });
    } else if (!isPlausibleEmail(email)) {
      console.log({ event: 'email_send_skipped', reason: 'invalid_email', traceId, groupId: validated.groupId });
    } else if (!process.env.AZURE_COMMUNICATION_CONNECTION_STRING || !process.env.EMAIL_SENDER_ADDRESS) {
      console.log({ event: 'email_send_skipped', reason: 'missing_env', traceId, groupId: validated.groupId, toDomain: getEmailDomain(email) });
    } else {
      const origin = resolveOrigin(request);
      if (!origin) {
        console.log({ event: 'email_send_skipped', reason: 'missing_origin', traceId, groupId: validated.groupId, toDomain: getEmailDomain(email) });
      } else {
        const joinLink = `${origin}/join?groupId=${encodeURIComponent(validated.groupId)}&traceId=${encodeURIComponent(traceId)}`;
        console.log({ event: 'email_send_attempt', origin_present: true, traceId, groupId: validated.groupId, toDomain: getEmailDomain(email), sender: process.env.EMAIL_SENDER_ADDRESS });
        try {
          const providerResult = await sendEmail({
            to: email,
            subject: 'Your FamilyScheduler link',
            plainText: `Use this link to join FamilyScheduler: ${joinLink}`,
            html: `<p>Use this link to join FamilyScheduler: <a href="${joinLink}">Join</a></p>`,
          });
          emailSent = true;
          console.log({ event: 'email_send_success', traceId, groupId: validated.groupId, operationId: providerResult.id });
        } catch (error) {
          const details = error as { name?: string; statusCode?: number; code?: string; message?: string; response?: { body?: { error?: { code?: string; message?: string } } } };
          console.log({
            event: 'email_send_failure',
            traceId,
            groupId: validated.groupId,
            errorName: details?.name ?? 'Error',
            statusCode: details?.statusCode,
            providerCode: details?.response?.body?.error?.code ?? details?.code,
            providerMessage: sanitizeErrorMessage(details?.response?.body?.error?.message ?? details?.message),
          });
        }
      }
    }

    logAuth({ traceId, stage: 'join_out', ok: true, error: null });
    return { status: 200, jsonBody: { ok: true, personId: person.personId, groupName: loaded.state.groupName, emailSent } };
  } catch (error) {
    if (error instanceof MissingConfigError) {
      logConfigMissing('groupJoin', traceId, error.missing);
      return errorResponse(500, 'CONFIG_MISSING', error.message, traceId, { missing: error.missing });
    }
    if (error instanceof GroupNotFoundError) {
      logAuth({ traceId, stage: 'join_out', ok: false, error: 'group_not_found' });
      return errorResponse(404, 'group_not_found', 'Group not found', traceId);
    }
    throw error;
  }
}
