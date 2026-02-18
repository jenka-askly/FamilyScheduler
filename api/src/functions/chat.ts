import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

type ChatRequest = {
  message?: unknown;
};

type PendingProposal = {
  id: string;
  message: string;
};

let pendingProposal: PendingProposal | null = null;

const badRequest = (message: string): HttpResponseInit => ({
  status: 400,
  jsonBody: {
    kind: 'error',
    message
  }
});

const MUTATION_PREFIXES = ['delete ', 'add ', 'update ', 'assign ', 'mark '] as const;

const classifyMessage = (message: string): 'mutation' | 'confirm' | 'query' => {
  const normalized = message.toLowerCase();

  if (normalized === 'confirm') {
    return 'confirm';
  }

  if (MUTATION_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return 'mutation';
  }

  return 'query';
};

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

  const message = body.message.trim();
  const messageType = classifyMessage(message);

  if (messageType === 'mutation') {
    const proposalId = Date.now().toString();
    pendingProposal = {
      id: proposalId,
      message
    };

    return {
      status: 200,
      jsonBody: {
        kind: 'proposal',
        proposalId,
        assistantText: `Please confirm you want to: ${message}. Reply 'confirm' to proceed.`
      }
    };
  }

  if (messageType === 'confirm') {
    if (!pendingProposal) {
      return {
        status: 200,
        jsonBody: {
          kind: 'reply',
          assistantText: 'No pending change.'
        }
      };
    }

    const appliedMessage = pendingProposal.message;
    pendingProposal = null;

    return {
      status: 200,
      jsonBody: {
        kind: 'applied',
        assistantText: `Confirmed and applied: ${appliedMessage}`
      }
    };
  }

  return {
    status: 200,
    jsonBody: {
      kind: 'reply',
      assistantText: `You asked: ${message}`
    }
  };
}

app.http('chat', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'chat',
  handler: chat
});
