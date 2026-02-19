import type { HttpResponseInit } from '@azure/functions';
import type { AppState, Person } from './state.js';
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
