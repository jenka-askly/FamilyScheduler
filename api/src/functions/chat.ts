import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

type ChatRequest = {
  message?: unknown;
};

const badRequest = (message: string): HttpResponseInit => ({
  status: 400,
  jsonBody: {
    kind: 'error',
    message
  }
});

export async function chat(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  let body: ChatRequest;

  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return badRequest('message is required');
  }

  if (typeof body.message !== 'string' || body.message.trim().length === 0) {
    return badRequest('message is required');
  }

  return {
    status: 200,
    jsonBody: {
      kind: 'reply',
      assistantText: `echo: ${body.message}`,
      stateVersion: 0
    }
  };
}

app.http('chat', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'chat',
  handler: chat
});
