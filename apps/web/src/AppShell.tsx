import { FormEvent, Fragment, KeyboardEvent as ReactKeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { AppointmentEditorForm } from './components/AppointmentEditorForm';
import { AppointmentCardList } from './components/AppointmentCardList';
import { Drawer } from './components/Drawer';
import { FooterHelp } from './components/layout/FooterHelp';
import { Page } from './components/layout/Page';
import { PageHeader } from './components/layout/PageHeader';
import { apiUrl } from './lib/apiUrl';
import { buildInfo } from './lib/buildInfo';
import { useMediaQuery } from './hooks/useMediaQuery';
import type { TimeSpec } from '../../../packages/shared/src/types.js';

type TranscriptEntry = { role: 'assistant' | 'user'; text: string };
type Snapshot = {
  appointments: Array<{ id: string; code: string; desc: string; schemaVersion?: number; updatedAt?: string; time: TimeSpec; date: string; startTime?: string; durationMins?: number; isAllDay: boolean; people: string[]; peopleDisplay: string[]; location: string; locationRaw: string; locationDisplay: string; locationMapQuery: string; locationName: string; locationAddress: string; locationDirections: string; notes: string; scanStatus: 'pending' | 'parsed' | 'failed' | 'deleted' | null; scanImageKey: string | null; scanImageMime: string | null; scanCapturedAt: string | null }>;
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
type UsagePayload = { usageState: 'unknown' | 'ok' | 'warning' | 'limit_reached'; usageSummary?: string; updatedAt: string };
type UsageStatus = { status: 'loading' | 'ok' | 'error'; data?: UsagePayload };
type ShellSection = 'overview' | 'calendar' | 'todos' | 'members' | 'settings';
type CalendarView = 'month' | 'list' | 'week' | 'day';
type TodoItem = { id: string; text: string; dueDate?: string; assignee?: string; done: boolean };

const calendarWeekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
const Clock3 = () => <Icon><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>;
const Plus = () => <Icon><path d="M12 5v14" /><path d="M5 12h14" /></Icon>;
const Camera = () => <Icon><path d="M4 7h3l2-2h6l2 2h3v12H4z" /><circle cx="12" cy="13" r="3.5" /></Icon>;
const ChevronLeft = () => <Icon><path d="m15 18-6-6 6-6" /></Icon>;
const ChevronRight = () => <Icon><path d="m9 18 6-6-6-6" /></Icon>;

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
  const { startUtc, endUtc, timezone } = appointment.time.resolved;
  const start = new Date(startUtc);
  const end = new Date(endUtc);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Unresolved';
  const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: timezone });
  const dateTimeFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone });
  const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone });
  const isAllDay = start.getUTCHours() === 0
    && start.getUTCMinutes() === 0
    && end.getUTCHours() === 0
    && end.getUTCMinutes() === 0
    && (end.getTime() - start.getTime()) % 86400000 === 0;
  if (isAllDay) {
    const inclusiveEnd = new Date(end.getTime() - 60_000);
    const sameDay = dateFormatter.format(start) === dateFormatter.format(inclusiveEnd);
    if (sameDay) return `${dateFormatter.format(start)} · All day`;
    return `${dateFormatter.format(start)}–${dateFormatter.format(inclusiveEnd)} · All day`;
  }
  const sameDay = dateFormatter.format(start) === dateFormatter.format(end);
  if (sameDay) return `${dateFormatter.format(start)} · ${timeFormatter.format(start)}–${timeFormatter.format(end)}`;
  return `${dateTimeFormatter.format(start)} – ${dateTimeFormatter.format(end)}`;
};

const formatMissingSummary = (missing?: string[]) => {
  if (!missing?.length) return null;
  return `Missing: ${missing.join(', ')}`;
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

export function AppShell({ groupId, phone, groupName: initialGroupName }: { groupId: string; phone: string; groupName?: string }) {
  const [message, setMessage] = useState('');
  const [groupName, setGroupName] = useState<string | undefined>(initialGroupName);
  const [usage, setUsage] = useState<UsageStatus>({ status: 'loading' });
  const [activeSection, setActiveSection] = useState<ShellSection>('calendar');
  const [calendarView, setCalendarView] = useState<CalendarView>('list');
  const [monthCursor, setMonthCursor] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [todoDraft, setTodoDraft] = useState<{ text: string; dueDate: string; assignee: string; done: boolean }>({ text: '', dueDate: '', assignee: '', done: false });
  const [, setTranscript] = useState<TranscriptEntry[]>([{ role: 'assistant', text: "Type 'help' for examples." }]);
  const [snapshot, setSnapshot] = useState<Snapshot>(initialSnapshot);
  const [proposalText, setProposalText] = useState<string | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null);
  const [questionInput, setQuestionInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [whenEditorCode, setWhenEditorCode] = useState<string | null>(null);
  const [whenDraftText, setWhenDraftText] = useState('');
  const [descDraftText, setDescDraftText] = useState('');
  const [locationDraftText, setLocationDraftText] = useState('');
  const [notesDraftText, setNotesDraftText] = useState('');
  const [whenDraftResult, setWhenDraftResult] = useState<TimeSpec | null>(null);
  const [whenDraftError, setWhenDraftError] = useState<string | null>(null);
  const [whenPreviewed, setWhenPreviewed] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Snapshot['appointments'][0] | null>(null);
  const [appointmentToDelete, setAppointmentToDelete] = useState<Snapshot['appointments'][0] | null>(null);
  const [personToDelete, setPersonToDelete] = useState<Snapshot['people'][0] | null>(null);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [personDraft, setPersonDraft] = useState<{ name: string; phone: string }>({ name: '', phone: '' });
  const [personEditError, setPersonEditError] = useState<string | null>(null);
  const [pendingBlankPersonId, setPendingBlankPersonId] = useState<string | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');
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
  const rulePromptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hasProposedRules = Boolean(ruleDraft?.draftRules?.length);
  const fileScanInputRef = useRef<HTMLInputElement | null>(null);
  const scanCaptureVideoRef = useRef<HTMLVideoElement | null>(null);
  const scanCaptureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanCaptureStreamRef = useRef<MediaStream | null>(null);
  const [scanTargetAppointmentId, setScanTargetAppointmentId] = useState<string | null>(null);
  const [scanViewerAppointment, setScanViewerAppointment] = useState<Snapshot['appointments'][0] | null>(null);
  const [scanCaptureModal, setScanCaptureModal] = useState<{ appointmentId: string | null; useCameraPreview: boolean }>({ appointmentId: null, useCameraPreview: false });

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
    if (created) openWhenEditor(created);
  };

  const openTodoEditor = (todo: TodoItem) => {
    setEditingTodoId(todo.id);
    setTodoDraft({ text: todo.text, dueDate: todo.dueDate ?? '', assignee: todo.assignee ?? '', done: todo.done });
  };

  const closeTodoEditor = () => {
    setEditingTodoId(null);
    setTodoDraft({ text: '', dueDate: '', assignee: '', done: false });
  };

  const createTodo = () => {
    const next: TodoItem = { id: `todo-${Date.now()}`, text: 'New todo', done: false };
    setTodos((prev) => [next, ...prev]);
    openTodoEditor(next);
  };


  const saveTodo = () => {
    if (!editingTodoId || !todoDraft.text.trim()) return;
    setTodos((prev) => prev.map((todo) => todo.id === editingTodoId
      ? { ...todo, text: todoDraft.text.trim(), dueDate: todoDraft.dueDate || undefined, assignee: todoDraft.assignee.trim() || undefined, done: todoDraft.done }
      : todo));
    closeTodoEditor();
  };

  const toggleTodo = (todoId: string) => {
    setTodos((prev) => prev.map((todo) => todo.id === todoId ? { ...todo, done: !todo.done } : todo));
  };

  const deleteTodo = (todoId: string) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== todoId));
    if (editingTodoId === todoId) closeTodoEditor();
  };


  const openWhenEditor = (appointment: Snapshot['appointments'][0]) => {
    setWhenEditorCode(appointment.code);
    setWhenDraftText(appointment.time?.intent?.originalText ?? '');
    setDescDraftText(appointment.desc ?? '');
    setLocationDraftText(appointment.locationRaw ?? appointment.location ?? '');
    setNotesDraftText(appointment.notes ?? '');
    setWhenDraftResult(null);
    setWhenDraftError(null);
    setWhenPreviewed(false);
  };

  const closeWhenEditor = () => {
    setWhenEditorCode(null);
    setWhenDraftText('');
    setDescDraftText('');
    setLocationDraftText('');
    setNotesDraftText('');
    setWhenDraftResult(null);
    setWhenDraftError(null);
    setWhenPreviewed(false);
  };

  const previewWhenDraft = async (appointment: Snapshot['appointments'][0]) => {
    const whenText = whenDraftText.trim();
    if (!whenText) {
      setWhenDraftResult(null);
      setWhenPreviewed(false);
      setWhenDraftError('Enter a date/time to resolve.');
      return;
    }
    const timezone = appointment.time?.resolved?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
    try {
      const response = await fetch(apiUrl('/api/direct'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          groupId,
          phone,
          action: {
            type: 'resolve_appointment_time',
            appointmentId: appointment.code,
            whenText,
            timezone
          }
        })
      });
      const json = await response.json() as { ok?: boolean; time?: TimeSpec; message?: string };
      if (!response.ok || !json.ok || !json.time) {
        setWhenDraftResult(null);
        setWhenDraftError(json.message ?? 'Unable to resolve date.');
        setWhenPreviewed(false);
        return;
      }
      setWhenDraftResult(json.time);
      setWhenDraftError(null);
      setWhenPreviewed(true);
    } catch (_error) {
      setWhenDraftResult(null);
      setWhenDraftError('Unable to resolve date.');
      setWhenPreviewed(false);
    }
  };

  const confirmWhenDraft = async (appointment: Snapshot['appointments'][0]) => {
    if (descDraftText !== (appointment.desc ?? '')) {
      const descResult = await sendDirectAction({ type: 'set_appointment_desc', code: appointment.code, desc: descDraftText });
      if (!descResult.ok) {
        setWhenDraftError(descResult.message);
        return;
      }
    }
    if (locationDraftText !== (appointment.locationRaw ?? appointment.location ?? '')) {
      const locationResult = await sendDirectAction({ type: 'set_appointment_location', code: appointment.code, locationRaw: locationDraftText });
      if (!locationResult.ok) {
        setWhenDraftError(locationResult.message);
        return;
      }
    }
    if (notesDraftText !== (appointment.notes ?? '')) {
      const notesResult = await sendDirectAction({ type: 'set_appointment_notes', code: appointment.code, notes: notesDraftText });
      if (!notesResult.ok) {
        setWhenDraftError(notesResult.message);
        return;
      }
    }
    let resolvedDraft = whenDraftResult;
    if (!resolvedDraft || resolvedDraft.intent.originalText !== whenDraftText.trim()) {
      const whenText = whenDraftText.trim();
      if (!whenText) {
        setWhenDraftError('Enter a date/time to resolve.');
        return;
      }
      const timezone = appointment.time?.resolved?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
      const response = await fetch(apiUrl('/api/direct'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          groupId,
          phone,
          action: {
            type: 'resolve_appointment_time',
            appointmentId: appointment.code,
            whenText,
            timezone
          }
        })
      });
      const json = await response.json() as { ok?: boolean; time?: TimeSpec; message?: string };
      if (!response.ok || !json.ok || !json.time) {
        setWhenDraftError(json.message ?? 'Unable to resolve date.');
        return;
      }
      resolvedDraft = json.time;
      setWhenDraftResult(json.time);
      setWhenPreviewed(true);
    }
    if (resolvedDraft.intent.status !== 'resolved' || !resolvedDraft.resolved) {
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: `Reschedule appointment ${appointment.code} to ${whenDraftText.trim()}`, groupId, phone })
      });
      const json = await response.json() as ChatResponse;
      if (json.snapshot) setSnapshot(json.snapshot);
      if (!response.ok) {
        setWhenDraftError('Unable to confirm unresolved time.');
        return;
      }
      closeWhenEditor();
      return;
    }
    const start = new Date(resolvedDraft.resolved.startUtc);
    const end = new Date(resolvedDraft.resolved.endUtc);
    const allDay = start.getUTCHours() === 0 && start.getUTCMinutes() === 0 && end.getUTCHours() === 0 && end.getUTCMinutes() === 0 && (end.getTime() - start.getTime()) % 86400000 === 0;
    const payload = allDay
      ? { type: 'reschedule_appointment', code: appointment.code, date: resolvedDraft.resolved.startUtc.slice(0, 10), timezone: resolvedDraft.resolved.timezone }
      : {
          type: 'reschedule_appointment',
          code: appointment.code,
          date: resolvedDraft.resolved.startUtc.slice(0, 10),
          startTime: resolvedDraft.resolved.startUtc.slice(11, 16),
          durationMins: Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000)),
          timezone: resolvedDraft.resolved.timezone,
          timeResolved: resolvedDraft.resolved,
          durationAcceptance: 'auto'
        };
    const result = await sendDirectAction(payload as Record<string, unknown>);
    if (!result.ok) {
      setWhenDraftError(result.message);
      return;
    }
    closeWhenEditor();
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


  const refreshSnapshot = async () => {
    const response = await fetch(apiUrl('/api/chat'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'list appointments', groupId, phone }) });
    if (!response.ok) return;
    const json = await response.json() as ChatResponse;
    if (json.snapshot) setSnapshot(json.snapshot);
  };

  const stopScanCaptureStream = () => {
    if (!scanCaptureStreamRef.current) return;
    scanCaptureStreamRef.current.getTracks().forEach((track) => track.stop());
    scanCaptureStreamRef.current = null;
  };

  const openScanCapture = async (appointmentId: string | null) => {
    setScanTargetAppointmentId(appointmentId);
    if (!navigator.mediaDevices?.getUserMedia) {
      fileScanInputRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      scanCaptureStreamRef.current = stream;
      setScanCaptureModal({ appointmentId, useCameraPreview: true });
    } catch {
      fileScanInputRef.current?.click();
    }
  };

  const closeScanCaptureModal = () => {
    stopScanCaptureStream();
    setScanCaptureModal({ appointmentId: null, useCameraPreview: false });
  };

  const submitScanFile = async (file: File, appointmentId?: string) => {
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const endpoint = appointmentId ? '/api/appointmentScanRescan' : '/api/scanAppointment';
    const payload: Record<string, unknown> = { groupId, phone, imageBase64: base64, imageMime: file.type || 'image/jpeg', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
    if (appointmentId) payload.appointmentId = appointmentId;
    const response = await fetch(apiUrl(endpoint), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const json = await response.json() as { snapshot?: Snapshot };
    if (json.snapshot) setSnapshot(json.snapshot); else await refreshSnapshot();
  };

  const captureScanFrame = async () => {
    const video = scanCaptureVideoRef.current;
    const canvas = scanCaptureCanvasRef.current;
    if (!video || !canvas) return;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) return;
    const file = new File([blob], 'scan.jpg', { type: blob.type || 'image/jpeg' });
    const target = scanTargetAppointmentId;
    closeScanCaptureModal();
    setScanTargetAppointmentId(null);
    await submitScanFile(file, target ?? undefined);
  };

  const onPickScanFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const target = scanTargetAppointmentId;
    setScanTargetAppointmentId(null);
    event.currentTarget.value = '';
    await submitScanFile(file, target ?? undefined);
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
  const editingAppointment = whenEditorCode
    ? sortedAppointments.find((appointment) => appointment.code === whenEditorCode) ?? null
    : null;
  const activePeople = snapshot.people.filter((person) => person.status === 'active');
  const peopleInView = snapshot.people.filter((person) => person.status === 'active');
  const headerTitle = activeSection === 'members' ? 'Members' : activeSection === 'todos' ? 'Todos' : activeSection === 'overview' ? 'Overview' : activeSection === 'settings' ? 'Settings' : 'Calendar';
  const headerDescription = activeSection === 'members'
    ? 'Manage who can access this schedule.'
    : activeSection === 'todos'
      ? 'Track personal and family todos.'
      : activeSection === 'overview'
        ? 'Overview is coming soon.'
        : activeSection === 'settings'
          ? 'Settings is coming soon.'
          : 'Add, edit, and track upcoming appointments for this group.';
  const monthAnchor = monthCursor;
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(monthAnchor);
  const monthStartWeekday = monthAnchor.getDay();
  const monthGridStart = new Date(monthAnchor);
  monthGridStart.setDate(monthAnchor.getDate() - monthStartWeekday);
  const monthDays = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(monthGridStart);
    day.setDate(monthGridStart.getDate() + index);
    return day;
  });
  const appointmentsByDate = sortedAppointments.reduce<Record<string, Snapshot['appointments']>>((acc, appointment) => {
    const dateKey = appointment.time?.resolved?.startUtc ? appointment.time.resolved.startUtc.slice(0, 10) : appointment.date;
    if (!dateKey) return acc;
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(appointment);
    return acc;
  }, {});
  const todosByDate = todos.reduce<Record<string, TodoItem[]>>((acc, todo) => {
    if (!todo.dueDate) return acc;
    if (!acc[todo.dueDate]) acc[todo.dueDate] = [];
    acc[todo.dueDate].push(todo);
    return acc;
  }, {});
  const editingTodo = editingTodoId ? todos.find((todo) => todo.id === editingTodoId) ?? null : null;
  const formatMonthAppointmentTime = (appointment: Snapshot['appointments'][0]) => {
    if (appointment.time?.intent?.status !== 'resolved' || !appointment.time.resolved) return 'Unresolved';
    const { startUtc, endUtc, timezone } = appointment.time.resolved;
    const start = new Date(startUtc);
    const end = new Date(endUtc);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Unresolved';
    const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone });
    return `${timeFormatter.format(start)}–${timeFormatter.format(end)}`;
  };

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
    if (!whenEditorCode) return;
    const exists = snapshot.appointments.some((appointment) => appointment.code === whenEditorCode);
    if (!exists) closeWhenEditor();
  }, [whenEditorCode, snapshot.appointments]);

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

  useEffect(() => {
    let canceled = false;

    const loadUsage = async () => {
      try {
        const response = await fetch(apiUrl('/api/usage'));
        if (!response.ok) throw new Error('usage fetch failed');
        const data = await response.json() as UsagePayload;
        if (!canceled) setUsage({ status: 'ok', data });
      } catch {
        if (!canceled) setUsage({ status: 'error' });
      }
    };

    void loadUsage();
    return () => {
      canceled = true;
    };
  }, []);

  const usageLabel = usage.status === 'loading'
    ? 'Usage: loading…'
    : usage.status === 'error'
      ? 'Usage: unavailable'
      : `Usage: ${usage.data?.usageState ?? 'unknown'}${usage.data?.usageSummary ? ` (${usage.data.usageSummary})` : ''}`;

  useEffect(() => {
    if (!sortedAppointments.some((appointment) => appointment.scanStatus === 'pending')) return;
    const interval = setInterval(() => { void refreshSnapshot(); }, 7000);
    const timeout = setTimeout(() => clearInterval(interval), 120000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [sortedAppointments]);



  useEffect(() => {
    if (!scanCaptureModal.useCameraPreview) return;
    const video = scanCaptureVideoRef.current;
    const stream = scanCaptureStreamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
  }, [scanCaptureModal.useCameraPreview]);

  useEffect(() => () => {
    stopScanCaptureStream();
  }, []);

  return (
    <Page variant="workspace">
      <PageHeader
        title={headerTitle}
        description={headerDescription}
        groupName={groupName}
        groupId={groupId}
      />
      <div className="fs-shell">
        <aside className="fs-sidebar">
          <button type="button" className={`fs-btn ${activeSection === 'overview' ? 'fs-btn-primary' : 'fs-btn-secondary'}`} onClick={() => setActiveSection('overview')}>Overview</button>
          <button type="button" className={`fs-btn ${activeSection === 'calendar' ? 'fs-btn-primary' : 'fs-btn-secondary'}`} onClick={() => setActiveSection('calendar')}>Calendar</button>
          <button type="button" className={`fs-btn ${activeSection === 'todos' ? 'fs-btn-primary' : 'fs-btn-secondary'}`} onClick={() => setActiveSection('todos')}>Todos</button>
          <button type="button" className={`fs-btn ${activeSection === 'members' ? 'fs-btn-primary' : 'fs-btn-secondary'}`} onClick={() => setActiveSection('members')}>Members</button>
          <button type="button" className={`fs-btn ${activeSection === 'settings' ? 'fs-btn-primary' : 'fs-btn-secondary'}`} onClick={() => setActiveSection('settings')}>Settings</button>
        </aside>
        <section className="fs-main">
          {import.meta.env.DEV && snapshot.people.length === 0 ? <p className="dev-warning">Loaded group with 0 people — create flow may be broken.</p> : null}

          <form onSubmit={onSubmit}>
            <section className="panel fs-commandBar" aria-label="Command bar">
                <div className="fs-commandHeader">
                  <div>
                    <h2>Add event</h2>
                    <p className="prompt-tip">Type details or scan an image.</p>
                  </div>
                  <div className="fs-commandActions">
                  <button type="button" className="fs-btn fs-btn-primary" onClick={() => { void openScanCapture(null); }} aria-label="Scan appointment"><Camera />Scan</button>
                  <button type="button" className="fs-btn fs-btn-secondary" onClick={() => { void addAppointment(); }} disabled={isSubmitting || Boolean(proposalText) || Boolean(pendingQuestion)}><Plus />Add</button>
                  </div>
                </div>
              <div className="input-row fs-commandInputRow">
                <input id="prompt" aria-label="Command input" value={message} onChange={(event) => setMessage(event.target.value)} autoComplete="off" disabled={Boolean(proposalText) || Boolean(pendingQuestion)} placeholder={'e.g. Dentist Tue 3pm, Flight to Seattle Friday 8am'} />
              </div>
              <p className="prompt-tip">Examples: add/update appointments, assign APPT codes, or paste screenshot text for parsing.</p>
            </section>
          </form>

          {activeSection === 'overview' ? <section className="panel"><p>Overview view coming soon.</p></section> : null}

          {activeSection === 'settings' ? <section className="panel"><p>Settings view coming soon.</p></section> : null}

          {activeSection === 'calendar' ? (
            <>
              <section className="panel fs-cal">
                <div className="fs-calToolbar">
                  <div className="fs-calTabs" role="tablist" aria-label="Calendar views">
                    <button type="button" role="tab" aria-selected={calendarView === 'list'} className={`fs-calTab ${calendarView === 'list' ? 'is-active' : ''}`} onClick={() => setCalendarView('list')}>List</button>
                    <button type="button" role="tab" aria-selected={calendarView === 'month'} className={`fs-calTab ${calendarView === 'month' ? 'is-active' : ''}`} onClick={() => setCalendarView('month')}>Month</button>
                    <button type="button" role="tab" aria-selected="false" className="fs-calTab is-soon" disabled aria-disabled="true">Week · Soon</button>
                    <button type="button" role="tab" aria-selected="false" className="fs-calTab is-soon" disabled aria-disabled="true">Day · Soon</button>
                  </div>
                  {calendarView === 'month' ? (
                    <div className="fs-calMonthNav">
                      <button type="button" className="fs-btn fs-btn-ghost fs-btn-icon" aria-label="Previous month" onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}><ChevronLeft /></button>
                      <div className="fs-calMonth">{monthLabel}</div>
                      <button type="button" className="fs-btn fs-btn-ghost fs-btn-icon" aria-label="Next month" onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}><ChevronRight /></button>
                      <button type="button" className="fs-btn fs-btn-secondary" onClick={() => setMonthCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Today</button>
                    </div>
                  ) : null}
                </div>
                {calendarView === 'month' ? (
                  <>
                    <div className="fs-cal-grid fs-cal-gridHeader">{calendarWeekdays.map((weekday) => <div key={weekday} className="fs-cal-cell fs-cal-weekday">{weekday}</div>)}</div>
                    <div className="fs-cal-grid">
                      {monthDays.map((day) => {
                        const dateKey = day.toISOString().slice(0, 10);
                        const dayAppointments = appointmentsByDate[dateKey] ?? [];
                        const dayTodos = todosByDate[dateKey] ?? [];
                        const inMonth = day.getMonth() === monthAnchor.getMonth();
                        return (
                          <div key={dateKey} className={`fs-cal-cell ${inMonth ? '' : 'fs-cal-outside'}`}>
                            <div className="fs-cal-dateRow">
                              <span>{day.getDate()}</span>
                              <button type="button" className="fs-cal-dayPlus" aria-label={`Add appointment for ${dateKey}`} onClick={() => { void addAppointment(); }}>+</button>
                            </div>
                            <div className="fs-cal-items">
                              {dayAppointments.map((appointment) => (
                                <button
                                  key={appointment.code}
                                  type="button"
                                  className="fs-chip"
                                  onClick={() => openWhenEditor(appointment)}
                                  title={`${appointment.desc || 'Untitled'}\n${formatMonthAppointmentTime(appointment)}${appointment.locationDisplay ? `\n${appointment.locationDisplay}` : ''}`}
                                >
                                  <span className="fs-chipTitle">{appointment.desc || appointment.code}</span>
                                  <span className="fs-chipSubtle">{formatMonthAppointmentTime(appointment)}</span>
                                </button>
                              ))}
                              {dayTodos.map((todo) => (
                                <button key={todo.id} type="button" className={`fs-chip fs-chipTodo ${todo.done ? 'is-done' : ''}`} onClick={() => openTodoEditor(todo)} title={todo.text}>
                                  📝 {todo.text}
                                </button>
                              ))}
                              
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </section>

              {calendarView === 'list' ? (
                <section className="panel">
                  {sortedAppointments.length === 0 ? (
                    <div className="fs-alert" style={{ maxWidth: 760 }}>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>No appointments yet</div>
                      <div style={{ color: 'var(--muted)' }}>
                        Use the add row at the bottom of the table to create the first entry.
                      </div>
                    </div>
                  ) : null}
                  {isMobile ? (
                    <AppointmentCardList
                      appointments={sortedAppointments}
                      getStatus={(appointment) => (
                        appointment.time?.intent?.status !== 'resolved'
                          ? 'unreconcilable'
                          : appointment.people.some((personId) => computePersonStatusForInterval(personId, appointment, snapshot.rules).status === 'conflict')
                            ? 'conflict'
                            : 'no_conflict'
                      )}
                      formatWhen={formatAppointmentTime}
                      onEdit={openWhenEditor}
                      onDelete={setAppointmentToDelete}
                      onSelectPeople={setSelectedAppointment}
                      onOpenScanViewer={setScanViewerAppointment}
                      editIcon={<Pencil />}
                      deleteIcon={<Trash2 />}
                    />
                  ) : (
                    <div className="table-wrap fs-tableScroll">
                      <table className="data-table">
                        <thead>
                          <tr><th>Code</th><th>When</th><th>Status</th><th>Description</th><th>People</th><th>Location</th><th>Notes</th><th>Actions</th></tr>
                        </thead>
                        <tbody>
                          {sortedAppointments.map((appointment) => {
                            const apptStatus = appointment.time?.intent?.status !== 'resolved'
                              ? 'unreconcilable'
                              : appointment.people.some((personId) => computePersonStatusForInterval(personId, appointment, snapshot.rules).status === 'conflict')
                                ? 'conflict'
                                : 'no_conflict';
                            return (
                              <tr key={appointment.code}>
                                <td className="fs-codeCell"><code>{appointment.code}</code></td>
                                <td>
                                  <a href="#" className="when-link" onClick={(event) => { event.preventDefault(); openWhenEditor(appointment); }}>
                                    {appointment.time?.intent?.status !== 'resolved'
                                      ? <span className='status-tag unknown'>Unresolved</span>
                                      : formatAppointmentTime(appointment)}
                                  </a>
                                </td>
                                <td>
                                  {apptStatus === 'unreconcilable' ? (
                                    <button type="button" className="linkish" onClick={() => openWhenEditor(appointment)}>
                                      <span className="status-tag unknown">Unreconcilable</span>
                                    </button>
                                  ) : (
                                    <span className={`status-tag ${apptStatus === 'conflict' ? 'unavailable' : 'available'}`}>
                                      {apptStatus === 'conflict' ? 'Conflict' : 'No Conflict'}
                                    </span>
                                  )}
                                </td>
                                <td className="multiline-cell"><span className="line-clamp" title={appointment.desc || ''}>{appointment.desc || (appointment.scanStatus === 'pending' ? 'Scanning…' : appointment.scanStatus === 'parsed' ? 'Scanned appointment' : '—')}</span></td>
                                <td><button type="button" className="linkish" onClick={() => setSelectedAppointment(appointment)}>{appointment.peopleDisplay.length ? appointment.peopleDisplay.join(', ') : 'Unassigned'}</button></td>
                                <td className="multiline-cell"><div className="location-preview-wrap"><p className="location-preview">{appointment.locationDisplay || '—'}</p>{appointment.locationMapQuery ? <a className="location-map-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(appointment.locationMapQuery)}`} target="_blank" rel="noreferrer">Map</a> : null}</div></td>
                                <td className="multiline-cell"><span className="line-clamp" title={appointment.notes}>{appointment.notes || '—'}</span></td>
                                <td className="actions-cell">
                                  <div className="action-icons" onClick={(event) => { event.stopPropagation(); }}>
                                    {appointment.scanImageKey ? (
                                      <button
                                        type="button"
                                        className="icon-button"
                                        aria-label="View appointment scan"
                                        data-tooltip="View scan"
                                        onClick={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          setScanViewerAppointment(appointment);
                                        }}
                                      >
                                        <Camera />
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      className="icon-button"
                                      aria-label="Edit appointment"
                                      data-tooltip="Edit appointment"
                                      onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        openWhenEditor(appointment);
                                      }}
                                    >
                                      <Pencil />
                                    </button>
                                    <button type="button" className="icon-button" aria-label="Delete appointment" data-tooltip="Delete appointment" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setAppointmentToDelete(appointment); }}><Trash2 /></button>
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
            </>
          ) : null}

          {activeSection === 'todos' ? (
            <section className="panel fs-todo">
              <div className="panel-header">
                <h2>Todos</h2>
                <button type="button" className="fs-btn fs-btn-primary" onClick={createTodo}>+ Add todo</button>
              </div>
              <p className="fs-meta">TODO: wire todo persistence to backend in a follow-up pass.</p>
              <div className="fs-todo-list">
                {todos.map((todo) => (
                  <div key={todo.id} className="fs-todo-item">
                    <label>
                      <input type="checkbox" checked={todo.done} onChange={() => toggleTodo(todo.id)} />
                      <span>{todo.text}</span>
                    </label>
                    <div className="fs-todo-meta">
                      {todo.dueDate ? <span>Due: {todo.dueDate}</span> : null}
                      {todo.assignee ? <span>Assignee: {todo.assignee}</span> : null}
                    </div>
                    <div className="action-buttons">
                      <button type="button" className="fs-btn fs-btn-secondary" onClick={() => openTodoEditor(todo)}>Edit</button>
                      <button type="button" className="fs-btn fs-btn-secondary" onClick={() => deleteTodo(todo.id)}>Delete</button>
                    </div>
                  </div>
                ))}
                {todos.length === 0 ? <p className="fs-meta">No todos yet.</p> : null}
              </div>
            </section>
          ) : null}

          {activeSection === 'members' ? (
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
                                <button type="button" className="fs-btn fs-btn-primary" onClick={() => void submitPersonEdit()}>Accept</button>
                                <button type="button" className="fs-btn fs-btn-secondary" onClick={() => void cancelPersonEdit()}>Cancel</button>
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
        </section>
      </div>

      {proposalText ? <div className="modal-backdrop"><div className="modal"><h3>Confirm this change?</h3><p>{proposalText}</p><div className="modal-actions"><button type="button" onClick={() => void sendMessage('confirm')}>Confirm</button><button type="button" onClick={() => void sendMessage('cancel')}>Cancel</button></div></div></div> : null}

      {pendingQuestion ? <QuestionDialog question={pendingQuestion} value={questionInput} onValueChange={setQuestionInput} onOptionSelect={(reply) => { setPendingQuestion(null); setQuestionInput(''); void sendMessage(reply); }} onSubmitText={() => { const out = questionInput.trim(); if (!out) return; setPendingQuestion(null); setQuestionInput(''); void sendMessage(out); }} onClose={() => { setPendingQuestion(null); setQuestionInput(''); }} /> : null}


      <input ref={fileScanInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(event) => { void onPickScanFile(event); }} />
      {appointmentToDelete ? <div className="modal-backdrop"><div className="modal"><h3>Delete {appointmentToDelete.code} ({appointmentToDelete.desc || 'Untitled'})?</h3><div className="modal-actions"><button type="button" onClick={() => { void sendDirectAction({ type: 'delete_appointment', code: appointmentToDelete.code }); setAppointmentToDelete(null); }}>Confirm</button><button type="button" onClick={() => setAppointmentToDelete(null)}>Cancel</button></div></div></div> : null}


      {scanViewerAppointment ? <div className="modal-backdrop"><div className="modal scan-viewer-modal"><h3>{scanViewerAppointment.code} scan</h3><div className="scan-viewer-content"><img className="scan-full" src={apiUrl(`/api/appointmentScanImage?groupId=${encodeURIComponent(groupId)}&phone=${encodeURIComponent(phone)}&appointmentId=${encodeURIComponent(scanViewerAppointment.id)}`)} /></div><div className="modal-actions"><button type="button" onClick={() => { setScanViewerAppointment(null); void openScanCapture(scanViewerAppointment.id); }}>Rescan</button><button type="button" onClick={() => { void fetch(apiUrl('/api/appointmentScanDelete'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupId, phone, appointmentId: scanViewerAppointment.id }) }).then(() => refreshSnapshot()); setScanViewerAppointment(null); }}>Delete</button><button type="button" onClick={() => setScanViewerAppointment(null)}>Close</button></div></div></div> : null}
      {scanCaptureModal.useCameraPreview ? <div className="modal-backdrop"><div className="modal scan-capture-modal"><h3>{scanCaptureModal.appointmentId ? 'Rescan appointment' : 'Scan appointment'}</h3><div className="scan-capture-preview"><video ref={scanCaptureVideoRef} autoPlay playsInline muted /></div><canvas ref={scanCaptureCanvasRef} style={{ display: 'none' }} /><div className="modal-actions"><button type="button" onClick={() => { void captureScanFrame(); }}>Capture</button><button type="button" onClick={closeScanCaptureModal}>Cancel</button></div></div></div> : null}
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

      <Drawer open={editingTodo != null} title="Edit todo" onClose={closeTodoEditor}>
        {editingTodo ? (
          <div className="field-grid">
            <label>Text<input value={todoDraft.text} onChange={(event) => setTodoDraft((prev) => ({ ...prev, text: event.target.value }))} /></label>
            <label>Due date<input type="date" value={todoDraft.dueDate} onChange={(event) => setTodoDraft((prev) => ({ ...prev, dueDate: event.target.value }))} /></label>
            <label>Assignee<input value={todoDraft.assignee} onChange={(event) => setTodoDraft((prev) => ({ ...prev, assignee: event.target.value }))} placeholder="Name" /></label>
            <label className="switch-row"><input type="checkbox" checked={todoDraft.done} onChange={(event) => setTodoDraft((prev) => ({ ...prev, done: event.target.checked }))} />Done</label>
            <div className="modal-actions">
              <button type="button" onClick={saveTodo} disabled={!todoDraft.text.trim()}>Save</button>
              <button type="button" onClick={() => deleteTodo(editingTodo.id)}>Delete</button>
              <button type="button" onClick={closeTodoEditor}>Cancel</button>
            </div>
          </div>
        ) : null}
      </Drawer>

      <Drawer open={whenEditorCode != null} title="Edit appointment" onClose={closeWhenEditor}>
        {editingAppointment ? (
          <AppointmentEditorForm
            appointmentCode={editingAppointment.code}
            whenValue={whenDraftText}
            descriptionValue={descDraftText}
            locationValue={locationDraftText}
            notesValue={notesDraftText}
            onWhenChange={setWhenDraftText}
            onWhenKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void previewWhenDraft(editingAppointment);
              }
            }}
            onDescriptionChange={setDescDraftText}
            onLocationChange={setLocationDraftText}
            onNotesChange={setNotesDraftText}
            onResolveDate={() => void previewWhenDraft(editingAppointment)}
            errorText={whenDraftError}
            previewContent={whenPreviewed ? (
              <div>
                <p><strong>Preview:</strong> {formatAppointmentTime({ ...editingAppointment, time: whenDraftResult ?? editingAppointment.time })}</p>
                {whenDraftResult?.intent?.assumptions?.length ? <><p>Assumptions</p><ul>{whenDraftResult.intent.assumptions.map((assumption, i) => <li key={`${assumption}-${i}`}>{assumption}</li>)}</ul></> : null}
                {whenDraftResult?.intent.status !== 'resolved' ? <p>{formatMissingSummary(whenDraftResult?.intent.missing ?? [])}</p> : null}
              </div>
            ) : null}
            onConfirm={() => void confirmWhenDraft(editingAppointment)}
            onCancel={closeWhenEditor}
          />
        ) : null}
      </Drawer>
      <FooterHelp />
      <div className="build-version">Build: {buildInfo.sha.slice(0, 7)} {buildInfo.time} · {usageLabel}</div>
    </Page>
  );
}
