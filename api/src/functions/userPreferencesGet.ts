import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { getUserPrefs } from '../lib/prefs/userPrefs.js';

type ClientPrincipal = { userDetails?: string; claims?: Array<{ typ?: string; val?: string }> };

const readEmail = (request: HttpRequest): string | null => {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    const principal = JSON.parse(Buffer.from(header, 'base64').toString('utf8')) as ClientPrincipal;
    if (typeof principal.userDetails === 'string' && principal.userDetails.trim()) return principal.userDetails.trim();
    const emailClaim = principal.claims?.find((claim) => claim.typ === 'email' || claim.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress');
    return emailClaim?.val?.trim() ? emailClaim.val.trim() : null;
  } catch {
    return null;
  }
};

const json = (status: number, body: Record<string, unknown>): HttpResponseInit => ({ status, jsonBody: body });

export async function userPreferencesGet(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const sessionId = request.headers.get('x-session-id')?.trim();
  if (!sessionId) return json(401, { ok: false, message: 'Missing x-session-id header.' });

  const email = readEmail(request);
  if (!email) return json(401, { ok: false, message: 'Authenticated email is required.' });

  const storage = createStorageAdapter();
  const prefs = await getUserPrefs(storage, email);
  return json(200, { ok: true, emailUpdatesEnabled: prefs.emailUpdatesEnabled });
}
