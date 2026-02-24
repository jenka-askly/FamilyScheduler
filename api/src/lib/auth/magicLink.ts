import { createHmac, timingSafeEqual } from 'node:crypto';

export class InvalidTokenError extends Error {
  constructor(message = 'invalid_token') {
    super(message);
    this.name = 'InvalidTokenError';
  }
}

export class ExpiredTokenError extends Error {
  constructor(message = 'expired_token') {
    super(message);
    this.name = 'ExpiredTokenError';
  }
}

export class ConfigMissingError extends Error {
  readonly missing: string[];

  constructor(missing: string[], message = 'Required configuration is missing.') {
    super(message);
    this.name = 'ConfigMissingError';
    this.missing = [...missing].sort();
  }
}

export type MagicLinkPayload = {
  v: 1;
  sub: string;
  jti: string;
  purpose: 'login';
  exp: number;
  iat: number;
  returnTo?: string;
};

const isPlausibleEmail = (email: string): boolean => {
  const trimmed = email.trim();
  const atIdx = trimmed.indexOf('@');
  if (atIdx <= 0) return false;
  const domain = trimmed.slice(atIdx + 1);
  return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.');
};

const base64urlEncode = (input: string | Uint8Array): string => Buffer.from(input).toString('base64url');

const base64urlDecodeToString = (input: string): string => {
  try {
    return Buffer.from(input, 'base64url').toString('utf8');
  } catch {
    throw new InvalidTokenError('invalid_token_format');
  }
};

const validatePayload = (payload: unknown, nowUnixSeconds: number): MagicLinkPayload => {
  if (!payload || typeof payload !== 'object') throw new InvalidTokenError('invalid_payload');
  const candidate = payload as Partial<MagicLinkPayload>;

  if (candidate.v !== 1) throw new InvalidTokenError('invalid_version');
  if (candidate.purpose !== 'login') throw new InvalidTokenError('invalid_purpose');
  if (typeof candidate.sub !== 'string' || !isPlausibleEmail(candidate.sub)) throw new InvalidTokenError('invalid_subject');
  if (typeof candidate.jti !== 'string' || !candidate.jti.trim()) throw new InvalidTokenError('invalid_jti');
  if (typeof candidate.iat !== 'number' || !Number.isFinite(candidate.iat)) throw new InvalidTokenError('invalid_iat');
  if (typeof candidate.exp !== 'number' || !Number.isFinite(candidate.exp)) throw new InvalidTokenError('invalid_exp');
  if (candidate.exp <= nowUnixSeconds) throw new ExpiredTokenError('expired_token');
  if (candidate.returnTo !== undefined && (typeof candidate.returnTo !== 'string' || candidate.returnTo.length > 200)) {
    throw new InvalidTokenError('invalid_return_to');
  }

  return {
    v: 1,
    sub: candidate.sub,
    jti: candidate.jti,
    purpose: 'login',
    exp: candidate.exp,
    iat: candidate.iat,
    ...(candidate.returnTo ? { returnTo: candidate.returnTo } : {})
  };
};

export const sign = (payload: MagicLinkPayload, secret: string): string => {
  if (!secret?.trim()) throw new ConfigMissingError(['MAGIC_LINK_SECRET']);
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const signature = createHmac('sha256', secret).update(encodedPayload).digest();
  return `${encodedPayload}.${base64urlEncode(signature)}`;
};

export const verify = (token: string, secret: string): MagicLinkPayload => {
  if (!secret?.trim()) throw new ConfigMissingError(['MAGIC_LINK_SECRET']);
  if (typeof token !== 'string') throw new InvalidTokenError('invalid_token_type');

  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new InvalidTokenError('invalid_token_format');
  const [payloadPart, signaturePart] = parts;

  const expectedSignature = createHmac('sha256', secret).update(payloadPart).digest();
  let providedSignature: Buffer;
  try {
    providedSignature = Buffer.from(signaturePart, 'base64url');
  } catch {
    throw new InvalidTokenError('invalid_signature_format');
  }

  if (expectedSignature.length !== providedSignature.length || !timingSafeEqual(expectedSignature, providedSignature)) {
    throw new InvalidTokenError('invalid_signature');
  }

  const decodedPayload = base64urlDecodeToString(payloadPart);
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodedPayload);
  } catch {
    throw new InvalidTokenError('invalid_payload_json');
  }

  return validatePayload(parsed, Math.floor(Date.now() / 1000));
};
