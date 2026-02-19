import { FormEvent, Fragment, ReactNode, useEffect, useMemo, useRef, useState } from 'react';

type TranscriptEntry = { role: 'assistant' | 'user'; text: string };
type Snapshot = {
  appointments: Array<{ code: string; desc: string; date: string; startTime?: string; durationMins?: number; isAllDay: boolean; people: string[]; peopleDisplay: string[]; location: string; locationRaw: string; locationDisplay: string; locationMapQuery: string; locationName: string; locationAddress: string; locationDirections: string; notes: string }>;
  people: Array<{ personId: string; name: string; cellDisplay: string; status: 'active' | 'inactive'; timezone?: string; notes?: string }>;
  rules: Array<{ code: string; personId: string; kind: 'available' | 'unavailable'; date: string; startTime?: string; durationMins?: number; timezone?: string; desc?: string }>;
  historyCount?: number;
};

type ChatResponse =
  | { kind: 'reply'; assistantText: string; snapshot?: Snapshot }
  | { kind: 'proposal'; proposalId: string; assistantText: string; snapshot?: Snapshot }
  | { kind: 'applied'; assistantText: string; snapshot?: Snapshot }
  | { kind: 'question'; message: string; options?: Array<{ label: string; value: string; style?: 'primary' | 'secondary' | 'danger' }>; allowFreeText?: boolean; snapshot?: Snapshot };

type PendingQuestion = { message: string; options: Array<{ label: string; value: string; style?: 'primary' | 'secondary' | 'danger' }>; allowFreeText: boolean };

const QuestionDialog = ({
  question,
  value,
  onValueChange,
  onOptionSelect,
  onSubmitText,
  onClose
}: {
  question: PendingQuestion;
  value: string;
  onValueChange: (next: string) => void;
  onOptionSelect: (reply: string) => void;
  onSubmitText: () => void;
  onClose: () => void;
}) => (
  <div className="modal-backdrop">
    <div className="modal">
      <h3>Question</h3>
      <p>{question.message}</p>
      {question.options.length > 0 ? (
        <div className="question-options">
          {question.options.map((option, index) => (
            <button key={`${option.label}-${index}`} type="button" className={`question-option ${option.style ?? 'secondary'}`} onClick={() => onOptionSelect(option.value)}>{option.label}</button>
          ))}
        </div>
      ) : null}
      {question.allowFreeText ? (
        <form onSubmit={(event) => { event.preventDefault(); onSubmitText(); }}>
          <label htmlFor="question-input">Your response</label>
          <div className="input-row">
            <input id="question-input" value={value} onChange={(event) => onValueChange(event.target.value)} autoComplete="off" />
            <button type="submit" disabled={!value.trim()}>Send</button>
          </div>
        </form>
      ) : null}
      <div className="modal-actions"><button type="button" onClick={onClose}>Close</button></div>
    </div>
  </div>
);

const initialSnapshot: Snapshot = { appointments: [], people: [], rules: [] };

const Icon = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);
const Pencil = () => <Icon><path d="M12 20h9" /><path d="m16.5 3.5 4 4L7 21l-4 1 1-4Z" /></Icon>;
const Trash2 = () => <Icon><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></Icon>;
const CheckCircle = () => <Icon><circle cx="12" cy="12" r="9" /><path d="m9 12 2 2 4-4" /></Icon>;
const Ban = () => <Icon><circle cx="12" cy="12" r="9" /><path d="m6 6 12 12" /></Icon>;

const computePersonStatusForInterval = (personId: string, interval: { date: string; startTime?: string; durationMins?: number }, rules: Snapshot['rules']) => {
  const toMin = (time?: string) => (time ? (Number(time.split(':')[0]) * 60) + Number(time.split(':')[1]) : 0);
  const bounds = (startTime?: string, durationMins?: number) => (!startTime ? { s: 0, e: 1440 } : { s: toMin(startTime), e: Math.min(1440, toMin(startTime) + (durationMins ?? 60)) });
  const appt = bounds(interval.startTime, interval.durationMins);
  const overlaps = (a: { s: number; e: number }, b: { s: number; e: number }) => a.s < b.e && a.e > b.s;
  const matching = rules.filter((rule) => rule.personId === personId && rule.date === interval.date).filter((rule) => overlaps(appt, bounds(rule.startTime, rule.durationMins)));
  if (matching.some((rule) => rule.kind === 'unavailable')) return { status: 'unavailable' as const };
  if (matching.some((rule) => rule.kind === 'available')) return { status: 'available' as const };
  return { status: 'unknown' as const };
};

const formatRuleTime = (rule: Snapshot['rules'][0]) => (!rule.startTime ? 'All day' : `${rule.startTime} (${rule.durationMins ?? 60}m)`);

const sortRules = (rules: Snapshot['rules']) => [...rules].sort((a, b) => {
  const byDate = a.date.localeCompare(b.date);
  if (byDate !== 0) return byDate;
  if (!a.startTime && b.startTime) return -1;
  if (a.startTime && !b.startTime) return 1;
  return (a.startTime ?? '').localeCompare(b.startTime ?? '');
});

export function App() {
  const [message, setMessage] = useState('');
  const [view, setView] = useState<'appointments' | 'people'>('appointments');
  const [, setTranscript] = useState<TranscriptEntry[]>([{ role: 'assistant', text: "Type 'help' for examples." }]);
  const [snapshot, setSnapshot] = useState<Snapshot>(initialSnapshot);
  const [proposalText, setProposalText] = useState<string | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null);
  const [questionInput, setQuestionInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingApptCode, setEditingApptCode] = useState<string | null>(null);
  const editingAppointmentRowRef = useRef<HTMLTableRowElement | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Snapshot['appointments'][0] | null>(null);
  const [appointmentToDelete, setAppointmentToDelete] = useState<Snapshot['appointments'][0] | null>(null);
  const [personToDelete, setPersonToDelete] = useState<Snapshot['people'][0] | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<Snapshot['rules'][0] | null>(null);
  const [ruleModal, setRuleModal] = useState<{ person: Snapshot['people'][0]; kind: 'available' | 'unavailable' } | null>(null);
  const [ruleDate, setRuleDate] = useState('');
  const [ruleAllDay, setRuleAllDay] = useState(true);
  const [ruleStartTime, setRuleStartTime] = useState('09:00');
  const [ruleDurationMins, setRuleDurationMins] = useState('60');
  const [ruleDesc, setRuleDesc] = useState('');

  const toggleAppointmentPerson = (appointment: Snapshot['appointments'][0], personId: string) => {
    const selected = new Set(appointment.people);
    if (selected.has(personId)) selected.delete(personId); else selected.add(personId);
    setSelectedAppointment({
      ...appointment,
      people: [...selected],
      peopleDisplay: [...selected].map((id) => snapshot.people.find((p) => p.personId === id)?.name ?? id)
    });
  };

  const sendMessage = async (outgoingMessage: string) => {
    const trimmed = outgoingMessage.trim();
    if (!trimmed) return;
    setTranscript((p) => [...p, { role: 'user', text: trimmed }]);
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: trimmed }) });
      if (!response.ok) {
        setTranscript((p) => [...p, { role: 'assistant', text: 'error: unable to fetch reply' }]);
        return;
      }
      const json = (await response.json()) as ChatResponse;
      if (json.snapshot) setSnapshot(json.snapshot);
      const text = json.kind === 'question' ? json.message : json.assistantText;
      setTranscript((p) => [...p, { role: 'assistant', text }]);
      setProposalText(json.kind === 'proposal' ? json.assistantText : null);
      if (json.kind === 'question') {
        setPendingQuestion({ message: json.message, options: (json.options ?? []).slice(0, 5), allowFreeText: json.allowFreeText !== false });
      } else {
        setPendingQuestion(null);
        setQuestionInput('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendDirectAction = async (action: Record<string, unknown>) => {
    const response = await fetch('/api/direct', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) });
    if (!response.ok) return null;
    const json = await response.json() as { ok: boolean; snapshot?: Snapshot };
    if (json.snapshot) setSnapshot(json.snapshot);
    return json.snapshot ?? null;
  };

  const addAppointment = async () => {
    const previousCodes = new Set(snapshot.appointments.map((appointment) => appointment.code));
    const nextSnapshot = await sendDirectAction({ type: 'create_blank_appointment' });
    const created = nextSnapshot?.appointments.find((appointment) => !previousCodes.has(appointment.code));
    if (created) setEditingApptCode(created.code);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!message.trim() || proposalText || pendingQuestion) return;
    const out = message;
    setMessage('');
    await sendMessage(out);
  };

  const sortedAppointments = useMemo(() => [...snapshot.appointments].sort((a, b) => a.date.localeCompare(b.date)), [snapshot.appointments]);
  const activePeople = snapshot.people.filter((person) => person.status === 'active');
  const peopleInView = snapshot.people.filter((person) => person.status === 'active');

  const openRuleModal = (person: Snapshot['people'][0], kind: 'available' | 'unavailable') => {
    setRuleModal({ person, kind });
    setRuleDate(new Date().toISOString().slice(0, 10));
    setRuleAllDay(true);
    setRuleStartTime('09:00');
    setRuleDurationMins('60');
    setRuleDesc('');
  };

  const submitRuleProposal = async () => {
    if (!ruleModal || !ruleDate) return;
    const sentence = `Add ${ruleModal.kind} rule for personId=${ruleModal.person.personId} on ${ruleDate}${ruleAllDay ? ' allDay=true' : ` startTime=${ruleStartTime} durationMins=${ruleDurationMins}`}${ruleDesc ? ` desc='${ruleDesc.replace(/'/g, '’')}'` : ''}.`;
    setRuleModal(null);
    await sendMessage(sentence);
  };

  useEffect(() => {
    if (!editingApptCode) return;
    const exists = snapshot.appointments.some((appointment) => appointment.code === editingApptCode);
    if (!exists) setEditingApptCode(null);
  }, [editingApptCode, snapshot.appointments]);

  useEffect(() => {
    if (!editingApptCode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEditingApptCode(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [editingApptCode]);

  useEffect(() => {
    if (!editingApptCode) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const editingRow = editingAppointmentRowRef.current;
      const target = event.target;
      if (!editingRow || !(target instanceof Node)) return;
      if (!editingRow.contains(target)) setEditingApptCode(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [editingApptCode]);

  return (
    <main>
      <h1>Scheduler</h1>
      <div className="toggle-row"><button type="button" onClick={() => setView('appointments')} className={view === 'appointments' ? 'active-toggle' : ''}>Appointments</button><button type="button" onClick={() => setView('people')} className={view === 'people' ? 'active-toggle' : ''}>People</button></div>

      {view === 'appointments' ? (
        <section className="panel">
          <div className="panel-header">
            <h2>Appointments</h2>
            <button type="button" onClick={() => void addAppointment()}>Add</button>
          </div>
          {sortedAppointments.length === 0 ? <p>No appointments yet.</p> : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Code</th><th>Date</th><th>Time</th><th>Duration</th><th>Description</th><th>People</th><th>Location</th><th>Notes</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {sortedAppointments.map((appointment) => {
                    const isEditing = editingApptCode === appointment.code;
                    return (
                      <tr key={appointment.code} ref={isEditing ? editingAppointmentRowRef : undefined}>
                        <td><code>{appointment.code}</code></td>
                        <td>
                          {isEditing ? (
                            <input type="date" defaultValue={appointment.date || ''} onBlur={(event) => { const value = event.currentTarget.value; if (value && value !== appointment.date) void sendDirectAction({ type: 'set_appointment_date', code: appointment.code, date: value }); }} />
                          ) : (
                            <span>{appointment.date || '—'}</span>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <div className="time-cell"><input type="time" defaultValue={appointment.startTime ?? ''} onBlur={(event) => { const value = event.currentTarget.value; if (value !== (appointment.startTime ?? '')) void sendDirectAction({ type: 'set_appointment_start_time', code: appointment.code, startTime: value || undefined }); }} /><button type="button" className="compact-button" onClick={() => void sendDirectAction({ type: 'set_appointment_start_time', code: appointment.code })}>Clear</button></div>
                          ) : (
                            <span>{appointment.startTime || (appointment.isAllDay ? 'All day' : '—')}</span>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input type="number" min={1} max={1440} defaultValue={appointment.durationMins ?? ''} onBlur={(event) => { const value = event.currentTarget.value; const normalized = value ? Number(value) : undefined; if (normalized !== appointment.durationMins) void sendDirectAction({ type: 'set_appointment_duration', code: appointment.code, durationMins: normalized }); }} />
                          ) : (
                            <span>{appointment.durationMins ? `${appointment.durationMins}m` : '—'}</span>
                          )}
                        </td>
                        <td className="multiline-cell">
                          {isEditing ? (
                            <textarea rows={2} autoFocus={editingApptCode === appointment.code && !appointment.desc} defaultValue={appointment.desc} onBlur={(event) => { if (event.currentTarget.value !== appointment.desc) void sendDirectAction({ type: 'set_appointment_desc', code: appointment.code, desc: event.currentTarget.value }); }} />
                          ) : (
                            <span className="line-clamp" title={appointment.desc}>{appointment.desc || '—'}</span>
                          )}
                        </td>
                        <td><button type="button" className="linkish" onClick={() => setSelectedAppointment(appointment)}>{appointment.peopleDisplay.length ? appointment.peopleDisplay.join(', ') : 'Unassigned'}</button></td>
                        <td className="multiline-cell">
                          {isEditing ? (
                            <div className="location-cell"><textarea rows={2} defaultValue={appointment.locationRaw ?? appointment.location} title={appointment.locationDisplay || appointment.location} onBlur={(event) => { if (event.currentTarget.value !== (appointment.locationRaw ?? appointment.location)) void sendDirectAction({ type: 'set_appointment_location', code: appointment.code, locationRaw: event.currentTarget.value }); }} /><div className="location-preview-wrap">{appointment.locationDisplay ? <p className="location-preview" title={appointment.locationDisplay}>{appointment.locationDisplay}</p> : <span className="muted-empty">—</span>}{(appointment.locationMapQuery || appointment.locationAddress || appointment.locationDisplay || appointment.locationRaw) ? <a className="location-map-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(appointment.locationMapQuery || appointment.locationAddress || appointment.locationDisplay || appointment.locationRaw)}`} target="_blank" rel="noreferrer">Map</a> : null}</div></div>
                          ) : (
                            <div className="location-preview-wrap"><p className="location-preview" title={appointment.locationDisplay || appointment.location}>{appointment.locationDisplay || appointment.location || '—'}</p>{(appointment.locationMapQuery || appointment.locationAddress || appointment.locationDisplay || appointment.locationRaw) ? <a className="location-map-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(appointment.locationMapQuery || appointment.locationAddress || appointment.locationDisplay || appointment.locationRaw)}`} target="_blank" rel="noreferrer">Map</a> : null}</div>
                          )}
                        </td>
                        <td className="multiline-cell">
                          {isEditing ? (
                            <textarea rows={3} defaultValue={appointment.notes} title={appointment.notes} onBlur={(event) => { if (event.currentTarget.value !== appointment.notes) void sendDirectAction({ type: 'set_appointment_notes', code: appointment.code, notes: event.currentTarget.value }); }} />
                          ) : (
                            <span className="line-clamp" title={appointment.notes}>{appointment.notes || '—'}</span>
                          )}
                        </td>
                        <td>
                          <div className="action-icons">
                            <button type="button" className="icon-button" aria-label={isEditing ? 'Done editing appointment' : 'Edit appointment'} data-tooltip={isEditing ? 'Done (Esc/outside click)' : 'Edit'} onClick={() => setEditingApptCode(isEditing ? null : appointment.code)}>{isEditing ? <CheckCircle /> : <Pencil />}</button>
                            <button type="button" className="icon-button" aria-label="Delete appointment" data-tooltip="Delete appointment" onClick={() => setAppointmentToDelete(appointment)}><Trash2 /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {view === 'people' ? (
        <section className="panel">
          <h2>People</h2>
          <button type="button" onClick={() => { const n = prompt('Name'); const c = prompt('Cell'); if (n && c) void sendMessage(`Add person name=${n} cell=${c}`); }}>Add person</button>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Cell</th><th>Status</th><th>Notes</th><th>Actions</th></tr></thead>
              <tbody>
                {peopleInView.map((person) => {
                  const personRules = sortRules(snapshot.rules.filter((rule) => rule.personId === person.personId));
                  return (
                    <Fragment key={person.personId}>
                      <tr key={person.personId}>
                        <td>{person.name}</td>
                        <td>{person.cellDisplay}</td>
                        <td>{person.status}</td>
                        <td>{person.notes || '—'}</td>
                        <td>
                          <div className="action-icons">
                            <button type="button" className="icon-button" aria-label="Edit" data-tooltip="Edit" onClick={() => { const name = prompt('Name', person.name); const cell = prompt('Cell', person.cellDisplay); if (name || cell) void sendMessage(`Update person personId=${person.personId}${name ? ` name=${name}` : ''}${cell ? ` cell=${cell}` : ''}`); }}><Pencil /></button>
                            <button type="button" className="icon-button" aria-label="Delete" data-tooltip="Delete" onClick={() => setPersonToDelete(person)}><Trash2 /></button>
                            <button type="button" className="icon-button" aria-label="Add available" data-tooltip="Add Available" onClick={() => openRuleModal(person, 'available')}><CheckCircle /></button>
                            <button type="button" className="icon-button" aria-label="Add unavailable" data-tooltip="Add Unavailable" onClick={() => openRuleModal(person, 'unavailable')}><Ban /></button>
                          </div>
                        </td>
                      </tr>
                      {personRules.length > 0 ? (
                        <tr key={`${person.personId}-rules`}>
                          <td colSpan={5} className="rules-cell">
                            <ul className="rules-list">
                              {personRules.map((rule) => (
                                <li key={rule.code} className="rule-item">
                                  <span className={`status-tag ${rule.kind}`}>{rule.kind === 'available' ? 'Available' : 'Unavailable'}</span>
                                  <span>{rule.date}</span>
                                  <span>{formatRuleTime(rule)}</span>
                                  <span className="notes-text" title={rule.desc ?? ''}>{rule.desc || '—'}</span>
                                  <button type="button" className="icon-button" aria-label="Delete rule" data-tooltip="Delete rule" onClick={() => setRuleToDelete(rule)}><Trash2 /></button>
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {view === 'appointments' ? <form onSubmit={onSubmit}><label htmlFor="prompt">What would you like to do?</label><div className="input-row"><input id="prompt" value={message} onChange={(event) => setMessage(event.target.value)} autoComplete="off" disabled={Boolean(proposalText) || Boolean(pendingQuestion)} /><button type="submit" disabled={isSubmitting || Boolean(proposalText) || Boolean(pendingQuestion)}>Send</button></div></form> : null}

      {proposalText ? <div className="modal-backdrop"><div className="modal"><h3>Confirm this change?</h3><p>{proposalText}</p><div className="modal-actions"><button type="button" onClick={() => void sendMessage('confirm')}>Confirm</button><button type="button" onClick={() => void sendMessage('cancel')}>Cancel</button></div></div></div> : null}

      {pendingQuestion ? <QuestionDialog question={pendingQuestion} value={questionInput} onValueChange={setQuestionInput} onOptionSelect={(reply) => { setPendingQuestion(null); setQuestionInput(''); void sendMessage(reply); }} onSubmitText={() => { const out = questionInput.trim(); if (!out) return; setPendingQuestion(null); setQuestionInput(''); void sendMessage(out); }} onClose={() => { setPendingQuestion(null); setQuestionInput(''); }} /> : null}


      {appointmentToDelete ? <div className="modal-backdrop"><div className="modal"><h3>Delete {appointmentToDelete.code} ({appointmentToDelete.desc || 'Untitled'})?</h3><div className="modal-actions"><button type="button" onClick={() => { void sendDirectAction({ type: 'delete_appointment', code: appointmentToDelete.code }); setAppointmentToDelete(null); }}>Confirm</button><button type="button" onClick={() => setAppointmentToDelete(null)}>Cancel</button></div></div></div> : null}

      {personToDelete ? <div className="modal-backdrop"><div className="modal"><h3>Delete person?</h3><p>This will deactivate {personToDelete.name}. Existing history and appointments are preserved.</p><div className="modal-actions"><button type="button" onClick={() => { void sendMessage(`Deactivate person personId=${personToDelete.personId}`); setPersonToDelete(null); }}>Confirm</button><button type="button" onClick={() => setPersonToDelete(null)}>Cancel</button></div></div></div> : null}

      {ruleToDelete ? <div className="modal-backdrop"><div className="modal"><h3>Delete rule {ruleToDelete.code}?</h3><p>This removes the rule from this person.</p><div className="modal-actions"><button type="button" onClick={() => { void sendMessage(`Delete rule ${ruleToDelete.code}`); setRuleToDelete(null); }}>Confirm</button><button type="button" onClick={() => setRuleToDelete(null)}>Cancel</button></div></div></div> : null}

      {ruleModal ? <div className="modal-backdrop"><div className="modal"><h3>{ruleModal.kind === 'available' ? 'Add Available' : 'Add Unavailable'} Rule</h3><div className="field-grid"><label>Date<input type="date" value={ruleDate} onChange={(event) => setRuleDate(event.target.value)} /></label><label className="switch-row">All-day<input type="checkbox" checked={ruleAllDay} onChange={(event) => setRuleAllDay(event.target.checked)} /></label>{!ruleAllDay ? <><label>Start time<input type="time" value={ruleStartTime} onChange={(event) => setRuleStartTime(event.target.value)} /></label><label>Duration<select value={ruleDurationMins} onChange={(event) => setRuleDurationMins(event.target.value)}><option value="30">30 mins</option><option value="60">60 mins</option><option value="90">90 mins</option><option value="120">120 mins</option><option value="180">180 mins</option><option value="240">240 mins</option></select></label></> : null}<label>Notes/reason<input type="text" placeholder="Optional" value={ruleDesc} onChange={(event) => setRuleDesc(event.target.value)} /></label></div><div className="modal-actions"><button type="button" onClick={() => void submitRuleProposal()} disabled={!ruleDate}>Propose</button><button type="button" onClick={() => setRuleModal(null)}>Cancel</button></div></div></div> : null}

      {selectedAppointment ? <div className="modal-backdrop"><div className="modal"><h3>Assign people for {selectedAppointment.code}</h3><div className="picker-list">{activePeople.map((person, index) => {
        const status = computePersonStatusForInterval(person.personId, { date: selectedAppointment.date, startTime: selectedAppointment.startTime, durationMins: selectedAppointment.durationMins }, snapshot.rules);
        const isSelected = selectedAppointment.people.includes(person.personId);
        return <div key={person.personId} className={`picker-row ${index < activePeople.length - 1 ? 'picker-row-divider' : ''}`} onClick={() => toggleAppointmentPerson(selectedAppointment, person.personId)}>
          <div className="picker-left"><input type="checkbox" checked={isSelected} onChange={() => toggleAppointmentPerson(selectedAppointment, person.personId)} onClick={(event) => event.stopPropagation()} /><span className="picker-name">{person.name}</span></div>
          <div className="picker-status-wrap"><span className={`status-tag ${status.status}`}>{status.status === 'available' ? 'Available' : status.status === 'unavailable' ? 'Unavailable' : 'Unknown'}</span></div>
        </div>;
      })}</div><div className="modal-actions"><button type="button" onClick={() => { void sendMessage(`Replace people on appointment code=${selectedAppointment.code} people=${selectedAppointment.people.join(',')}`); setSelectedAppointment(null); }}>Apply</button><button type="button" onClick={() => setSelectedAppointment(null)}>Close</button></div></div></div> : null}
    </main>
  );
}
