import { type Action } from '../actions/schema.js';
import { type AppState } from '../state.js';

export type ChatHistoryEntry = { role: 'user' | 'assistant'; text: string; ts: string };

export type OpenAiContextEnvelope = {
  nowIso: string;
  timezone: 'America/Los_Angeles';
  identity?: { name: string };
  pending?: {
    proposal?: { summary: string; actions: Action[] };
    clarification?: { question: string; partialAction: Action; missing: string[] };
  };
  data: {
    appointments: AppState['appointments'];
    rules: AppState['rules'];
    people: AppState['people'];
  };
  history: ChatHistoryEntry[];
};

const MAX_HISTORY_MESSAGES = Number(process.env.OPENAI_HISTORY_MAX_MESSAGES ?? '100');
const MAX_HISTORY_CHARS = Number(process.env.OPENAI_HISTORY_MAX_CHARS ?? '20000');

const trimHistory = (history: ChatHistoryEntry[]): ChatHistoryEntry[] => {
  const limited = history.slice(-Math.max(1, MAX_HISTORY_MESSAGES));
  let runningChars = 0;
  const kept: ChatHistoryEntry[] = [];
  for (const item of [...limited].reverse()) {
    const nextChars = item.text.length + runningChars;
    if (nextChars > MAX_HISTORY_CHARS) {
      if (item.role === 'assistant') continue;
      const remaining = Math.max(0, MAX_HISTORY_CHARS - runningChars);
      if (remaining === 0) continue;
      kept.push({ ...item, text: item.text.slice(0, remaining) });
      runningChars = MAX_HISTORY_CHARS;
      continue;
    }
    kept.push(item);
    runningChars = nextChars;
  }
  return kept.reverse();
};

export const buildContext = (params: {
  state: AppState;
  identityName?: string | null;
  pendingProposal?: { summary: string; actions: Action[] } | null;
  pendingClarification?: { question: string; partialAction: Action; missing: string[] } | null;
  history: ChatHistoryEntry[];
}): OpenAiContextEnvelope => ({
  nowIso: new Date().toISOString(),
  timezone: 'America/Los_Angeles',
  identity: params.identityName ? { name: params.identityName } : undefined,
  pending: {
    proposal: params.pendingProposal ?? undefined,
    clarification: params.pendingClarification ?? undefined
  },
  data: {
    appointments: params.state.appointments,
    rules: params.state.rules,
    people: params.state.people
  },
  history: trimHistory(params.history)
});
