import type { HttpResponseInit } from '@azure/functions';
import type { AppState, Person } from './state.js';
import { isPlausibleEmail, normalizeEmail } from './auth/requireMembership.js';
import { PhoneValidationError, validateAndNormalizePhone } from './validation/phone.js';

export const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const findActivePersonByPhone = (state: AppState, phoneE164: string): Person | undefined => (
  state.people.find((person) => person.status === 'active' && Boolean(person.cellE164) && person.cellE164 === phoneE164)
);

export const validateJoinRequest = (groupId: unknown, phone: unknown): { ok: true; groupId: string; phoneE164: string } | { ok: false; response: HttpResponseInit } => {
  const gid = typeof groupId === 'string' ? groupId.trim() : '';
  if (!uuidV4Pattern.test(gid)) return { ok: false, response: { status: 400, jsonBody: { error: 'invalid_group_id' } } };

  if (typeof phone !== 'string') return { ok: false, response: { status: 400, jsonBody: { error: 'phone_required' } } };

  try {
    const normalized = validateAndNormalizePhone(phone);
    return { ok: true, groupId: gid, phoneE164: normalized.e164 };
  } catch (error) {
    if (error instanceof PhoneValidationError) return { ok: false, response: { status: 400, jsonBody: { error: 'invalid_phone', message: error.message } } };
    throw error;
  }
};

export type RequestIdentity =
  | { kind: 'email'; email: string }
  | { kind: 'phone'; phoneE164: string };

export const validateIdentityRequest = (
  groupId: unknown,
  email: unknown,
  phone: unknown
): { ok: true; groupId: string; identity: RequestIdentity } | { ok: false; response: HttpResponseInit } => {
  const gid = typeof groupId === 'string' ? groupId.trim() : '';
  if (!uuidV4Pattern.test(gid)) return { ok: false, response: { status: 400, jsonBody: { error: 'invalid_group_id' } } };

  const emailValue = typeof email === 'string' ? email.trim() : '';
  if (emailValue) {
    if (!isPlausibleEmail(emailValue)) return { ok: false, response: { status: 400, jsonBody: { error: 'invalid_email', message: 'email is invalid' } } };
    return { ok: true, groupId: gid, identity: { kind: 'email', email: normalizeEmail(emailValue) } };
  }

  const phoneValue = typeof phone === 'string' ? phone : undefined;
  if (!phoneValue) return { ok: false, response: { status: 400, jsonBody: { error: 'identity_required', message: 'email or phone is required' } } };

  try {
    const normalized = validateAndNormalizePhone(phoneValue);
    return { ok: true, groupId: gid, identity: { kind: 'phone', phoneE164: normalized.e164 } };
  } catch (error) {
    if (error instanceof PhoneValidationError) return { ok: false, response: { status: 400, jsonBody: { error: 'invalid_phone', message: error.message } } };
    throw error;
  }
};
