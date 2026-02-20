export class MissingConfigError extends Error {
  readonly missing: string[];

  constructor(missing: string[], message = 'Required configuration is missing.') {
    super(message);
    this.name = 'MissingConfigError';
    this.missing = [...missing].sort();
  }
}

export const isMissingConfigError = (value: unknown): value is MissingConfigError => value instanceof MissingConfigError;
