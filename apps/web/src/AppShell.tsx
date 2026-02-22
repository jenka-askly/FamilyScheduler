import { FormEvent, Fragment, KeyboardEvent as ReactKeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { FooterHelp } from './components/layout/FooterHelp';
import { Page } from './components/layout/Page';
import { PageHeader } from './components/layout/PageHeader';
import { apiUrl } from './lib/apiUrl';
import { buildInfo } from './lib/buildInfo';
import type { TimeSpec } from '../../../packages/shared/src/types.js';

type TranscriptEntry = { role: 'assistant' | 'user'; text: string };
type Snapshot = {
  appointments: Array<{ code: string; desc: string; schemaVersion?: number; updatedAt?: string; time: TimeSpec; date: string; startTime?: string; durationMins?: number; isAllDay: boolean; people: string[]; peopleDisplay: string[]; location: string; locationRaw: string; locationDisplay: string; locationMapQuery: string; locationName: string; locationAddress: string; locationDirections: string; notes: string }>;
  people: Array<{ personId: string; name: string; cellDisplay: string; cellE164: string; status: 'active' | 'removed'; lastSeen?: string; timezone?: string; notes?: string }>;
  rules: Array<{ code: string; schemaVersion?: number; personId: string; kind: 'available' | 'unavailable'; time: TimeSpec; date: string; startTime?: string; durationMins?: number; timezone?: string; desc?: string; promptId?: string; originalPrompt?: string; startUtc?: string; endUtc?: string }>;
  historyCount?: number;
};

type DraftWarning = { message: string; status: 'available' | 'unavailable'; interval: string; code: string };
type ChatResponse =
  | { kind: 'reply'; assistantText?: string; snapshot?: Snapshot; draftRules?: Array<{ personId: string; status: 'available' | 'unavailable'; startUtc: string; endUtc: string }>; preview?: string[]; assumptions?: string[]; warnings?: DraftWarning[]; promptId?: string; draftError?: { message: string; hints?: string[]; code?: string; traceId?: string }; error?: string }
  | { kind: 'proposal'; proposalId: string; assistantText: string; snapshot?: Snapshot }
  | { kind: 'applied'; assistantText: string; snapshot?: Snapshot; assumptions?: string[] }
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

const debugAuthLogsEnabled = import.meta.env.VITE_DEBUG_AUTH_LOGS === 'true';
const authLog = (payload: Record<string, unknown>): void => {
  if (!debugAuthLogsEnabled) return;
  console.log(payload);
};

const Icon = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);
const Pencil = () => <Icon><path d="M12 20h9" /><path d="m16.5 3.5 4 4L7 21l-4 1 1-4Z" /></Icon>;
const Trash2 = () => <Icon><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></Icon>;
const CheckCircle = () => <Icon><circle cx="12" cy="12" r="9" /><path d="m9 12 2 2 4-4" /></Icon>;
const Clock3 = () => <Icon><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>;

const rangesOverlap = (a: { startMs: number; endMs: number }, b: { startMs: number; endMs: number }) => a.startMs < b.endMs && b.startMs < a.endMs;


const formatLastSeen = (lastSeen?: string): string => {
  if (!lastSeen) return '—';
  const parsed = new Date(lastSeen);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString();
};

const getUtcBoundsForRule = (rule: Snapshot['rules'][0]) => {
  if (rule.time?.resolved?.startUtc && rule.time?.resolved?.endUtc) return { startMs: Date.parse(rule.time.resolved.startUtc), endMs: Date.parse(rule.time.resolved.endUtc) };
  if (rule.startUtc && rule.endUtc) {
    const startMs = Date.parse(rule.startUtc);
    const endMs = Date.parse(rule.endUtc);
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) return { startMs, endMs };
  }
  const start = new Date(rule.startTime ? `${rule.date}T${rule.startTime}:00` : `${rule.date}T00:00:00`);
  const startMs = start.getTime();
  if (Number.isNaN(startMs)) return null;
  const durationMins = rule.startTime ? (rule.durationMins ?? 60) : (rule.durationMins ?? 1440);
  return { startMs, endMs: startMs + (durationMins * 60_000) };
};

const getUtcBoundsForAppt = (appt: Snapshot['appointments'][0]) => {
  if (appt.time?.resolved?.startUtc && appt.time?.resolved?.endUtc) return { startMs: Date.parse(appt.time.resolved.startUtc), endMs: Date.parse(appt.time.resolved.endUtc) };
  if (appt.isAllDay) {
    const dayStart = new Date(`${appt.date}T00:00:00`);
    const startMs = dayStart.getTime();
    if (Number.isNaN(startMs)) return null;
    const nextDay = new Date(dayStart);
    nextDay.setDate(nextDay.getDate() + 1);
    return { startMs, endMs: nextDay.getTime() };
  }
  if (!appt.startTime) return null;
  const start = new Date(`${appt.date}T${appt.startTime}:00`);
  const startMs = start.getTime();
  if (Number.isNaN(startMs)) return null;
  const durationMins = appt.durationMins ?? 60;
  return { startMs, endMs: startMs + (durationMins * 60_000) };
};

const isAllDayRule = (rule: Snapshot['rules'][0]) => (
  (rule as Snapshot['rules'][0] & { isAllDay?: boolean }).isAllDay === true || !rule.startTime || rule.durationMins === 1440
);

const formatRuleRangeForList = (rule: Snapshot['rules'][0], personTz?: string) => {
  const timezone = personTz;
  const dayFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: timezone });
  const dateTimeFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone });
  const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone });

  const interval = getUtcBoundsForRule(rule);
  if (!interval) return rule.date;

  const start = new Date(interval.startMs);
  const end = new Date(interval.endMs);
  const allDay = isAllDayRule(rule);

  if (allDay) {
    const inclusiveEnd = new Date(interval.endMs - 86400000);
    const sameDay = start.toDateString() === inclusiveEnd.toDateString();
    if (sameDay) return `${dayFormatter.format(start)} (all day)`;
    return `${dayFormatter.format(start)}–${dayFormatter.format(inclusiveEnd)} (all day)`;
  }

  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) return `${dateTimeFormatter.format(start)}–${timeFormatter.format(end)}`;
  return `${dateTimeFormatter.format(start)}–${dateTimeFormatter.format(end)}`;
};

const computePersonStatusForInterval = (personId: string, appointment: Snapshot['appointments'][0], rules: Snapshot['rules']) => {
  const appointmentRange = getUtcBoundsForAppt(appointment);
  if (appointment.time?.intent?.status !== 'resolved') return { status: 'unreconcilable' as const };
  if (!appointmentRange) return { status: 'unreconcilable' as const };
  const overlappingRules = rules
    .filter((rule) => rule.personId === personId)
    .map((rule) => ({ rule, range: getUtcBoundsForRule(rule) }))
    .filter((entry): entry is { rule: Snapshot['rules'][0]; range: { startMs: number; endMs: number } } => Boolean(entry.range))
    .filter((entry) => rangesOverlap(appointmentRange, entry.range))
    .map((entry) => entry.rule);

  if (overlappingRules.some((rule) => rule.kind === 'unavailable')) return { status: 'conflict' as const };
  return { status: 'no_conflict' as const };
};

const formatDraftRuleRange = (startUtc: string, endUtc: string) => {
  const start = new Date(startUtc);
  const end = new Date(endUtc);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return `${startUtc} → ${endUtc}`;
  const sameDay = start.toISOString().slice(0, 10) === end.toISOString().slice(0, 10);
  const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });
  if (sameDay) return `${dateFormatter.format(start)} ${timeFormatter.format(start)} → ${timeFormatter.format(end)} UTC`;
  return `${dateFormatter.format(start)} ${timeFormatter.format(start)} → ${dateFormatter.format(end)} ${timeFormatter.format(end)} UTC`;
};

const formatAppointmentTime = (appointment: Snapshot['appointments'][0]) => {
  if (appointment.time?.intent?.status !== 'resolved' || !appointment.time.resolved) return 'Unresolved';
  return formatDraftRuleRange(appointment.time.resolved.startUtc, appointment.time.resolved.endUtc).replace(' UTC', '');
};

const isAllDayDraftRule = (startUtc: string, endUtc: string) => {
  const start = new Date(startUtc);
  const end = new Date(endUtc);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return start.getUTCHours() === 0
    && start.getUTCMinutes() === 0
    && start.getUTCSeconds() === 0
    && end.getUTCHours() === 0
    && end.getUTCMinutes() === 0
    && end.getUTCSeconds() === 0
    && (end.getTime() - start.getTime()) % 86400000 === 0;
};

const sortRules = (rules: Snapshot['rules']) => [...rules].sort((a, b) => {
  const byDate = a.date.localeCompare(b.date);
  if (byDate !== 0) return byDate;
  if (!a.startTime && b.startTime) return -1;
  if (a.startTime && !b.startTime) return 1;
  return (a.startTime ?? '').localeCompare(b.startTime ?? '');
});

function autoGrowTextarea(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = `${Math.max(el.scrollHeight, 60)}px`;
}

export function AppShell({ groupId, phone, groupName: initialGroupName }: { groupId: string; phone: string; groupName?: string }) {
  const [message, setMessage] = useState('');
  const [groupName, setGroupName] = useState<string | undefined>(initialGroupName);
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
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [personDraft, setPersonDraft] = useState<{ name: string; phone: string }>({ name: '', phone: '' });
  const [personEditError, setPersonEditError] = useState<string | null>(null);
  const [pendingBlankPersonId, setPendingBlankPersonId] = useState<string | null>(null);
  const editingPersonRowRef = useRef<HTMLTableRowElement | null>(null);
  const personNameInputRef = useRef<HTMLInputElement | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<Snapshot['rules'][0] | null>(null);
  const [rulePromptModal, setRulePromptModal] = useState<{ person: Snapshot['people'][0] } | null>(null);
  const [rulePrompt, setRulePrompt] = useState('');
  const [ruleDraft, setRuleDraft] = useState<{ draftRules: Array<{ personId: string; status: 'available' | 'unavailable'; startUtc: string; endUtc: string }>; preview: string[]; warnings: DraftWarning[]; assumptions: string[]; promptId: string } | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [ruleDraftError, setRuleDraftError] = useState<string | null>(null);
  const [ruleDraftErrorMeta, setRuleDraftErrorMeta] = useState<{ code?: string; traceId?: string } | null>(null);
  const [ruleDraftTraceId, setRuleDraftTraceId] = useState<string | null>(null);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [legacyReplaceRuleCode, setLegacyReplaceRuleCode] = useState<string | null>(null);
  const didInitialLoad = useRef(false);
  const appointmentDescRef = useRef<HTMLTextAreaElement | null>(null);
  const rulePromptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hasProposedRules = Boolean(ruleDraft?.draftRules?.length);

  const closeRulePromptModal = () => {
    setRulePromptModal(null);
    setRulePrompt('');
    setRuleDraft(null);
    setRuleDraftError(null);
    setRuleDraftErrorMeta(null);
    setRuleDraftTraceId(null);
    setEditingPromptId(null);
    setLegacyReplaceRuleCode(null);
  };

  const toggleAppointmentPerson = (appointment: Snapshot['appointments'][0], personId: string) => {
    const selected = new Set(appointment.people);
    if (selected.has(personId)) selected.delete(personId); else selected.add(personId);
    setSelectedAppointment({
      ...appointment,
      people: [...selected],
      peopleDisplay: [...selected].map((id) => snapshot.people.find((p) => p.personId === id)?.name ?? id)
    });
  };

  const sendMessage = async (outgoingMessage: string, extraBody: Record<string, unknown> = {}) => {
    const trimmed = outgoingMessage.trim();
    if (!trimmed) return;
    setTranscript((p) => [...p, { role: 'user', text: trimmed }]);
    setIsSubmitting(true);
    try {
      const response = await fetch(apiUrl('/api/chat'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: trimmed, groupId, phone, ...extraBody }) });
      if (!response.ok) {
        setTranscript((p) => [...p, { role: 'assistant', text: 'error: unable to fetch reply' }]);
        return;
      }
      const json = (await response.json()) as ChatResponse;
      if (json.snapshot) setSnapshot(json.snapshot);
      const text = json.kind === 'question' ? json.message : (json.assistantText ?? '');
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
    const response = await fetch(apiUrl('/api/direct'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, groupId, phone }) });
    const json = await response.json() as { ok?: boolean; snapshot?: Snapshot; message?: string; personId?: string };
    if (json.snapshot) setSnapshot(json.snapshot);
    if (!response.ok || !json.ok) return { ok: false, message: json.message ?? 'Action failed' } as const;
    return { ok: true, snapshot: json.snapshot ?? null, personId: json.personId } as const;
  };

  const addAppointment = async () => {
    const previousCodes = new Set(snapshot.appointments.map((appointment) => appointment.code));
    const result = await sendDirectAction({ type: 'create_blank_appointment' });
    if (!result.ok) return;
    const created = result.snapshot?.appointments.find((appointment) => !previousCodes.has(appointment.code));
    if (created) setEditingApptCode(created.code);
  };


  const startEditingPerson = (person: Snapshot['people'][0]) => {
    setEditingPersonId(person.personId);
    setPersonDraft({ name: person.name, phone: person.cellDisplay || person.cellE164 || '' });
    setPersonEditError(null);
  };

  const cancelPersonEdit = async () => {
    const pendingId = pendingBlankPersonId;
    const editingId = editingPersonId;
    const draft = personDraft;
    setEditingPersonId(null);
    setPersonEditError(null);
    setPersonDraft({ name: '', phone: '' });
    if (pendingId && editingId === pendingId && !draft.name.trim() && !draft.phone.trim()) {
      await sendDirectAction({ type: 'delete_person', personId: pendingId });
    }
    setPendingBlankPersonId(null);
  };

  const submitPersonEdit = async () => {
    if (!editingPersonId) return;
    const result = await sendDirectAction({ type: 'update_person', personId: editingPersonId, name: personDraft.name, phone: personDraft.phone });
    if (!result.ok) {
      setPersonEditError(result.message);
      return;
    }
    setEditingPersonId(null);
    setPendingBlankPersonId(null);
    setPersonEditError(null);
  };

  const addPerson = async () => {
    const result = await sendDirectAction({ type: 'create_blank_person' });
    if (!result.ok || !result.personId) return;
    const created = result.snapshot?.people.find((person) => person.personId === result.personId);
    setEditingPersonId(result.personId);
    setPendingBlankPersonId(result.personId);
    setPersonDraft({ name: created?.name ?? '', phone: created?.cellDisplay ?? '' });
    setPersonEditError(null);
  };

  const onNewPersonRowKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>, isNewRowEditing: boolean) => {
    if (!isNewRowEditing) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      void submitPersonEdit();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      void cancelPersonEdit();
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!message.trim() || proposalText || pendingQuestion) return;
    const out = message;
    setMessage('');
    await sendMessage(out);
  };

  const sortedAppointments = useMemo(() => [...snapshot.appointments].sort((a, b) => {
    const aUnresolved = a.time?.intent?.status !== 'resolved';
    const bUnresolved = b.time?.intent?.status !== 'resolved';
    if (aUnresolved && !bUnresolved) return -1;
    if (!aUnresolved && bUnresolved) return 1;
    if (aUnresolved && bUnresolved) return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
    const byStart = (a.time?.resolved?.startUtc ?? '').localeCompare(b.time?.resolved?.startUtc ?? '');
    if (byStart !== 0) return byStart;
    const byEnd = (a.time?.resolved?.endUtc ?? '').localeCompare(b.time?.resolved?.endUtc ?? '');
    if (byEnd !== 0) return byEnd;
    return a.code.localeCompare(b.code);
  }), [snapshot.appointments]);
  const activePeople = snapshot.people.filter((person) => person.status === 'active');
  const peopleInView = snapshot.people.filter((person) => person.status === 'active');
  const headerTitle = view === 'appointments' ? 'Schedule' : 'People';
  const headerDescription = view === 'appointments'
    ? 'Add, edit, and track upcoming appointments for this group.'
    : 'Manage who can access this schedule.';

  const openRulePromptModal = (person: Snapshot['people'][0]) => {
    setRulePromptModal({ person });
    setRulePrompt('');
    setRuleDraft(null);
    setEditingPromptId(null);
    setLegacyReplaceRuleCode(null);
    setRuleDraftError(null);
    setRuleDraftErrorMeta(null);
    setRuleDraftTraceId(null);
  };

  const draftRulePrompt = async (inputText?: string, forcedTraceId?: string) => {
    if (!rulePromptModal) return;
    const outgoing = (inputText ?? rulePrompt).trim();
    if (!outgoing) return;
    setIsDrafting(true);
    setRuleDraft(null);
    setRuleDraftError(null);
    const traceId = forcedTraceId ?? ruleDraftTraceId ?? `rules-draft-${Date.now()}`;
    setRuleDraftTraceId(traceId);
    try {
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: outgoing, groupId, phone, ruleMode: 'draft', personId: rulePromptModal.person.personId, traceId, replacePromptId: editingPromptId ?? undefined, replaceRuleCode: legacyReplaceRuleCode ?? undefined })
      });
      const json = (await response.json()) as Record<string, unknown> & { snapshot?: Snapshot; kind?: string; message?: string };
      if (json.snapshot) setSnapshot(json.snapshot);
      if (!response.ok) {
        setRuleDraft(null);
        setRuleDraftError(json.message ?? 'Unable to draft rule.');
        setRuleDraftErrorMeta({ traceId });
        return;
      }
      setRuleDraftTraceId(null);
      const preview = Array.isArray(json.preview) ? json.preview.map((item) => String(item)) : null;
      const draftRules = Array.isArray(json.draftRules) ? (json.draftRules as Array<{ personId: string; status: 'available' | 'unavailable'; startUtc: string; endUtc: string }>) : null;
      const promptId = typeof json.promptId === 'string' ? json.promptId : null;
      const draftErrorPayload = (typeof json.draftError === 'object' && json.draftError) ? (json.draftError as { message?: unknown; code?: unknown; traceId?: unknown }) : null;
      const draftError = (draftErrorPayload && typeof draftErrorPayload.message === 'string') ? draftErrorPayload.message : null;
      const draftErrorCode = (draftErrorPayload && typeof draftErrorPayload.code === 'string') ? draftErrorPayload.code : undefined;
      const draftErrorTraceId = (draftErrorPayload && typeof draftErrorPayload.traceId === 'string') ? draftErrorPayload.traceId : undefined;
      if (json.kind === 'question') {
        setRuleDraft(null);
        setRuleDraftError('Draft needs clarification. Please edit the prompt and click Draft again.');
        setRuleDraftErrorMeta({ code: draftErrorCode, traceId: draftErrorTraceId ?? traceId });
        return;
      }
      if (draftError || !preview || !promptId || !draftRules || draftRules.length === 0) {
        setRuleDraft(null);
        setRuleDraftError(draftError ?? 'Draft failed. Please rephrase.');
        setRuleDraftErrorMeta({ code: draftErrorCode, traceId: draftErrorTraceId ?? traceId });
        return;
      }
      const warnings = Array.isArray(json.warnings) ? json.warnings as DraftWarning[] : [];
      const assumptions = Array.isArray(json.assumptions) ? json.assumptions.map((item) => String(item)) : [];
      setRuleDraftError(null);
      setRuleDraftErrorMeta(null);
      setRuleDraft({ draftRules, preview, warnings, assumptions, promptId });
    } finally {
      setIsDrafting(false);
    }
  };

  const confirmRulePrompt = async () => {
    const promptId = ruleDraft?.promptId;
    if (!rulePromptModal || !rulePrompt.trim() || !hasProposedRules || !promptId) return;
    setIsConfirming(true);
    const traceId = `rules-confirm-${Date.now()}`;
    try {
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: rulePrompt.trim(),
          groupId,
          phone,
          ruleMode: 'confirm',
          personId: rulePromptModal.person.personId,
          promptId,
          traceId,
          draftedIntervals: ruleDraft?.draftRules ?? []
        })
      });
      const json = (await response.json()) as { snapshot?: Snapshot; message?: string };
      if (!response.ok) {
        setRuleDraftError(json.message ?? 'Unable to confirm rule.');
        setRuleDraftErrorMeta(null);
        return;
      }
      if (json.snapshot) setSnapshot(json.snapshot);
      setRulePromptModal(null);
      setRulePrompt('');
      setRuleDraft(null);
      setRuleDraftError(null);
      setRuleDraftErrorMeta(null);
      setRuleDraftTraceId(null);
      setEditingPromptId(null);
      setLegacyReplaceRuleCode(null);
    } finally {
      setIsConfirming(false);
    }
  };


  useEffect(() => {
    if (didInitialLoad.current) return;
    didInitialLoad.current = true;
    authLog({ stage: 'initial_chat_triggered' });
    fetch(apiUrl('/api/chat'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'list appointments', groupId, phone }) })
      .then(async (response) => {
        if (!response.ok) return;
        const json = (await response.json()) as ChatResponse;
        if (json.snapshot) setSnapshot(json.snapshot);
      });
  }, [groupId, phone]);

  useEffect(() => {
    if (!editingApptCode) return;
    const exists = snapshot.appointments.some((appointment) => appointment.code === editingApptCode);
    if (!exists) setEditingApptCode(null);
  }, [editingApptCode, snapshot.appointments]);

  useEffect(() => {
    if (!editingPersonId) return;
    const exists = snapshot.people.some((person) => person.personId === editingPersonId && person.status === 'active');
    if (!exists) {
      setEditingPersonId(null);
      setPendingBlankPersonId(null);
      setPersonEditError(null);
    }
  }, [editingPersonId, snapshot.people]);

  useEffect(() => {
    if (!editingPersonId) return;
    personNameInputRef.current?.focus();
  }, [editingPersonId]);


  useEffect(() => {
    let canceled = false;

    const loadGroupMeta = async () => {
      try {
        const response = await fetch(apiUrl(`/api/group/meta?groupId=${encodeURIComponent(groupId)}`));
        if (!response.ok) return;
        const data = await response.json() as { ok?: boolean; groupName?: string };
        if (!canceled && data.ok) setGroupName(data.groupName || 'Family Schedule');
      } catch {
        // Ignore metadata load failures; header can still render with groupId.
      }
    };

    if (!initialGroupName) void loadGroupMeta();
    return () => {
      canceled = true;
    };
  }, [groupId, initialGroupName]);

  useEffect(() => {
    if (!editingApptCode || !appointmentDescRef.current) return;
    autoGrowTextarea(appointmentDescRef.current);
  }, [editingApptCode]);

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

  useEffect(() => {
    if (!editingPersonId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void cancelPersonEdit();
      }
    };
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const editingRow = editingPersonRowRef.current;
      const target = event.target;
      if (!editingRow || !(target instanceof Node)) return;
      if (!editingRow.contains(target)) void cancelPersonEdit();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [editingPersonId, cancelPersonEdit]);


  return (
    <Page variant="workspace">
      <PageHeader
        title={headerTitle}
        description={headerDescription}
        groupName={groupName}
        groupId={groupId}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => setView('appointments')}
          className={view === 'appointments' ? 'fs-btnPrimary' : 'fs-btnSecondary'}
        >
          Schedule
        </button>
        <button
          type="button"
          onClick={() => setView('people')}
          className={view === 'people' ? 'fs-btnPrimary' : 'fs-btnSecondary'}
        >
          People
        </button>
      </div>

      {import.meta.env.DEV && snapshot.people.length === 0 ? <p className="dev-warning">Loaded group with 0 people — create flow may be broken.</p> : null}

      {view === 'appointments' ? (
        <section className="panel">
          {sortedAppointments.length === 0 ? (
            <div className="fs-alert" style={{ maxWidth: 760 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>No appointments yet</div>
              <div style={{ color: 'var(--muted)' }}>
                Use the add row at the bottom of the table to create the first entry.
              </div>
            </div>
          ) : null}
          <div className="table-wrap fs-tableScroll">
            <table className="data-table">
              <thead>
                <tr><th>Code</th><th>Date</th><th>Time</th><th>Duration</th><th>Description</th><th>People</th><th>Location</th><th>Notes</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {sortedAppointments.map((appointment) => {
                  const isEditing = editingApptCode === appointment.code;
                  return (
                    <tr key={appointment.code} ref={isEditing ? editingAppointmentRowRef : undefined}>
                        <td><code>{appointment.code}</code>{appointment.time?.intent?.status !== 'resolved' ? <span className='status-tag unknown' style={{ marginLeft: 8 }}>Unresolved</span> : null}</td>
                        <td>
                          {isEditing ? (
                            <input type="date" defaultValue={appointment.date || ''} onBlur={(event) => { const value = event.currentTarget.value; if (value && value !== appointment.date) void sendDirectAction({ type: 'set_appointment_date', code: appointment.code, date: value }); }} />
                          ) : (
                            <span>{appointment.time?.resolved?.startUtc?.slice(0,10) || appointment.date || '—'}</span>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <div className="time-cell"><input type="time" defaultValue={appointment.startTime ?? ''} onBlur={(event) => { const value = event.currentTarget.value; if (value !== (appointment.startTime ?? '')) void sendDirectAction({ type: 'set_appointment_start_time', code: appointment.code, startTime: value || undefined }); }} /><button type="button" className="compact-button" onClick={() => void sendDirectAction({ type: 'set_appointment_start_time', code: appointment.code })}>Clear</button></div>
                          ) : (
                            <span>{formatAppointmentTime(appointment)}</span>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input type="number" min={1} max={1440} defaultValue={appointment.durationMins ?? ''} onBlur={(event) => { const value = event.currentTarget.value; const normalized = value ? Number(value) : undefined; if (normalized !== appointment.durationMins) void sendDirectAction({ type: 'set_appointment_duration', code: appointment.code, durationMins: normalized }); }} />
                          ) : (
                            <span>{appointment.time?.intent?.status !== 'resolved' ? '—' : (appointment.durationMins ? `${appointment.durationMins}m` : '—')}</span>
                          )}
                        </td>
                        <td className="multiline-cell">
                          {isEditing ? (
                            <textarea ref={isEditing ? appointmentDescRef : undefined} rows={2} autoFocus={editingApptCode === appointment.code && !appointment.desc} defaultValue={appointment.desc} onInput={(event) => autoGrowTextarea(event.currentTarget)} onBlur={(event) => { if (event.currentTarget.value !== appointment.desc) void sendDirectAction({ type: 'set_appointment_desc', code: appointment.code, desc: event.currentTarget.value }); }} />
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
                            <textarea rows={3} defaultValue={appointment.notes} title={appointment.notes} onInput={(event) => autoGrowTextarea(event.currentTarget)} onBlur={(event) => { if (event.currentTarget.value !== appointment.notes) void sendDirectAction({ type: 'set_appointment_notes', code: appointment.code, notes: event.currentTarget.value }); }} />
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
                <tr className="fs-tableCtaRow">
                  <td colSpan={9}>
                    <button type="button" className="fs-tableCtaBtn" onClick={() => void addAppointment()} aria-label="Add appointment">
                      {sortedAppointments.length > 0 ? '+ Add another appointment' : '+ Add an appointment'}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {view === 'people' ? (
        <section className="panel"> 
          {peopleInView.length === 0 ? (
            <div className="fs-alert" style={{ maxWidth: 760 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>No people added yet</div>
              <div style={{ color: 'var(--muted)' }}>
                Add at least one person to allow them to access this group.
              </div>
            </div>
          ) : null}
          <div className="table-wrap fs-tableScroll">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Phone</th><th>Last seen</th><th>Actions</th></tr></thead>
              <tbody>
                {peopleInView.map((person) => {
                  const personRules = sortRules(snapshot.rules.filter((rule) => rule.personId === person.personId));
                  const isEditingPerson = editingPersonId === person.personId;
                  const isNewRowEditing = isEditingPerson && pendingBlankPersonId === person.personId;
                  return (
                    <Fragment key={person.personId}>
                      <tr key={person.personId} ref={isEditingPerson ? editingPersonRowRef : undefined}>
                          <td>
                            {isEditingPerson ? <input ref={personNameInputRef} value={personDraft.name} onChange={(event) => setPersonDraft((prev) => ({ ...prev, name: event.target.value }))} onKeyDown={(event) => onNewPersonRowKeyDown(event, isNewRowEditing)} /> : <span className="line-clamp" title={person.name}>{person.name || '—'}</span>}
                          </td>
                          <td>
                            {isEditingPerson ? <input value={personDraft.phone} onChange={(event) => setPersonDraft((prev) => ({ ...prev, phone: event.target.value }))} onKeyDown={(event) => onNewPersonRowKeyDown(event, isNewRowEditing)} placeholder="(425) 555-1234" /> : <span style={{ fontFamily: 'var(--font-mono)' }}>{person.cellDisplay || '—'}</span>}
                            {isEditingPerson && personEditError ? <p className="form-error">{personEditError}</p> : null}
                          </td>
                          <td><span title={person.lastSeen ?? ''}>{formatLastSeen(person.lastSeen)}</span></td>
                          <td className="actions-cell">
                            {isNewRowEditing ? (
                              <div className="action-buttons">
                                <button type="button" className="fs-btnPrimary" onClick={() => void submitPersonEdit()}>Accept</button>
                                <button type="button" className="fs-btnSecondary" onClick={() => void cancelPersonEdit()}>Cancel</button>
                              </div>
                            ) : (
                              <div className="action-icons"> 
                                <button type="button" className="icon-button" aria-label="Rules" data-tooltip="Rules" onClick={() => openRulePromptModal(person)}><Clock3 /></button>
                                <button type="button" className="icon-button" aria-label="Edit person" data-tooltip="Edit person" onClick={() => { if (isEditingPerson) void submitPersonEdit(); else startEditingPerson(person); }}><Pencil /></button>
                                <button type="button" className="icon-button" aria-label="Delete person" data-tooltip="Delete person" onClick={() => setPersonToDelete(person)}><Trash2 /></button>
                              </div>
                            )}
                          </td>
                        </tr>
                      {personRules.length > 0 ? (
                        <tr key={`${person.personId}-rules`} className="rules-row">
                            <td colSpan={4} className="rules-cell">
                              <div className="rules-indent">
                                <ul className="rules-list">
                                  {personRules.map((rule) => (
                                    <li key={rule.code} className="rule-item">
                                      <div className="rule-row" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 760, width: '100%' }}>
                                          <span className="rule-range" style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                                            {formatRuleRangeForList(rule, person.timezone)}
                                          </span>
                                          <span className="rule-desc" style={{ fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rule.desc ?? ''}>
                                            {rule.desc || '—'}
                                          </span>
                                          <span className={`status-tag ${rule.kind}`} style={{ whiteSpace: 'nowrap' }}>
                                            {rule.kind === 'available' ? 'Available' : 'Unavailable'}
                                          </span>
                                          <span className="rule-actions">
                                        <button
                                          type="button"
                                          className="icon-button"
                                          aria-label="Edit rule"
                                          data-tooltip="Edit rule"
                                          onClick={() => {
                                            setRulePromptModal({ person });
                                            setRulePrompt(rule.originalPrompt ?? '');
                                            setRuleDraft(null);
                                            if (rule.promptId && rule.originalPrompt) {
                                              setEditingPromptId(rule.promptId);
                                              setLegacyReplaceRuleCode(null);
                                            } else {
                                              setEditingPromptId(null);
                                              setLegacyReplaceRuleCode(rule.code);
                                            }
                                          }}
                                        >
                                          <Pencil />
                                        </button>
                                        <button type="button" className="icon-button" aria-label="Delete rule" data-tooltip="Delete rule" onClick={() => setRuleToDelete(rule)}><Trash2 /></button>
                                          </span>
                                        </div>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
                <tr className="fs-tableCtaRow">
                  <td colSpan={4}>
                    <button type="button" className="fs-tableCtaBtn" onClick={() => void addPerson()} aria-label="Add person">
                      {peopleInView.length > 0 ? '+ Add another person' : '+ Add a person'}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {view === 'appointments' ? (
        <form onSubmit={onSubmit}>
          <label htmlFor="prompt">What would you like to do?</label>
          <div className="input-row">
            <input id="prompt" value={message} onChange={(event) => setMessage(event.target.value)} autoComplete="off" disabled={Boolean(proposalText) || Boolean(pendingQuestion)} />
            <button type="submit" disabled={isSubmitting || Boolean(proposalText) || Boolean(pendingQuestion)}>Send</button>
          </div>
          <div style={{ marginTop: 8, color: 'var(--muted)', fontSize: 12, lineHeight: 1.25, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ margin: 0 }}>
              Add, edit, delete, rename, or assign appointments. You can also paste email text or a CSV with appointment details.
            </div>
            <div style={{ margin: 0 }}>
              Example: “Pre-op visit March 19 at 9:45 AM, Evergreen Health” or paste a confirmation email.
            </div>
          </div>
        </form>
      ) : null}

      {proposalText ? <div className="modal-backdrop"><div className="modal"><h3>Confirm this change?</h3><p>{proposalText}</p><div className="modal-actions"><button type="button" onClick={() => void sendMessage('confirm')}>Confirm</button><button type="button" onClick={() => void sendMessage('cancel')}>Cancel</button></div></div></div> : null}

      {pendingQuestion ? <QuestionDialog question={pendingQuestion} value={questionInput} onValueChange={setQuestionInput} onOptionSelect={(reply) => { setPendingQuestion(null); setQuestionInput(''); void sendMessage(reply); }} onSubmitText={() => { const out = questionInput.trim(); if (!out) return; setPendingQuestion(null); setQuestionInput(''); void sendMessage(out); }} onClose={() => { setPendingQuestion(null); setQuestionInput(''); }} /> : null}


      {appointmentToDelete ? <div className="modal-backdrop"><div className="modal"><h3>Delete {appointmentToDelete.code} ({appointmentToDelete.desc || 'Untitled'})?</h3><div className="modal-actions"><button type="button" onClick={() => { void sendDirectAction({ type: 'delete_appointment', code: appointmentToDelete.code }); setAppointmentToDelete(null); }}>Confirm</button><button type="button" onClick={() => setAppointmentToDelete(null)}>Cancel</button></div></div></div> : null}

      {personToDelete ? <div className="modal-backdrop"><div className="modal"><h3>Delete {personToDelete.name || personToDelete.personId}?</h3><p>This will remove this person from the active allowlist. Existing history and appointments are preserved.</p><div className="modal-actions"><button type="button" onClick={() => { void sendDirectAction({ type: 'delete_person', personId: personToDelete.personId }); setPersonToDelete(null); if (editingPersonId === personToDelete.personId) { setEditingPersonId(null); setPendingBlankPersonId(null); setPersonEditError(null); } }}>Confirm</button><button type="button" onClick={() => setPersonToDelete(null)}>Cancel</button></div></div></div> : null}

      {ruleToDelete ? <div className="modal-backdrop"><div className="modal"><h3>Delete rule {ruleToDelete.code}?</h3><p>This removes the rule from this person.</p><div className="modal-actions"><button type="button" onClick={() => { void sendMessage(`Delete rule ${ruleToDelete.code}`); setRuleToDelete(null); }}>Confirm</button><button type="button" onClick={() => setRuleToDelete(null)}>Cancel</button></div></div></div> : null}

      {rulePromptModal ? (
        <div className="modal-backdrop">
          <div className="modal rules-modal">
            <div className="rules-modal-section rules-modal-header">
              <h3>Rules</h3>
            </div>
            <div className="rules-modal-section rules-prompt-section">
              <div className="rules-composer">
                <label htmlFor="rule-prompt-input">Availability rule</label>
                <textarea
                  ref={rulePromptTextareaRef}
                  id="rule-prompt-input"
                  rows={4}
                  value={rulePrompt}
                  onChange={(event) => setRulePrompt(event.target.value)}
                  placeholder={'Examples:\nWeekdays after 6pm I am available.\nI’m unavailable next Tuesday from 1-3pm.'}
                />
                <div className="rules-composer-actions">
                  <button type="button" onClick={() => void draftRulePrompt()} disabled={!rulePrompt.trim() || isDrafting || isConfirming}>{isDrafting ? 'Drafting…' : 'Draft Rule'}</button>
                </div>
              </div>
            </div>

            {ruleDraftError ? (
              <div className="rules-modal-section">
                <p>{ruleDraftError}</p>
                {ruleDraftErrorMeta?.code || ruleDraftErrorMeta?.traceId ? <p><small>{ruleDraftErrorMeta?.code ? `code=${ruleDraftErrorMeta.code} ` : ''}{ruleDraftErrorMeta?.traceId ? `traceId=${ruleDraftErrorMeta.traceId}` : ''}</small></p> : null}
              </div>
            ) : null}

            <div className="rules-modal-section rule-draft-output">
              <p>Preview</p>
              {hasProposedRules ? (
                <ul className="rule-preview-list">
                  {ruleDraft?.draftRules.map((rule, i) => (
                    <li key={`${rule.status}-${rule.startUtc}-${rule.endUtc}-${i}`} className="rule-preview-item">
                      <span className={`status-tag ${rule.status}`}>{rule.status === 'unavailable' ? 'UNAVAILABLE' : 'AVAILABLE'}</span>
                      <code>{formatDraftRuleRange(rule.startUtc, rule.endUtc)}</code>
                      {isAllDayDraftRule(rule.startUtc, rule.endUtc) ? <span className="rule-preview-all-day">All day</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted-empty">No proposed changes yet. Click Draft to preview.</p>
              )}
              {ruleDraft ? (
                <>
                {ruleDraft.assumptions.length > 0 ? (
                  <>
                    <p>Assumptions</p>
                    <ul>{ruleDraft.assumptions.map((assumption, i) => <li key={`${assumption}-${i}`}>{assumption}</li>)}</ul>
                  </>
                ) : null}
                {ruleDraft.warnings.length > 0 ? (
                  <>
                    <p>Warnings</p>
                    <ul>{ruleDraft.warnings.map((warning, i) => <li key={`${warning.code}-${i}`}>{warning.message}</li>)}</ul>
                  </>
                ) : null}
                </>
              ) : null}
            </div>

            <div className="modal-actions rules-actions-row">
              <button type="button" onClick={() => void confirmRulePrompt()} disabled={!hasProposedRules || isConfirming} aria-disabled={!hasProposedRules || isConfirming}>{isConfirming ? 'Confirming…' : 'Add Rule'}</button>
              <button type="button" onClick={closeRulePromptModal}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedAppointment ? <div className="modal-backdrop"><div className="modal"><h3>Assign people for {selectedAppointment.code}</h3><div className="picker-list">{activePeople.map((person, index) => {
        const status = computePersonStatusForInterval(person.personId, selectedAppointment, snapshot.rules);
        const isSelected = selectedAppointment.people.includes(person.personId);
        return <div key={person.personId} className={`picker-row ${index < activePeople.length - 1 ? 'picker-row-divider' : ''}`} onClick={() => toggleAppointmentPerson(selectedAppointment, person.personId)}>
          <div className="picker-left"><input type="checkbox" checked={isSelected} onChange={() => toggleAppointmentPerson(selectedAppointment, person.personId)} onClick={(event) => event.stopPropagation()} /><span className="picker-name">{person.name}</span></div>
          <div className="picker-status-wrap"><span className={`status-tag ${status.status === 'no_conflict' ? 'available' : status.status === 'conflict' ? 'unavailable' : 'unknown'}`}>{status.status === 'no_conflict' ? 'No Conflict' : status.status === 'conflict' ? 'Conflict' : 'Unreconcilable'}</span></div>
        </div>;
      })}</div><div className="modal-actions"><button type="button" onClick={() => { void sendMessage(`Replace people on appointment code=${selectedAppointment.code} people=${selectedAppointment.people.join(',')}`); setSelectedAppointment(null); }}>Apply</button><button type="button" onClick={() => setSelectedAppointment(null)}>Close</button></div></div></div> : null}
      <FooterHelp />
      <div className="build-version">Build: {buildInfo.sha.slice(0, 7)} {buildInfo.time}</div>
    </Page>
  );
}
