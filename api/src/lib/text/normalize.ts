export const normalizeUserText = (value: string): string => value
  .trim()
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .replace(/[?!.,:;]+$/g, '');
