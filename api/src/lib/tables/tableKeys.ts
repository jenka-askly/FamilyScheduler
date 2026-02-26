export const TABLE_KEY_SEP = '|';

const INVALID_TABLE_KEY_CHARS = /[#/\\?]|[\u0000-\u001F\u007F]/;

export const validateTableKey = (value: string): void => {
  if (INVALID_TABLE_KEY_CHARS.test(value)) {
    throw new Error('Invalid Azure Table key character');
  }
};

