const digitsOnly = (value: string): string => value.replace(/\D/g, '');

export class PhoneValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhoneValidationError';
  }
}

export const validateAndNormalizePhone = (input: string, defaultCountry = 'US'): { e164: string; display: string } => {
  const trimmed = input.trim();
  if (!trimmed) throw new PhoneValidationError('Phone is required.');

  let e164: string;
  if (trimmed.startsWith('+')) {
    const digits = `+${digitsOnly(trimmed)}`;
    if (!/^\+\d{8,15}$/.test(digits)) throw new PhoneValidationError('Phone must be a valid E.164 number.');
    e164 = digits;
  } else {
    const digits = digitsOnly(trimmed);
    if (defaultCountry === 'US') {
      if (digits.length === 10) {
        e164 = `+1${digits}`;
      } else if (digits.length === 11 && digits.startsWith('1')) {
        e164 = `+${digits}`;
      } else {
        throw new PhoneValidationError('US phone must have 10 digits (or 11 with country code).');
      }
    } else {
      throw new PhoneValidationError(`Unsupported default country: ${defaultCountry}`);
    }
  }

  const display = e164.startsWith('+1') && e164.length === 12
    ? `(${e164.slice(2, 5)}) ${e164.slice(5, 8)}-${e164.slice(8)}`
    : e164;

  return { e164, display };
};
