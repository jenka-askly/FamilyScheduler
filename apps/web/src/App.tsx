import { FormEvent, useMemo, useState } from 'react';

type TranscriptEntry = { role: 'assistant' | 'user'; text: string };
type Snapshot = {
  appointments: Array<{ code: string; desc: string; date: string; startTime?: string; durationMins?: number; isAllDay: boolean; people: string[]; peopleDisplay: string[]; location: string; notes: string }>;
  people: Array<{ personId: string; name: string; cellDisplay: string; status: 'active' | 'inactive'; timezone?: string; notes?: string }>;
  rules: Array<{ code: string; personId: string; kind: 'available' | 'unavailable'; date: string; startTime?: string; durationMins?: number; desc?: string }>;
  historyCount?: number;
};

type ChatResponse = { kind: 'reply'; assistantText: string; snapshot?: Snapshot } | { kind: 'proposal'; proposalId: string; assistantText: string; snapshot?: Snapshot } | { kind: 'applied'; assistantText: string; snapshot?: Snapshot } | { kind: 'clarify'; question: string; snapshot?: Snapshot };

const initialSnapshot: Snapshot = { appointments: [], people: [], rules: [] };

const computePersonStatusForInterval = (personId: string, interval: { date: string; startTime?: string; durationMins?: number }, rules: Snapshot['rules']) => {
  const toMin = (time?: string) => time ? (Number(time.split(':')[0]) * 60) + Number(time.split(':')[1]) : 0;
  const bounds = (startTime?: string, durationMins?: number) => !startTime ? { s: 0, e: 1440 } : { s: toMin(startTime), e: Math.min(1440, toMin(startTime) + (durationMins ?? 60)) };
  const appt = bounds(interval.startTime, interval.durationMins);
  const overlaps = (a: { s: number; e: number }, b: { s: number; e: number }) => a.s < b.e && a.e > b.s;
  const matching = rules.filter((rule) => rule.personId === personId && rule.date === interval.date).filter((rule) => overlaps(appt, bounds(rule.startTime, rule.durationMins)));
  if (matching.some((rule) => rule.kind === 'unavailable')) return { status: 'unavailable' as const };
  if (matching.some((rule) => rule.kind === 'available')) return { status: 'available' as const };
  return { status: 'unknown' as const };
};

export function App() {
  const [message, setMessage] = useState('');
  const [view, setView] = useState<'appointments' | 'people'>('appointments');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([{ role: 'assistant', text: "Type 'help' for examples." }]);
  const [snapshot, setSnapshot] = useState<Snapshot>(initialSnapshot);
  const [proposalText, setProposalText] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Snapshot['appointments'][0] | null>(null);

  const sendMessage = async (outgoingMessage: string) => {
    const trimmed = outgoingMessage.trim(); if (!trimmed) return;
    setTranscript((p) => [...p, { role: 'user', text: trimmed }]); setIsSubmitting(true);
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: trimmed }) });
      if (!response.ok) { setTranscript((p) => [...p, { role: 'assistant', text: 'error: unable to fetch reply' }]); return; }
      const json = (await response.json()) as ChatResponse;
      if (json.snapshot) setSnapshot(json.snapshot);
      const text = json.kind === 'clarify' ? json.question : json.assistantText;
      setTranscript((p) => [...p, { role: 'assistant', text }]);
      setProposalText(json.kind === 'proposal' ? json.assistantText : null);
    } finally { setIsSubmitting(false); }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!message.trim() || proposalText) return; const out = message; setMessage(''); await sendMessage(out); };

  const sortedAppointments = useMemo(() => [...snapshot.appointments].sort((a, b) => a.date.localeCompare(b.date)), [snapshot.appointments]);
  const activePeople = snapshot.people.filter((person) => person.status === 'active');

  return (
    <main>
      <h1>Scheduler</h1>
      <div className="toggle-row"><button type="button" onClick={() => setView('appointments')} className={view === 'appointments' ? 'active-toggle' : ''}>Appointments</button><button type="button" onClick={() => setView('people')} className={view === 'people' ? 'active-toggle' : ''}>People</button></div>

      {view === 'appointments' ? <section className="panel"><h2>Appointments</h2>{sortedAppointments.length === 0 ? <p>No appointments yet.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Code</th><th>Date</th><th>Time</th><th>Description</th><th>People</th><th>Location</th><th>Notes</th></tr></thead><tbody>{sortedAppointments.map((appointment) => <tr key={appointment.code}><td><code>{appointment.code}</code></td><td>{appointment.date || '—'}</td><td>{appointment.isAllDay ? 'All day' : `${appointment.startTime ?? '—'} (${appointment.durationMins ?? 60}m)`}</td><td>{appointment.desc}</td><td><button type="button" className="linkish" onClick={() => setSelectedAppointment(appointment)}>{appointment.peopleDisplay.length ? appointment.peopleDisplay.join(', ') : 'Unassigned'}</button></td><td>{appointment.location || '—'}</td><td>{appointment.notes || '—'}</td></tr>)}</tbody></table></div>}</section> : null}

      {view === 'people' ? <section className="panel"><h2>People</h2><button type="button" onClick={() => { const n = prompt('Name'); const c = prompt('Cell'); if (n && c) void sendMessage(`Add person name=${n} cell=${c}`); }}>Add person</button><div className="table-wrap"><table className="data-table"><thead><tr><th>Name</th><th>Cell</th><th>Status</th><th>Notes</th><th>Actions</th></tr></thead><tbody>{snapshot.people.map((person) => <tr key={person.personId}><td>{person.name}</td><td>{person.cellDisplay}</td><td>{person.status}</td><td>{person.notes || '—'}</td><td><button type="button" onClick={() => { const name = prompt('Name', person.name); const cell = prompt('Cell', person.cellDisplay); if (name || cell) void sendMessage(`Update person personId=${person.personId}${name ? ` name=${name}` : ''}${cell ? ` cell=${cell}` : ''}`); }}>Edit</button><button type="button" onClick={() => void sendMessage(`${person.status === 'active' ? 'Deactivate' : 'Reactivate'} person personId=${person.personId}`)}>{person.status === 'active' ? 'Deactivate' : 'Reactivate'}</button><button type="button" onClick={() => { const date = prompt('Date YYYY-MM-DD'); if (!date) return; const allDay = confirm('All day?'); const start = allDay ? '' : (prompt('Start HH:MM') ?? ''); const duration = allDay ? '' : (prompt('Duration mins') ?? '60'); void sendMessage(`Add ${'available'} rule personId=${person.personId} date=${date}${allDay ? '' : ` startTime=${start} durationMins=${duration}`}`); }}>Add Available...</button><button type="button" onClick={() => { const date = prompt('Date YYYY-MM-DD'); if (!date) return; const allDay = confirm('All day?'); const start = allDay ? '' : (prompt('Start HH:MM') ?? ''); const duration = allDay ? '' : (prompt('Duration mins') ?? '60'); void sendMessage(`Add unavailable rule personId=${person.personId} date=${date}${allDay ? '' : ` startTime=${start} durationMins=${duration}`}`); }}>Add Unavailable...</button></td></tr>)}</tbody></table></div></section> : null}

      <form onSubmit={onSubmit}><label htmlFor="prompt">What would you like to do?</label><div className="input-row"><input id="prompt" value={message} onChange={(event) => setMessage(event.target.value)} autoComplete="off" disabled={Boolean(proposalText)} /><button type="submit" disabled={isSubmitting || Boolean(proposalText)}>Send</button></div></form>

      {proposalText ? <div className="modal-backdrop"><div className="modal"><h3>Confirm this change?</h3><p>{proposalText}</p><div className="modal-actions"><button type="button" onClick={() => void sendMessage('confirm')}>Confirm</button><button type="button" onClick={() => void sendMessage('cancel')}>Cancel</button></div></div></div> : null}

      {selectedAppointment ? <div className="modal-backdrop"><div className="modal"><h3>Assign people for {selectedAppointment.code}</h3>{activePeople.map((person) => {
        const status = computePersonStatusForInterval(person.personId, { date: selectedAppointment.date, startTime: selectedAppointment.startTime, durationMins: selectedAppointment.durationMins }, snapshot.rules);
        return <label key={person.personId} className="picker-row"><input type="checkbox" defaultChecked={selectedAppointment.people.includes(person.personId)} onChange={(e) => {
          const selected = new Set(selectedAppointment.people);
          if (e.target.checked) selected.add(person.personId); else selected.delete(person.personId);
          setSelectedAppointment({ ...selectedAppointment, people: [...selected], peopleDisplay: [...selected].map((id) => snapshot.people.find((p) => p.personId === id)?.name ?? id) });
        }} />{person.name}<span className={`status-tag ${status.status}`}>{status.status}</span></label>;
      })}<div className="modal-actions"><button type="button" onClick={() => { void sendMessage(`Replace people on appointment code=${selectedAppointment.code} people=${selectedAppointment.people.join(',')}`); setSelectedAppointment(null); }}>Apply</button><button type="button" onClick={() => setSelectedAppointment(null)}>Close</button></div></div></div> : null}
    </main>
  );
}
