import type { HttpRequest, HttpResponseInit } from '@azure/functions';
import { requireSessionFromRequest } from './sessions.js';

export const requireSessionEmail = async (request: HttpRequest, traceId: string): Promise<{ email: string; sessionId: string } | HttpResponseInit> => {
  try {
    return await requireSessionFromRequest(request, traceId);
  } catch (error) {
    if (error instanceof Error && (error as { response?: HttpResponseInit }).response) return (error as { response: HttpResponseInit }).response;
    throw error;
  }
};
