import { FormEvent, useMemo, useState } from 'react';

type TranscriptEntry = {
  role: 'assistant' | 'user';
  text: string;
};

type Snapshot = {
  appointments: Array<{ code: string; title: string; start?: string; end?: string; assigned?: string[] }>;
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
  if (!value) return '—';
  return value.slice(0, 10);
}

function formatTimeRange(start?: string, end?: string) {
  if (!start && !end) return '—';
  const startText = start ? start.slice(11, 16) : '—';
  const endText = end ? end.slice(11, 16) : '—';
  return `${startText}–${endText}`;
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

      if (json.kind === 'reply' || json.kind === 'proposal' || json.kind === 'applied') {
        setTranscript((previous) => [...previous, { role: 'assistant', text: json.assistantText }]);
      } else if (json.kind === 'clarify') {
        setTranscript((previous) => [...previous, { role: 'assistant', text: json.question }]);
      } else {
        setTranscript((previous) => [...previous, { role: 'assistant', text: 'error: unsupported response kind' }]);
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

  const visibleTranscript = useMemo(() => {
    if (showHistory) return transcript;

    const reversed = [...transcript].reverse();
    const lastAssistant = reversed.find((entry) => entry.role === 'assistant');
    const lastUser = reversed.find((entry) => entry.role === 'user');

    return transcript.filter((entry) => entry === lastUser || entry === lastAssistant);
  }, [showHistory, transcript]);

  const historyCount = transcript.length;

  const sortedAppointments = useMemo(() => {
    return [...snapshot.appointments].sort((left, right) => {
      if (left.start && right.start) return left.start.localeCompare(right.start);
      if (left.start) return -1;
      if (right.start) return 1;
      return numericCode(left.code) - numericCode(right.code);
    });
  }, [snapshot.appointments]);

  const sortedAvailability = useMemo(() => {
    return [...snapshot.availability].sort((left, right) => left.start.localeCompare(right.start));
  }, [snapshot.availability]);

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
                    <td>{formatDate(appointment.start)}</td>
                    <td>{formatTimeRange(appointment.start, appointment.end)}</td>
                    <td>{appointment.title}</td>
                    <td>
                      {appointment.assigned?.length
                        ? appointment.assigned.join(', ')
                        : <span className="unassigned-badge">Unassigned</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel" aria-label="Availability">
        <h2>Availability</h2>
        {snapshot.availability.length === 0 ? <p>No availability blocks.</p> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Person</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {sortedAvailability.map((availability) => (
                  <tr key={availability.code}>
                    <td>
                      <button type="button" className="code-button" onClick={() => { void copyCode(availability.code); }}>
                        <code>{availability.code}</code>
                      </button>
                    </td>
                    <td>{availability.personName}</td>
                    <td>{formatDate(availability.start)}</td>
                    <td>{formatTimeRange(availability.start, availability.end)}</td>
                    <td>{availability.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <button type="button" onClick={() => setShowHistory((previous) => !previous)} className="history-toggle">
        History ({historyCount})
      </button>
      <section aria-label="Transcript" className="transcript">
        {visibleTranscript.map((entry, index) => (
          <p key={`${entry.role}-${index}`} className="transcript-line">
            <strong>{entry.role}:</strong> {entry.text}
          </p>
        ))}
      </section>

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
