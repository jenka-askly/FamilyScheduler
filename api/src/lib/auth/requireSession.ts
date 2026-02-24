import type { HttpRequest, HttpResponseInit } from '@azure/functions';
import { HttpError, requireSessionFromRequest } from './sessions.js';

export type SessionResult =
  | { ok: true; email: string; sessionId: string }
  | { ok: false; response: HttpResponseInit };

export const requireSessionEmail = async (request: HttpRequest, traceId: string): Promise<SessionResult> => {
  try {
    const session = await requireSessionFromRequest(request, traceId);
    return { ok: true, email: session.email, sessionId: session.sessionId };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, response: error.response };
    throw error;
  }
};
