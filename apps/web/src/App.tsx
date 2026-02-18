import { FormEvent, useState } from 'react';

type TranscriptEntry = {
  role: 'assistant' | 'user';
  text: string;
};

type ChatResponse =
  | {
      kind: 'reply';
      assistantText: string;
    }
  | {
      kind: 'proposal';
      proposalId: string;
      assistantText: string;
    }
  | {
      kind: 'applied';
      assistantText: string;
    }
  | {
      kind: 'clarify';
      question: string;
    };

export function App() {
  const [message, setMessage] = useState('');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([
    { role: 'assistant', text: "Type 'help' for examples." }
  ]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = message.trim();

    if (!trimmed) {
      return;
    }

    setTranscript((previous) => [...previous, { role: 'user', text: trimmed }]);
    setMessage('');

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

    if (json.kind === 'reply' || json.kind === 'proposal' || json.kind === 'applied') {
      setTranscript((previous) => [...previous, { role: 'assistant', text: json.assistantText }]);
      return;
    }

    if (json.kind === 'clarify') {
      setTranscript((previous) => [...previous, { role: 'assistant', text: json.question }]);
      return;
    }

    setTranscript((previous) => [...previous, { role: 'assistant', text: 'error: unsupported response kind' }]);
  };

  return (
    <main>
      <h1>FamilyScheduler</h1>
      <section aria-label="Transcript" className="transcript">
        {transcript.map((entry, index) => (
          <p key={`${entry.role}-${index}`} className="transcript-line">
            <strong>{entry.role}:</strong> {entry.text}
          </p>
        ))}
      </section>

      <form onSubmit={onSubmit}>
        <label htmlFor="prompt">Prompt</label>
        <input
          id="prompt"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          autoComplete="off"
        />
      </form>
    </main>
  );
}
