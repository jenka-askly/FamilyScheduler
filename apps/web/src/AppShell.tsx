import { FormEvent, Fragment, KeyboardEvent as ReactKeyboardEvent, ReactNode, SyntheticEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AppointmentEditorForm } from './components/AppointmentEditorForm';
import { AppointmentCardList } from './components/AppointmentCardList';
import { Drawer } from './components/Drawer';
import { FooterHelp } from './components/layout/FooterHelp';
import { Page } from './components/layout/Page';
import { PageHeader } from './components/layout/PageHeader';
import { apiUrl } from './lib/apiUrl';
import type { TimeSpec } from '../../../packages/shared/src/types.js';
import {
  Alert,
  Box,
  Button,
  Chip,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  FormGroup,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Link as MuiLink,
  Paper,
  Stack,
  SvgIcon,
  Tab,
  TextField,
  Tabs,
  Tooltip,
  Typography
} from '@mui/material';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';

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

type Session = { groupId: string; phone: string; joinedAt: string };

const calendarWeekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SESSION_KEY = 'familyscheduler.session';
const createTraceId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `trace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};
const writeSession = (session: Session): void => {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

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
  <Dialog open onClose={onClose} fullWidth maxWidth="sm">
    <DialogTitle>Question</DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{ mt: 0.5 }}>
        <Typography>{question.message}</Typography>
        {question.options.length > 0 ? (
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {question.options.map((option, index) => (
              <Button
                key={`${option.label}-${index}`}
                type="button"
                variant={option.style === 'primary' ? 'contained' : 'outlined'}
                color={option.style === 'danger' ? 'error' : option.style === 'secondary' ? 'secondary' : 'primary'}
                onClick={() => onOptionSelect(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </Stack>
        ) : null}
        {question.allowFreeText ? (
          <Stack component="form" spacing={1} onSubmit={(event) => { event.preventDefault(); onSubmitText(); }}>
            <TextField label="Your response" value={value} onChange={(event) => onValueChange(event.target.value)} autoComplete="off" fullWidth />
            <Stack direction="row" justifyContent="flex-end">
              <Button type="submit" disabled={!value.trim()} variant="contained">Send</Button>
            </Stack>
          </Stack>
        ) : null}
      </Stack>
    </DialogContent>
    <DialogActions><Button type="button" onClick={onClose}>Close</Button></DialogActions>
  </Dialog>
);

const AppointmentDialogContext = ({
  title,
  subtitle
}: {
  title: string;
  subtitle: string;
}) => (
  <Box sx={{ mt: 0.5, mb: 1.5, pb: 1.5, borderBottom: (theme) => `1px solid ${theme.palette.divider}` }}>
    <Stack spacing={0.25}>
      <Typography variant="subtitle2" noWrap title={title}>{title}</Typography>
      <Typography variant="body2" color="text.secondary" noWrap title={subtitle}>{subtitle}</Typography>
    </Stack>
  </Box>
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
const ChevronLeft = () => <Icon><path d="m15 18-6-6 6-6" /></Icon>;
const ChevronRight = () => <Icon><path d="m9 18 6-6-6-6" /></Icon>;
const DocumentScannerIcon = () => <SvgIcon><path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm8 1.5V8h4.5" /><path d="M8 13h8M8 17h8M8 9h3" /></SvgIcon>;
const MoreVertIcon = () => <SvgIcon><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></SvgIcon>;

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

const getAppointmentContext = (appointment: Snapshot['appointments'][0]) => {
  const title = appointment.desc?.trim() || appointment.code;
  const locationText = appointment.locationDisplay || appointment.location || appointment.locationRaw;
  const subtitle = locationText ? `${formatAppointmentTime(appointment)} • ${locationText}` : formatAppointmentTime(appointment);
  return { title, subtitle };
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

  const normalizeGroupName = (value: string) => value.trim().replace(/\s+/g, ' ');

  async function renameGroupName(nextName: string): Promise<void> {
    const normalized = normalizeGroupName(nextName);
    const traceId = createTraceId();
    if (!normalized) throw new Error('Group name is required.');
    if (normalized.length > 60) throw new Error('Group name must be 60 characters or fewer.');

    const response = await fetch(apiUrl('/api/group/rename'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ groupId, phone, groupName: normalized, traceId })
    });

    const payload = await response.json() as { groupName?: string; traceId?: string; message?: string };
    if (!response.ok) {
      throw new Error(`${payload.message ?? 'Unable to rename group.'}${payload.traceId ? ` (trace: ${payload.traceId})` : ''}`);
    }

    setGroupName(payload.groupName || normalized);
  }
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
  const [breakoutError, setBreakoutError] = useState<string | null>(null);
  const [isSpinningOff, setIsSpinningOff] = useState(false);
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
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [quickAddText, setQuickAddText] = useState('');
  const [advancedText, setAdvancedText] = useState('');

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

  const submitQuickAdd = async () => {
    const out = quickAddText.trim();
    if (!out || isSubmitting || proposalText || pendingQuestion) return;
    setQuickAddText('');
    setIsQuickAddOpen(false);
    await sendMessage(out);
  };

  const submitAdvanced = async () => {
    const out = advancedText.trim();
    if (!out || isSubmitting || proposalText || pendingQuestion) return;
    setAdvancedText('');
    setIsAdvancedOpen(false);
    await sendMessage(out);
  };

  const commandActionsDisabled = isSubmitting || Boolean(proposalText) || Boolean(pendingQuestion);

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
  const scanCaptureAppointment = scanCaptureModal.appointmentId
    ? sortedAppointments.find((appointment) => appointment.id === scanCaptureModal.appointmentId) ?? null
    : null;
  const activePeople = snapshot.people.filter((person) => person.status === 'active');
  const peopleInView = snapshot.people.filter((person) => person.status === 'active');
  const headerTitle = activeSection === 'todos' ? 'Todos' : activeSection === 'overview' ? 'Overview' : activeSection === 'settings' ? 'Settings' : undefined;
  const headerDescription = activeSection === 'todos'
      ? 'Track personal and family todos.'
      : activeSection === 'overview'
        ? 'Overview is coming soon.'
        : activeSection === 'settings'
          ? 'Settings is coming soon.'
          : undefined;
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
    let frameId: number | null = null;
    let attempts = 0;

    const attachPreview = () => {
      const video = scanCaptureVideoRef.current;
      const stream = scanCaptureStreamRef.current;
      if (!stream) return;
      if (!video && attempts < 6) {
        attempts += 1;
        frameId = window.requestAnimationFrame(attachPreview);
        return;
      }
      if (!video) return;
      video.srcObject = stream;
      void video.play().catch(() => undefined);
    };

    attachPreview();
    return () => {
      if (frameId != null) window.cancelAnimationFrame(frameId);
    };
  }, [scanCaptureModal.useCameraPreview]);

  useEffect(() => () => {
    stopScanCaptureStream();
  }, []);

  const createBreakoutGroup = async () => {
    if (isSpinningOff) return;
    setBreakoutError(null);
    setIsSpinningOff(true);
    const traceId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    try {
      const response = await fetch(apiUrl('/api/ignite/spinoff'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceGroupId: groupId, phone, traceId, groupName: '' })
      });
      const data = await response.json() as { ok?: boolean; newGroupId?: string; message?: string; traceId?: string };
      if (!response.ok || !data.ok || !data.newGroupId) {
        setBreakoutError(`${data.message ?? 'Unable to create breakout group.'}${data.traceId ? ` (trace: ${data.traceId})` : ''}`);
        return;
      }
      writeSession({ groupId: data.newGroupId, phone, joinedAt: new Date().toISOString() });
      window.location.hash = `/g/${data.newGroupId}/ignite`;
    } catch {
      setBreakoutError(`Unable to create breakout group. (trace: ${traceId})`);
    } finally {
      setIsSpinningOff(false);
    }
  };

  return (
    <Page variant="workspace">
      <PageHeader
        title={headerTitle}
        description={headerDescription}
        groupName={groupName}
        groupId={groupId}
        memberNames={activePeople.map((person) => person.name).filter((name) => name.trim())}
        onMembersClick={() => setActiveSection('members')}
        showGroupAccessNote={activeSection !== 'calendar' && activeSection !== 'members'}
        onBreakoutClick={() => { void createBreakoutGroup(); }}
        breakoutDisabled={isSpinningOff}
        onRenameGroupName={renameGroupName}
      />
      {breakoutError ? (
        <div className="ui-alert" style={{ maxWidth: 760, marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Breakout Group</div>
          <div style={{ color: 'var(--muted)' }}>{breakoutError}</div>
        </div>
      ) : null}
      <div className="ui-shell">
        <aside className="ui-sidebar">
          <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 1 }}>
            <List disablePadding>
              <ListItemButton
                selected={activeSection === 'calendar'}
                onClick={() => setActiveSection('calendar')}
                sx={{ borderRadius: 1, mb: 0.5, ...(activeSection === 'calendar' ? { borderLeft: 3, borderColor: 'primary.main', borderStyle: 'solid', borderRight: 0, borderTop: 0, borderBottom: 0, pl: 1.5 } : null) }}
              >
                <ListItemText primary="Schedule" />
              </ListItemButton>
              <ListItemButton
                selected={activeSection === 'members'}
                onClick={() => setActiveSection('members')}
                sx={{ borderRadius: 1, ...(activeSection === 'members' ? { borderLeft: 3, borderColor: 'primary.main', borderStyle: 'solid', borderRight: 0, borderTop: 0, borderBottom: 0, pl: 1.5 } : null) }}
              >
                <ListItemText primary="Members" />
              </ListItemButton>
            </List>
          </Box>
        </aside>
        <section className="ui-main">
          {import.meta.env.DEV && snapshot.people.length === 0 ? <p className="dev-warning">Loaded group with 0 people — create flow may be broken.</p> : null}

          {activeSection === 'overview' ? <section className="panel"><p>Overview view coming soon.</p></section> : null}

          {activeSection === 'settings' ? <section className="panel"><p>Settings view coming soon.</p></section> : null}

          {activeSection === 'calendar' ? (
            <>
              <section className="ui-cal">
                <Paper variant="outlined" sx={{ borderRadius: 2 }}>
                  <Box sx={{ px: 2, pt: 1 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ gap: 2 }}>
                      <Tabs
                        value={calendarView}
                        onChange={(_event: SyntheticEvent, value: CalendarView) => setCalendarView(value)}
                        aria-label="Calendar views"
                        sx={{ flex: 1, minHeight: 40, '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 600 } }}
                      >
                        <Tab label="List" value="list" />
                        <Tab label="Month" value="month" />
                        <Tab label="Week · Soon" value="week" disabled aria-disabled="true" />
                        <Tab label="Day · Soon" value="day" disabled aria-disabled="true" />
                      </Tabs>
                      <Stack direction="row" spacing={1} alignItems="center" aria-label="Calendar actions">
                        <Tooltip title="Scan to create appointment">
                          <span>
                            <IconButton onClick={() => { void openScanCapture(null); }} aria-label="Scan to create appointment">
                              <DocumentScannerIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Add">
                          <span>
                            <IconButton color="primary" onClick={() => { void addAppointment(); }} aria-label="Add appointment" disabled={commandActionsDisabled}>
                              <Plus />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="More">
                          <span>
                            <IconButton onClick={() => setIsAdvancedOpen(true)} aria-label="More actions" disabled={commandActionsDisabled}>
                              <MoreVertIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </Box>
                  <Divider />
                  <Box sx={{ p: 2 }}>
                    {calendarView === 'month' ? (
                      <>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                          <IconButton size="small" aria-label="Previous month" onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}><ChevronLeft /></IconButton>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, minWidth: 150 }}>{monthLabel}</Typography>
                          <IconButton size="small" aria-label="Next month" onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}><ChevronRight /></IconButton>
                          <Button size="small" variant="outlined" onClick={() => setMonthCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Today</Button>
                        </Stack>
                    <div className="ui-cal-grid ui-cal-gridHeader">{calendarWeekdays.map((weekday) => <div key={weekday} className="ui-cal-cell ui-cal-weekday">{weekday}</div>)}</div>
                    <div className="ui-cal-grid">
                      {monthDays.map((day) => {
                        const dateKey = day.toISOString().slice(0, 10);
                        const dayAppointments = appointmentsByDate[dateKey] ?? [];
                        const dayTodos = todosByDate[dateKey] ?? [];
                        const inMonth = day.getMonth() === monthAnchor.getMonth();
                        return (
                          <div key={dateKey} className={`ui-cal-cell ${inMonth ? '' : 'ui-cal-outside'}`}>
                            <div className="ui-cal-dateRow">
                              <span>{day.getDate()}</span>
                              <button type="button" className="ui-cal-dayPlus" aria-label={`Add appointment for ${dateKey}`} onClick={() => { void addAppointment(); }}>+</button>
                            </div>
                            <div className="ui-cal-items">
                              {dayAppointments.map((appointment) => (
                                <button
                                  key={appointment.code}
                                  type="button"
                                  className="ui-chip"
                                  onClick={() => openWhenEditor(appointment)}
                                  title={`${appointment.desc || 'Untitled'}\n${formatMonthAppointmentTime(appointment)}${appointment.locationDisplay ? `\n${appointment.locationDisplay}` : ''}`}
                                >
                                  <span className="ui-chipTitle">{appointment.desc || appointment.code}</span>
                                  <span className="ui-chipSubtle">{formatMonthAppointmentTime(appointment)}</span>
                                </button>
                              ))}
                              {dayTodos.map((todo) => (
                                <button key={todo.id} type="button" className={`ui-chip ui-chipTodo ${todo.done ? 'is-done' : ''}`} onClick={() => openTodoEditor(todo)} title={todo.text}>
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

                    {calendarView === 'list' ? (
                      <>
                        {sortedAppointments.length === 0 ? (
                          <Alert severity="info" sx={{ maxWidth: 760 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>No appointments yet</Typography>
                            <Typography variant="body2">Add your first event using + above.</Typography>
                          </Alert>
                        ) : null}
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
                          scanViewIcon={<ReceiptLongOutlinedIcon fontSize="small" />}
                          editIcon={<Pencil />}
                          assignIcon={<GroupOutlinedIcon fontSize="small" />}
                          deleteIcon={<Trash2 />}
                        />
                      </>
                    ) : null}
                  </Box>
                </Paper>
              </section>
            </>
          ) : null}

          {activeSection === 'todos' ? (
            <section className="panel ui-todo">
              <div className="panel-header">
                <h2>Todos</h2>
                <button type="button" className="ui-btn ui-btn-primary" onClick={createTodo}>+ Add todo</button>
              </div>
              <p className="ui-meta">TODO: wire todo persistence to backend in a follow-up pass.</p>
              <div className="ui-todo-list">
                {todos.map((todo) => (
                  <div key={todo.id} className="ui-todo-item">
                    <label>
                      <input type="checkbox" checked={todo.done} onChange={() => toggleTodo(todo.id)} />
                      <span>{todo.text}</span>
                    </label>
                    <div className="ui-todo-meta">
                      {todo.dueDate ? <span>Due: {todo.dueDate}</span> : null}
                      {todo.assignee ? <span>Assignee: {todo.assignee}</span> : null}
                    </div>
                    <div className="action-buttons">
                      <button type="button" className="ui-btn ui-btn-secondary" onClick={() => openTodoEditor(todo)}>Edit</button>
                      <button type="button" className="ui-btn ui-btn-secondary" onClick={() => deleteTodo(todo.id)}>Delete</button>
                    </div>
                  </div>
                ))}
                {todos.length === 0 ? <p className="ui-meta">No todos yet.</p> : null}
              </div>
            </section>
          ) : null}

          {activeSection === 'members' ? (
            <section className="panel">
              <Paper variant="outlined" sx={{ borderRadius: 2 }}>
                <Box sx={{ px: 2, pt: 1 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ gap: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>People</Typography>
                    <Stack direction="row" spacing={1} alignItems="center" aria-label="People actions">
                      <Tooltip title="Add person">
                        <span>
                          <IconButton color="primary" onClick={() => { void addPerson(); }} aria-label="Add person">
                            <Plus />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </Box>
                <Divider />
                <Box sx={{ p: 2 }}>
                  {peopleInView.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      No people added yet.
                    </Typography>
                  ) : null}
                  <div className="table-wrap ui-tableScroll">
                    <table className="ui-membersTable">
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
                                <button type="button" className="ui-btn ui-btn-primary" onClick={() => void submitPersonEdit()}>Accept</button>
                                <button type="button" className="ui-btn ui-btn-secondary" onClick={() => void cancelPersonEdit()}>Cancel</button>
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
                      </tbody>
                    </table>
                  </div>
                </Box>
              </Paper>
            </section>
          ) : null}
        </section>
      </div>

      <Dialog open={isQuickAddOpen} onClose={() => setIsQuickAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Quick add</DialogTitle>
        <DialogContent>
          <Stack component="form" spacing={2} onSubmit={(event) => { event.preventDefault(); void submitQuickAdd(); }}>
            <TextField
              label="Event"
              value={quickAddText}
              onChange={(event) => setQuickAddText(event.target.value)}
              autoComplete="off"
              placeholder="e.g. Dentist Tue 2pm"
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button type="button" variant="outlined" onClick={() => setIsQuickAddOpen(false)}>Cancel</Button>
          <Button type="button" variant="contained" onClick={() => { void submitQuickAdd(); }} disabled={commandActionsDisabled || !quickAddText.trim()}>Add</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isAdvancedOpen} onClose={() => setIsAdvancedOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add or Update Events</DialogTitle>
        <DialogContent>
          <Stack component="form" spacing={2} onSubmit={(event) => { event.preventDefault(); void submitAdvanced(); }}>
            <TextField
              label="Details"
              multiline
              minRows={5}
              value={advancedText}
              onChange={(event) => setAdvancedText(event.target.value)}
              placeholder={[
                'Add dentist appointment Tuesday at 2pm',
                'Move flight to 8am',
                'Assign APPT-3 to John',
                'Paste an email confirmation',
                'Paste CSV rows'
              ].join('\n')}
              fullWidth
            />
            <Typography className="prompt-tip">Describe a change or paste schedule text. We’ll extract the events.</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button type="button" variant="outlined" onClick={() => setIsAdvancedOpen(false)}>Cancel</Button>
          <Button type="button" variant="contained" onClick={() => { void submitAdvanced(); }} disabled={commandActionsDisabled || !advancedText.trim()}>Process</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(proposalText)} onClose={() => void sendMessage('cancel')} fullWidth maxWidth="sm">
        <DialogTitle>Confirm this change?</DialogTitle>
        <DialogContent>
          <Typography>{proposalText}</Typography>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={() => void sendMessage('cancel')}>Cancel</Button>
          <Button type="button" variant="contained" onClick={() => void sendMessage('confirm')}>Confirm</Button>
        </DialogActions>
      </Dialog>

      {pendingQuestion ? <QuestionDialog question={pendingQuestion} value={questionInput} onValueChange={setQuestionInput} onOptionSelect={(reply) => { setPendingQuestion(null); setQuestionInput(''); void sendMessage(reply); }} onSubmitText={() => { const out = questionInput.trim(); if (!out) return; setPendingQuestion(null); setQuestionInput(''); void sendMessage(out); }} onClose={() => { setPendingQuestion(null); setQuestionInput(''); }} /> : null}


      <input ref={fileScanInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(event) => { void onPickScanFile(event); }} />
      <Dialog open={Boolean(appointmentToDelete)} onClose={() => setAppointmentToDelete(null)} fullWidth maxWidth="xs">
        <DialogTitle>Delete appointment</DialogTitle>
        <DialogContent>
          {appointmentToDelete ? <AppointmentDialogContext {...getAppointmentContext(appointmentToDelete)} /> : null}
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={() => setAppointmentToDelete(null)}>Cancel</Button>
          <Button
            type="button"
            variant="contained"
            color="error"
            onClick={() => {
              if (!appointmentToDelete) return;
              void sendDirectAction({ type: 'delete_appointment', code: appointmentToDelete.code });
              setAppointmentToDelete(null);
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>


      <Dialog open={Boolean(scanViewerAppointment)} onClose={() => setScanViewerAppointment(null)} maxWidth="md" fullWidth>
        <DialogTitle>Scan</DialogTitle>
        <DialogContent>
          {scanViewerAppointment ? <AppointmentDialogContext {...getAppointmentContext(scanViewerAppointment)} /> : null}
          {scanViewerAppointment ? (
            <Box
              component="img"
              sx={{ width: '100%', height: 'auto', maxHeight: '70vh', objectFit: 'contain', borderRadius: 1 }}
              src={apiUrl(`/api/appointmentScanImage?groupId=${encodeURIComponent(groupId)}&phone=${encodeURIComponent(phone)}&appointmentId=${encodeURIComponent(scanViewerAppointment.id)}`)}
            />
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button
            type="button"
            onClick={() => {
              if (!scanViewerAppointment) return;
              const appointmentId = scanViewerAppointment.id;
              setScanViewerAppointment(null);
              void openScanCapture(appointmentId);
            }}
          >
            Rescan
          </Button>
          <Button
            type="button"
            color="error"
            onClick={() => {
              if (!scanViewerAppointment) return;
              const appointmentId = scanViewerAppointment.id;
              void fetch(apiUrl('/api/appointmentScanDelete'), {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ groupId, phone, appointmentId })
              }).then(() => refreshSnapshot());
              setScanViewerAppointment(null);
            }}
          >
            Delete
          </Button>
          <Button type="button" onClick={() => setScanViewerAppointment(null)}>Close</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={scanCaptureModal.useCameraPreview} onClose={closeScanCaptureModal} maxWidth="md" fullWidth>
        <DialogTitle>{scanCaptureModal.appointmentId ? 'Rescan appointment' : 'Scan appointment'}</DialogTitle>
        <DialogContent>
          {scanCaptureAppointment ? <AppointmentDialogContext {...getAppointmentContext(scanCaptureAppointment)} /> : null}
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Box component="video" ref={scanCaptureVideoRef} autoPlay playsInline muted sx={{ width: '100%', minHeight: 320, maxHeight: '60vh', borderRadius: 1, objectFit: 'cover', backgroundColor: 'black' }} />
          </Box>
          <canvas ref={scanCaptureCanvasRef} style={{ display: 'none' }} />
        </DialogContent>
        <DialogActions>
          <Button type="button" variant="contained" onClick={() => { void captureScanFrame(); }}>Capture</Button>
          <Button type="button" variant="outlined" onClick={closeScanCaptureModal}>Cancel</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(personToDelete)} onClose={() => setPersonToDelete(null)} fullWidth maxWidth="sm">
        <DialogTitle>{personToDelete ? `Delete ${personToDelete.name || personToDelete.personId}?` : 'Delete person?'}</DialogTitle>
        <DialogContent>
          <Typography>This will remove this person from the active allowlist. Existing history and appointments are preserved.</Typography>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={() => setPersonToDelete(null)}>Cancel</Button>
          <Button
            type="button"
            variant="contained"
            color="error"
            onClick={() => {
              if (!personToDelete) return;
              void sendDirectAction({ type: 'delete_person', personId: personToDelete.personId });
              setPersonToDelete(null);
              if (editingPersonId === personToDelete.personId) {
                setEditingPersonId(null);
                setPendingBlankPersonId(null);
                setPersonEditError(null);
              }
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(ruleToDelete)} onClose={() => setRuleToDelete(null)} fullWidth maxWidth="sm">
        <DialogTitle>{ruleToDelete ? `Delete rule ${ruleToDelete.code}?` : 'Delete rule?'}</DialogTitle>
        <DialogContent>
          <Typography>This removes the rule from this person.</Typography>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={() => setRuleToDelete(null)}>Cancel</Button>
          <Button
            type="button"
            variant="contained"
            color="error"
            onClick={() => {
              if (!ruleToDelete) return;
              void sendMessage(`Delete rule ${ruleToDelete.code}`);
              setRuleToDelete(null);
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(rulePromptModal)} onClose={closeRulePromptModal} fullWidth maxWidth="md">
        <DialogTitle>Rules</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              inputRef={rulePromptTextareaRef}
              label="Availability rule"
              multiline
              minRows={4}
              value={rulePrompt}
              onChange={(event) => setRulePrompt(event.target.value)}
              placeholder={'Examples:\nWeekdays after 6pm I am available.\nI’m unavailable next Tuesday from 1-3pm.'}
            />
            <Stack direction="row" justifyContent="flex-end">
              <Button type="button" onClick={() => void draftRulePrompt()} disabled={!rulePrompt.trim() || isDrafting || isConfirming}>{isDrafting ? 'Drafting…' : 'Draft Rule'}</Button>
            </Stack>
            {ruleDraftError ? (
              <Alert severity="error">
                {ruleDraftError}
                {ruleDraftErrorMeta?.code || ruleDraftErrorMeta?.traceId ? <><br /><small>{ruleDraftErrorMeta?.code ? `code=${ruleDraftErrorMeta.code} ` : ''}{ruleDraftErrorMeta?.traceId ? `traceId=${ruleDraftErrorMeta.traceId}` : ''}</small></> : null}
              </Alert>
            ) : null}
            <Box>
              <Typography variant="subtitle2">Preview</Typography>
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
                <Typography className="muted-empty">No proposed changes yet. Click Draft to preview.</Typography>
              )}
              {ruleDraft?.assumptions.length ? <><Typography variant="subtitle2" sx={{ mt: 1 }}>Assumptions</Typography><ul>{ruleDraft.assumptions.map((assumption, i) => <li key={`${assumption}-${i}`}>{assumption}</li>)}</ul></> : null}
              {ruleDraft?.warnings.length ? <><Typography variant="subtitle2" sx={{ mt: 1 }}>Warnings</Typography><ul>{ruleDraft.warnings.map((warning, i) => <li key={`${warning.code}-${i}`}>{warning.message}</li>)}</ul></> : null}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button type="button" variant="contained" onClick={() => void confirmRulePrompt()} disabled={!hasProposedRules || isConfirming}>{isConfirming ? 'Confirming…' : 'Add Rule'}</Button>
          <Button type="button" variant="outlined" onClick={closeRulePromptModal}>Cancel</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(selectedAppointment)} onClose={() => setSelectedAppointment(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign people</DialogTitle>
        <DialogContent>
          {selectedAppointment ? <AppointmentDialogContext {...getAppointmentContext(selectedAppointment)} /> : null}
          <FormGroup>
            {selectedAppointment ? activePeople.map((person, index) => {
              const status = computePersonStatusForInterval(person.personId, selectedAppointment, snapshot.rules);
              const isSelected = selectedAppointment.people.includes(person.personId);
              return (
                <Box key={person.personId}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
                    <FormControlLabel
                      control={<Checkbox checked={isSelected} onChange={() => toggleAppointmentPerson(selectedAppointment, person.personId)} />}
                      label={person.name}
                    />
                    <Chip
                      variant="outlined"
                      color={status.status === 'no_conflict' ? 'success' : status.status === 'conflict' ? 'warning' : 'default'}
                      label={status.status === 'no_conflict' ? 'No Conflict' : status.status === 'conflict' ? 'Conflict' : 'Unreconcilable'}
                    />
                  </Box>
                  {index < activePeople.length - 1 ? <Divider /> : null}
                </Box>
              );
            }) : null}
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={() => setSelectedAppointment(null)}>Close</Button>
          <Button
            type="button"
            variant="contained"
            onClick={() => {
              if (!selectedAppointment) return;
              void sendMessage(`Replace people on appointment code=${selectedAppointment.code} people=${selectedAppointment.people.join(',')}`);
              setSelectedAppointment(null);
            }}
          >
            Apply
          </Button>
        </DialogActions>
      </Dialog>

      <Drawer open={editingTodo != null} title="Edit todo" onClose={closeTodoEditor}>
        {editingTodo ? (
          <div className="field-grid">
            <label>Text<input value={todoDraft.text} onChange={(event) => setTodoDraft((prev) => ({ ...prev, text: event.target.value }))} /></label>
            <label>Due date<input type="date" value={todoDraft.dueDate} onChange={(event) => setTodoDraft((prev) => ({ ...prev, dueDate: event.target.value }))} /></label>
            <label>Assignee<input value={todoDraft.assignee} onChange={(event) => setTodoDraft((prev) => ({ ...prev, assignee: event.target.value }))} placeholder="Name" /></label>
            <label className="switch-row"><input type="checkbox" checked={todoDraft.done} onChange={(event) => setTodoDraft((prev) => ({ ...prev, done: event.target.checked }))} />Done</label>
            <Stack direction="row" spacing={1}>
              <Button type="button" variant="contained" onClick={saveTodo} disabled={!todoDraft.text.trim()}>Save</Button>
              <Button type="button" color="error" onClick={() => deleteTodo(editingTodo.id)}>Delete</Button>
              <Button type="button" variant="outlined" onClick={closeTodoEditor}>Cancel</Button>
            </Stack>
          </div>
        ) : null}
      </Drawer>

      <Dialog open={whenEditorCode != null} onClose={closeWhenEditor} maxWidth="md" fullWidth>
        <DialogTitle>Edit appointment</DialogTitle>
        <DialogContent dividers>
          {editingAppointment ? <AppointmentDialogContext {...getAppointmentContext(editingAppointment)} /> : null}
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
        </DialogContent>
      </Dialog>
      <FooterHelp usageLabel={usageLabel} />
    </Page>
  );
}
