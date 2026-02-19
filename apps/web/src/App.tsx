import { FormEvent, useMemo, useState } from 'react';

type TranscriptEntry = {
  role: 'assistant' | 'user';
  text: string;
};

type Snapshot = {
  appointments: Array<{ code: string; desc: string; date: string; startTime?: string; durationMins?: number; isAllDay: boolean; people: string[]; location: string }>;
  availability: Array<{ code: string; personName: string; start: string; end: string; reason?: string }>;
  historyCount?: number;
};

type ChatResponse =
  | {
      kind: 'reply';
      assistantText: string;
      snapshot?: Snapshot;
    }
  | {
      kind: 'proposal';
      proposalId: string;
      assistantText: string;
      snapshot?: Snapshot;
    }
  | {
      kind: 'applied';
      assistantText: string;
      snapshot?: Snapshot;
    }
  | {
      kind: 'clarify';
      question: string;
      snapshot?: Snapshot;
    };

const initialSnapshot: Snapshot = { appointments: [], availability: [] };

function formatDate(value?: string) {
  return value || '—';
}

function formatTimeRange(startTime?: string, durationMins?: number, isAllDay?: boolean) {
  if (isAllDay) return 'All day';
  if (!startTime) return '—';
  return `${startTime} (${durationMins ?? 60}m)`;
}

function numericCode(code: string) {
  const digits = code.match(/\d+/g)?.join('') ?? '';
  return Number.parseInt(digits, 10) || Number.MAX_SAFE_INTEGER;
}

export function App() {
  const [message, setMessage] = useState('');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([
    { role: 'assistant', text: "Type 'help' for examples." }
  ]);
  const [snapshot, setSnapshot] = useState<Snapshot>(initialSnapshot);
  const [showHistory, setShowHistory] = useState(false);
  const [proposalText, setProposalText] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResponseKind, setLastResponseKind] = useState<ChatResponse['kind'] | null>(null);
  const [assistantPrompt, setAssistantPrompt] = useState<string | null>(null);

  const sendMessage = async (outgoingMessage: string) => {
    const trimmed = outgoingMessage.trim();
    if (!trimmed) return;

    setTranscript((previous) => [...previous, { role: 'user', text: trimmed }]);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ message: trimmed })
      });

      if (!response.ok) {
        setTranscript((previous) => [...previous, { role: 'assistant', text: 'error: unable to fetch reply' }]);
        return;
      }

      const json = (await response.json()) as ChatResponse;
      if (json.snapshot) setSnapshot(json.snapshot);
      setLastResponseKind(json.kind);

      if (json.kind === 'reply' || json.kind === 'proposal' || json.kind === 'applied') {
        setTranscript((previous) => [...previous, { role: 'assistant', text: json.assistantText }]);
        setAssistantPrompt(null);
      } else if (json.kind === 'clarify') {
        setTranscript((previous) => [...previous, { role: 'assistant', text: json.question }]);
        setAssistantPrompt(json.question);
      } else {
        setTranscript((previous) => [...previous, { role: 'assistant', text: 'error: unsupported response kind' }]);
        setAssistantPrompt(null);
      }

      if (json.kind === 'proposal') {
        setProposalText(json.assistantText);
      } else {
        setProposalText(null);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = message.trim();

    if (!trimmed || proposalText) {
      return;
    }

    setMessage('');
    await sendMessage(trimmed);
  };

  const historyCount = transcript.length;

  const sortedAppointments = useMemo(() => {
    return [...snapshot.appointments].sort((left, right) => {
      if (left.date && right.date) return left.date.localeCompare(right.date);
      return numericCode(left.code) - numericCode(right.code);
    });
  }, [snapshot.appointments]);

  const copyCode = async (code: string) => {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(code);
  };

  return (
    <main>
      <h1>FamilyScheduler</h1>

      <section className="panel" aria-label="Appointments">
        <h2>Appointments</h2>
        {snapshot.appointments.length === 0 ? <p>No appointments yet.</p> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Description</th>
                  <th>People</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {sortedAppointments.map((appointment) => (
                  <tr key={appointment.code}>
                    <td>
                      <button type="button" className="code-button" onClick={() => { void copyCode(appointment.code); }}>
                        <code>{appointment.code}</code>
                      </button>
                    </td>
                    <td>{formatDate(appointment.date)}</td>
                    <td>{formatTimeRange(appointment.startTime, appointment.durationMins, appointment.isAllDay)}</td>
                    <td>{appointment.desc}</td>
                    <td>
                      {appointment.people?.length
                        ? appointment.people.join(', ')
                        : <span className="unassigned-badge">Unassigned</span>}
                    </td>
                    <td>{appointment.location || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {lastResponseKind === 'clarify' && assistantPrompt ? (
        <section className="assistant-prompt" aria-label="Assistant prompt">
          <p className="assistant-prompt-label">Assistant</p>
          <p className="assistant-prompt-text">{assistantPrompt}</p>
        </section>
      ) : null}

      <button type="button" onClick={() => setShowHistory((previous) => !previous)} className="history-toggle">
        {showHistory ? 'Hide history' : `History (${historyCount})`}
      </button>
      {showHistory ? (
        <section aria-label="Transcript" className="transcript">
          {transcript.map((entry, index) => (
            <p key={`${entry.role}-${index}`} className="transcript-line">
              <strong>{entry.role}:</strong> {entry.text}
            </p>
          ))}
        </section>
      ) : null}

      <form onSubmit={onSubmit}>
        <label htmlFor="prompt">What would you like to do?</label>
        <div className="input-row">
          <input
            id="prompt"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            autoComplete="off"
            placeholder="What would you like to do?"
            disabled={Boolean(proposalText)}
          />
          <button type="submit" disabled={isSubmitting || Boolean(proposalText)}>Send</button>
        </div>
      </form>

      {proposalText ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirm this change?">
          <div className="modal">
            <h3>Confirm this change?</h3>
            <p>{proposalText}</p>
            <div className="modal-actions">
              <button type="button" onClick={() => { void sendMessage('confirm'); }}>Confirm</button>
              <button type="button" onClick={() => { void sendMessage('cancel'); }}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
