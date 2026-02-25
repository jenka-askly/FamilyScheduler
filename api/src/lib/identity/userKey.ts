import { createHash } from 'node:crypto';

export const normalizeIdentityEmail = (email: string): string => email.trim().toLowerCase();

export const userKeyFromEmail = (email: string): string => createHash('sha256').update(normalizeIdentityEmail(email)).digest('hex');
