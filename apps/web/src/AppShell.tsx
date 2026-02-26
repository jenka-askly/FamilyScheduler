import { FormEvent, Fragment, KeyboardEvent as ReactKeyboardEvent, ReactNode, SyntheticEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AppointmentEditorForm } from './components/AppointmentEditorForm';
import { AppointmentCardList } from './components/AppointmentCardList';
import { Drawer } from './components/Drawer';
import { FooterHelp } from './components/layout/FooterHelp';
import { Page } from './components/layout/Page';
import { PageHeader } from './components/layout/PageHeader';
import { apiFetch, apiUrl } from './lib/apiUrl';
import { spinoffBreakoutGroup } from './lib/ignite/spinoffBreakout';
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
  Link as MuiLink,
  Menu,
  MenuItem,
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
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

type TranscriptEntry = { role: 'assistant' | 'user'; text: string };
type Snapshot = {
  appointments: Array<{ id: string; code: string; desc: string; schemaVersion?: number; updatedAt?: string; time: TimeSpec; date: string; startTime?: string; durationMins?: number; isAllDay: boolean; people: string[]; peopleDisplay: string[]; location: string; locationRaw: string; locationDisplay: string; locationMapQuery: string; locationName: string; locationAddress: string; locationDirections: string; notes: string; scanStatus: 'pending' | 'parsed' | 'failed' | 'deleted' | null; scanImageKey: string | null; scanImageMime: string | null; scanCapturedAt: string | null }>;
  people: Array<{ personId: string; name: string; email: string; cellDisplay: string; cellE164: string; status: 'active' | 'removed'; lastSeen?: string; timezone?: string; notes?: string }>;
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

type AppointmentDetailEvent = {
  id: string;
  tsUtc: string;
  type: string;
  actor: { actorType: 'HUMAN' | 'SYSTEM' | 'AGENT'; userKey?: string; email?: string };
  payload: Record<string, unknown>;
  sourceTextSnapshot?: string;
  clientRequestId?: string;
  proposalId?: string;
};
type AppointmentDetailResponse = {
  appointment: Snapshot['appointments'][0];
  eventsPage: AppointmentDetailEvent[];
  nextCursor: { chunkId: number; index: number } | null;
  projections: { discussionEvents: AppointmentDetailEvent[]; changeEvents: AppointmentDetailEvent[] };
};

type Session = { groupId: string; email: string; joinedAt: string };

const calendarWeekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SESSION_KEY = 'familyscheduler.session';
const BODY_PX = 2;
const createTraceId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `trace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};
const writeSession = (session: Session): void => {
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
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

export function AppShell({ groupId, sessionEmail, groupName: initialGroupName }: { groupId: string; sessionEmail: string; groupName?: string }) {
  const [message, setMessage] = useState('');
  const [groupName, setGroupName] = useState<string | undefined>(initialGroupName);
  const [usage, setUsage] = useState<UsageStatus>({ status: 'loading' });
  const [activeSection, setActiveSection] = useState<ShellSection>('calendar');
  const [calendarView, setCalendarView] = useState<CalendarView>('list');
  const [viewMenuAnchor, setViewMenuAnchor] = useState<null | HTMLElement>(null);
  const [monthCursor, setMonthCursor] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [weekCursor, setWeekCursor] = useState<Date>(() => new Date());
  const [dayCursor, setDayCursor] = useState<Date>(() => new Date());
  const isViewMenuOpen = Boolean(viewMenuAnchor);
  const calendarViewLabels: Record<CalendarView, string> = {
    list: 'List',
    month: 'Month',
    week: 'Week',
    day: 'Day'
  };

  const normalizeGroupName = (value: string) => value.trim().replace(/\s+/g, ' ');

  async function renameGroupName(nextName: string): Promise<void> {
    const normalized = normalizeGroupName(nextName);
    const traceId = createTraceId();
    if (!normalized) throw new Error('Group name is required.');
    if (normalized.length > 60) throw new Error('Group name must be 60 characters or fewer.');

    const response = await apiFetch('/api/group/rename', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ groupId, groupName: normalized, traceId })
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
  const [activeAppointmentCode, setActiveAppointmentCode] = useState<string | null>(null);
  const [whenDraftText, setWhenDraftText] = useState('');
  const [descDraftText, setDescDraftText] = useState('');
  const [locationDraftText, setLocationDraftText] = useState('');
  const [notesDraftText, setNotesDraftText] = useState('');
  const [whenDraftResult, setWhenDraftResult] = useState<TimeSpec | null>(null);
  const [whenDraftError, setWhenDraftError] = useState<string | null>(null);
  const [isWhenResolving, setIsWhenResolving] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Snapshot['appointments'][0] | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsAppointmentId, setDetailsAppointmentId] = useState<string | null>(null);
  const [detailsData, setDetailsData] = useState<AppointmentDetailResponse | null>(null);
  const [detailsTab, setDetailsTab] = useState<'discussion' | 'changes' | 'constraints'>('discussion');
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [detailsMessageText, setDetailsMessageText] = useState('');
  const [pendingProposal, setPendingProposal] = useState<null | { proposalId: string; field: 'title'; from: string; to: string; expiresAt: number; paused: boolean }>(null);
  const [proposalEditOpen, setProposalEditOpen] = useState(false);
  const [proposalEditValue, setProposalEditValue] = useState('');
  const [proposalNow, setProposalNow] = useState(() => Date.now());
  const [appointmentToDelete, setAppointmentToDelete] = useState<Snapshot['appointments'][0] | null>(null);
  const [personToDelete, setPersonToDelete] = useState<Snapshot['people'][0] | null>(null);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [personDraft, setPersonDraft] = useState<{ name: string; email: string }>({ name: '', email: '' });
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
  const breakoutInFlightRef = useRef(false);
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
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanCaptureBusy, setScanCaptureBusy] = useState(false);
  const [scanCaptureCameraReady, setScanCaptureCameraReady] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [quickAddText, setQuickAddText] = useState('');
  const [advancedText, setAdvancedText] = useState('');

  useEffect(() => {
    if (!pendingProposal || pendingProposal.paused) return;
    const timeoutMs = Math.max(0, pendingProposal.expiresAt - Date.now());
    const timer = window.setTimeout(() => {
      void applyPendingProposal();
    }, timeoutMs);
    return () => window.clearTimeout(timer);
  }, [pendingProposal]);

  useEffect(() => {
    if (!pendingProposal || pendingProposal.paused) return;
    const ticker = window.setInterval(() => setProposalNow(Date.now()), 250);
    return () => window.clearInterval(ticker);
  }, [pendingProposal]);

  useEffect(() => {
    if (!pendingProposal || !detailsData) return;
    const applied = detailsData.eventsPage.some((event) => event.type === 'FIELD_CHANGED' && event.proposalId === pendingProposal.proposalId && event.payload.field === 'title');
    if (applied) setPendingProposal(null);
  }, [detailsData, pendingProposal]);

  useEffect(() => {
    const hash = window.location.hash || '';
    const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
    const params = new URLSearchParams(query);
    const appointmentId = params.get('appointmentId');
    if (!appointmentId || detailsOpen) return;
    const appointment = snapshot.appointments.find((entry) => entry.id === appointmentId);
    if (appointment) openAppointmentDetails(appointment);
  }, [snapshot.appointments, detailsOpen]);

  async function loadAppointmentDetails(appointmentId: string, cursor?: { chunkId: number; index: number } | null) {
    const response = await apiFetch('/api/direct', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ groupId, action: { type: 'get_appointment_detail', appointmentId, limit: 20, cursor: cursor ?? undefined }, traceId: createTraceId() })
    });
    const payload = await response.json() as { ok?: boolean; message?: string; appointment?: Snapshot['appointments'][0]; eventsPage?: AppointmentDetailEvent[]; nextCursor?: { chunkId: number; index: number } | null; projections?: { discussionEvents: AppointmentDetailEvent[]; changeEvents: AppointmentDetailEvent[] } };
    if (!response.ok || !payload.ok || !payload.appointment || !payload.eventsPage || !payload.projections) throw new Error(payload.message ?? 'Unable to load details');
    const next: AppointmentDetailResponse = { appointment: payload.appointment, eventsPage: payload.eventsPage, nextCursor: payload.nextCursor ?? null, projections: payload.projections };
    setDetailsData((prev) => {
      if (!cursor || !prev) return next;
      const merged = [...prev.eventsPage, ...next.eventsPage.filter((event) => !prev.eventsPage.some((existing) => existing.id === event.id))];
      return {
        ...next,
        eventsPage: merged,
        projections: {
          discussionEvents: merged.filter((event) => event.type === 'USER_MESSAGE' || event.type === 'SYSTEM_CONFIRMATION' || event.type === 'PROPOSAL_CREATED'),
          changeEvents: merged.filter((event) => event.type === 'FIELD_CHANGED')
        }
      };
    });
  }

  function openAppointmentDetails(appt: Snapshot['appointments'][0]) {
    setDetailsOpen(true);
    setDetailsAppointmentId(appt.id);
    setDetailsTab('discussion');
    void loadAppointmentDetails(appt.id);
  }

  function closeAppointmentDetails() {
    setDetailsOpen(false);
    setDetailsAppointmentId(null);
    setDetailsData(null);
    setPendingProposal(null);
    setProposalEditOpen(false);
    setProposalEditValue('');
    setDetailsMessageText('');
  }

  const sendDetailsMessage = async () => {
    if (!detailsAppointmentId || !detailsMessageText.trim()) return;
    const text = detailsMessageText.trim();
    setDetailsMessageText('');
    const clientRequestId = createTraceId();
    const response = await apiFetch('/api/direct', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ groupId, action: { type: 'append_appointment_message', appointmentId: detailsAppointmentId, text, clientRequestId }, traceId: createTraceId() })
    });
    const payload = await response.json() as { ok?: boolean; appendedEvents?: AppointmentDetailEvent[]; proposal?: { proposalId: string; field: 'title'; from: string; to: string } | null };
    if (!response.ok || !payload.ok) return;
    const newEvents = payload.appendedEvents ?? [];
    setDetailsData((prev) => prev ? {
      ...prev,
      eventsPage: [...newEvents, ...prev.eventsPage],
      projections: {
        discussionEvents: [...newEvents, ...prev.eventsPage].filter((event) => event.type === 'USER_MESSAGE' || event.type === 'SYSTEM_CONFIRMATION' || event.type === 'PROPOSAL_CREATED'),
        changeEvents: [...newEvents, ...prev.eventsPage].filter((event) => event.type === 'FIELD_CHANGED')
      }
    } : prev);
    if (payload.proposal) setPendingProposal({ ...payload.proposal, expiresAt: Date.now() + 5000, paused: false });
  };

  const applyPendingProposal = async () => {
    if (!detailsAppointmentId || !pendingProposal) return;
    const clientRequestId = createTraceId();
    const response = await apiFetch('/api/direct', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ groupId, action: { type: 'apply_appointment_proposal', appointmentId: detailsAppointmentId, proposalId: pendingProposal.proposalId, field: pendingProposal.field, value: pendingProposal.to, clientRequestId }, traceId: createTraceId() })
    });
    const payload = await response.json() as { ok?: boolean; appointment?: Snapshot['appointments'][0]; appendedEvents?: AppointmentDetailEvent[] };
    if (!response.ok || !payload.ok) return;
    setPendingProposal(null);
    setDetailsData((prev) => prev ? {
      appointment: payload.appointment ?? prev.appointment,
      nextCursor: prev.nextCursor,
      eventsPage: [ ...(payload.appendedEvents ?? []), ...prev.eventsPage ],
      projections: {
        discussionEvents: [ ...(payload.appendedEvents ?? []), ...prev.eventsPage ].filter((event) => event.type === 'USER_MESSAGE' || event.type === 'SYSTEM_CONFIRMATION' || event.type === 'PROPOSAL_CREATED'),
        changeEvents: [ ...(payload.appendedEvents ?? []), ...prev.eventsPage ].filter((event) => event.type === 'FIELD_CHANGED')
      }
    } : prev);
    if (payload.appointment) {
      setSnapshot((prev) => ({ ...prev, appointments: prev.appointments.map((appt) => appt.id === payload.appointment!.id ? payload.appointment! : appt) }));
    }
  };

  const cancelPendingProposal = async () => {
    if (!detailsAppointmentId || !pendingProposal) return;
    const clientRequestId = createTraceId();
    const response = await apiFetch('/api/direct', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ groupId, action: { type: 'dismiss_appointment_proposal', appointmentId: detailsAppointmentId, proposalId: pendingProposal.proposalId, field: pendingProposal.field, clientRequestId }, traceId: createTraceId() })
    });
    const payload = await response.json() as { ok?: boolean; appendedEvents?: AppointmentDetailEvent[] };
    if (!response.ok || !payload.ok) return;
    setPendingProposal(null);
    setDetailsData((prev) => prev ? {
      ...prev,
      eventsPage: [ ...(payload.appendedEvents ?? []), ...prev.eventsPage ],
      projections: {
        discussionEvents: [ ...(payload.appendedEvents ?? []), ...prev.eventsPage ].filter((event) => event.type === 'USER_MESSAGE' || event.type === 'SYSTEM_CONFIRMATION' || event.type === 'PROPOSAL_CREATED'),
        changeEvents: [ ...(payload.appendedEvents ?? []), ...prev.eventsPage ].filter((event) => event.type === 'FIELD_CHANGED')
      }
    } : prev);
  };

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
      const response = await apiFetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: trimmed, groupId, ...extraBody }) });
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
    const response = await apiFetch('/api/direct', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, groupId }) });
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
    if (created) {
      setActiveAppointmentCode(created.code);
      openWhenEditor(created);
    }
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
    setActiveAppointmentCode(appointment.code);
    setWhenEditorCode(appointment.code);
    setWhenDraftText(appointment.time?.intent?.originalText ?? '');
    setDescDraftText(appointment.desc ?? '');
    setLocationDraftText(appointment.locationRaw ?? appointment.location ?? '');
    setNotesDraftText(appointment.notes ?? '');
    setWhenDraftResult(null);
    setWhenDraftError(null);
    setIsWhenResolving(false);
  };

  const closeWhenEditor = () => {
    setWhenEditorCode(null);
    setWhenDraftText('');
    setDescDraftText('');
    setLocationDraftText('');
    setNotesDraftText('');
    setWhenDraftResult(null);
    setWhenDraftError(null);
    setIsWhenResolving(false);
  };

  const previewWhenDraft = async (appointment: Snapshot['appointments'][0]) => {
    const whenText = whenDraftText.trim();
    if (!whenText) {
      setWhenDraftResult(null);
      setWhenDraftError('Enter a date/time to resolve.');
      return;
    }
    const timezone = appointment.time?.resolved?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
    setIsWhenResolving(true);
    try {
      const response = await apiFetch('/api/direct', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          groupId,
          action: {
            type: 'resolve_appointment_time',
            appointmentId: appointment.code,
            whenText,
            timezone
          }
        })
      });
      const json = await response.json() as { ok?: boolean; time?: TimeSpec; message?: string };
      if (!response.ok || !json.ok || !json.time || json.time.intent.status !== 'resolved' || !json.time.resolved) {
        setWhenDraftResult(null);
        setWhenDraftError("Couldn't interpret that.");
        return;
      }
      setWhenDraftResult(json.time);
      setWhenDraftError(null);
    } catch (_error) {
      setWhenDraftResult(null);
      setWhenDraftError("Couldn't interpret that.");
    } finally {
      setIsWhenResolving(false);
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
    const resolvedDraft = whenDraftResult;
    if (!resolvedDraft || resolvedDraft.intent.status !== 'resolved' || !resolvedDraft.resolved) {
      setWhenDraftError('Resolve the appointment time before confirming.');
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
    setPersonDraft({ name: person.name, email: person.email || '' });
    setPersonEditError(null);
  };

  const cancelPersonEdit = async () => {
    const pendingId = pendingBlankPersonId;
    const editingId = editingPersonId;
    const draft = personDraft;
    setEditingPersonId(null);
    setPersonEditError(null);
    setPersonDraft({ name: '', email: '' });
    if (pendingId && editingId === pendingId && !draft.name.trim() && !draft.email.trim()) {
      await sendDirectAction({ type: 'delete_person', personId: pendingId });
    }
    setPendingBlankPersonId(null);
  };

  const submitPersonEdit = async () => {
    if (!editingPersonId) return;
    const result = await sendDirectAction({ type: 'update_person', personId: editingPersonId, name: personDraft.name, email: personDraft.email });
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
    setPersonDraft({ name: created?.name ?? '', email: created?.email ?? '' });
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
    const response = await apiFetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'list appointments', groupId }) });
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
    setScanError(null);
    setScanCaptureBusy(false);
    setScanCaptureCameraReady(false);
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
    setScanError(null);
    setScanCaptureBusy(false);
    setScanCaptureCameraReady(false);
    setScanCaptureModal({ appointmentId: null, useCameraPreview: false });
  };

  const readFileAsDataUrl = async (file: File): Promise<string> => await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('invalid_scan_payload'));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('invalid_scan_payload'));
    reader.readAsDataURL(file);
  });

  const canvasToJpegBlob = async (canvas: HTMLCanvasElement): Promise<Blob | null> => {
    let quality = 0.85;
    let result: Blob | null = null;
    while (quality >= 0.55) {
      // eslint-disable-next-line no-await-in-loop
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (!blob) return null;
      result = blob;
      if (blob.size <= 2_000_000) break;
      quality -= 0.1;
    }
    return result;
  };

  const shrinkImageFile = async (file: File): Promise<File> => {
    if (file.size <= 2_000_000) return file;
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('invalid_scan_payload'));
        img.src = objectUrl;
      });
      const maxEdge = 1600;
      const longestEdge = Math.max(image.width, image.height) || 1;
      const scale = longestEdge > maxEdge ? maxEdge / longestEdge : 1;
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) return file;
      context.drawImage(image, 0, 0, width, height);
      const blob = await canvasToJpegBlob(canvas);
      if (!blob) return file;
      return new File([blob], 'scan.jpg', { type: 'image/jpeg' });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const submitScanFile = async (inputFile: File, appointmentId?: string): Promise<boolean> => {
    try {
      const file = await shrinkImageFile(inputFile);
      const dataUrl = await readFileAsDataUrl(file);
      const [meta, b64] = dataUrl.split('base64,');
      const imageBase64 = b64 ?? '';
      const imageMime = meta.match(/data:(.*?);/)?.[1] ?? file.type ?? 'image/jpeg';
      if (!imageBase64.trim()) {
        setScanError('Scan image encoding failed. Please try a different image.');
        return false;
      }

      console.info({ event: 'scan_submit_start', bytes: file.size, mime: file.type });
      const endpoint = appointmentId ? '/api/appointmentScanRescan' : '/api/scanAppointment';
      const payload: Record<string, unknown> = { groupId, imageBase64, imageMime, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
      if (appointmentId) payload.appointmentId = appointmentId;
      const response = await apiFetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await response.json() as { ok?: boolean; error?: string; message?: string; traceId?: string; snapshot?: Snapshot; appointmentId?: string };
      console.info({ event: 'scan_submit_end', status: response.status, traceId: json.traceId ?? null });
      if (!response.ok || json.ok === false) {
        setScanError(`${json.message ?? json.error ?? `Scan request failed (${response.status})`}${json.traceId ? ` (trace: ${json.traceId})` : ''}`);
        return false;
      }
      if (json.snapshot) {
        setSnapshot(json.snapshot);
      } else if (endpoint === '/api/scanAppointment' && json.appointmentId) {
        const nowIso = new Date().toISOString();
        const placeholder: Snapshot['appointments'][number] = {
          id: json.appointmentId,
          code: `SCAN-${Date.now()}`,
          desc: 'Scanning…',
          updatedAt: nowIso,
          time: { intent: { status: 'unresolved', originalText: '' } },
          date: nowIso.slice(0, 10),
          isAllDay: true,
          people: [],
          peopleDisplay: [],
          location: '',
          locationRaw: '',
          locationDisplay: '',
          locationMapQuery: '',
          locationName: '',
          locationAddress: '',
          locationDirections: '',
          notes: '',
          scanStatus: 'pending',
          scanImageKey: null,
          scanImageMime: null,
          scanCapturedAt: nowIso
        };
        setSnapshot((prev) => {
          if (prev.appointments.some((appointment) => appointment.id === placeholder.id)) return prev;
          return { ...prev, appointments: [placeholder, ...prev.appointments] };
        });
        void refreshSnapshot();
      } else {
        await refreshSnapshot();
      }
      return true;
    } catch (error) {
      const traceId = error instanceof Error && 'traceId' in error && typeof error.traceId === 'string' ? error.traceId : null;
      setScanError(`Scanning failed. Please try again.${traceId ? ` (trace: ${traceId})` : ''}`);
      return false;
    }
  };

  const captureScanFrame = async () => {
    setScanError(null);
    const video = scanCaptureVideoRef.current;
    const canvas = scanCaptureCanvasRef.current;
    if (!video || !canvas) {
      setScanError('Could not capture image. Please reopen the scanner and try again.');
      return;
    }
    console.info({ event: 'scan_capture_click', w: video.videoWidth, h: video.videoHeight });
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setScanError('Camera not ready yet. Try again.');
      return;
    }
    setScanCaptureBusy(true);
    const maxEdge = 1600;
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      setScanCaptureBusy(false);
      setScanError('Could not capture image.');
      return;
    }
    context.drawImage(video, 0, 0, width, height);
    const blob = await canvasToJpegBlob(canvas);
    if (!blob) {
      setScanCaptureBusy(false);
      setScanError('Could not capture image.');
      return;
    }
    const file = new File([blob], 'scan.jpg', { type: blob.type || 'image/jpeg' });
    const target = scanTargetAppointmentId;
    const ok = await submitScanFile(file, target ?? undefined);
    if (!ok) {
      setScanCaptureBusy(false);
      return;
    }
    closeScanCaptureModal();
    setScanTargetAppointmentId(null);
  };

  const onPickScanFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const target = scanTargetAppointmentId;
    event.currentTarget.value = '';
    const ok = await submitScanFile(file, target ?? undefined);
    if (!ok) return;
    setScanTargetAppointmentId(null);
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
  const isScanCaptureReady = Boolean(scanCaptureVideoRef.current?.videoWidth && scanCaptureVideoRef.current?.videoHeight) || scanCaptureCameraReady;
  const activePeople = snapshot.people.filter((person) => person.status === 'active');
  const peopleInView = snapshot.people.filter((person) => person.status === 'active');
  const signedInPersonName = activePeople.find((person) => person.email.trim().toLowerCase() === sessionEmail.trim().toLowerCase())?.name?.trim() || null;

  useEffect(() => {
    if (!signedInPersonName) {
      window.localStorage.removeItem('fs.sessionName');
      return;
    }
    window.localStorage.setItem('fs.sessionName', signedInPersonName);
  }, [signedInPersonName]);
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
  const localDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const isSameLocalDay = (a: Date, b: Date) => (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  );
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
  const weekAnchor = weekCursor;
  const weekStart = new Date(weekAnchor);
  weekStart.setDate(weekAnchor.getDate() - weekAnchor.getDay());
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    return day;
  });
  const weekLabel = `Week of ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(weekStart)}`;
  const dayLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(dayCursor);

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
      const response = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: outgoing, groupId, ruleMode: 'draft', personId: rulePromptModal.person.personId, traceId, replacePromptId: editingPromptId ?? undefined, replaceRuleCode: legacyReplaceRuleCode ?? undefined })
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
      const response = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: rulePrompt.trim(),
          groupId,
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
    apiFetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'list appointments', groupId }) })
      .then(async (response) => {
        if (!response.ok) return;
        const json = (await response.json()) as ChatResponse;
        if (json.snapshot) setSnapshot(json.snapshot);
      });
  }, [groupId, sessionEmail]);

  useEffect(() => {
    if (!whenEditorCode) return;
    const exists = snapshot.appointments.some((appointment) => appointment.code === whenEditorCode);
    if (!exists) closeWhenEditor();
  }, [whenEditorCode, snapshot.appointments]);

  useEffect(() => {
    if (!activeAppointmentCode) return;
    if (calendarView !== 'list') return;
    const element = document.querySelector(`[data-appt-code="${activeAppointmentCode}"]`) as HTMLElement | null;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const fullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (fullyVisible) return;
    element.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeAppointmentCode, calendarView, sortedAppointments]);

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
    const name = (groupName ?? '').trim();
    document.title = name || '';
  }, [groupName]);

  useEffect(() => {
    if (!editingPersonId) return;
    personNameInputRef.current?.focus();
  }, [editingPersonId]);


  useEffect(() => {
    let canceled = false;

    const loadGroupMeta = async () => {
      try {
        const response = await apiFetch(`/api/group/meta?groupId=${encodeURIComponent(groupId)}`);
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
        const response = await apiFetch('/api/usage');
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
    let readyPollId: number | null = null;
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
      const pollReady = () => {
        if (!scanCaptureModal.useCameraPreview) return;
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          setScanCaptureCameraReady(true);
          return;
        }
        readyPollId = window.requestAnimationFrame(pollReady);
      };
      pollReady();
    };

    attachPreview();
    return () => {
      if (frameId != null) window.cancelAnimationFrame(frameId);
      if (readyPollId != null) window.cancelAnimationFrame(readyPollId);
    };
  }, [scanCaptureModal.useCameraPreview]);

  useEffect(() => () => {
    stopScanCaptureStream();
  }, []);

  const createBreakoutGroup = async () => {
    if (breakoutInFlightRef.current) return;
    breakoutInFlightRef.current = true;
    setBreakoutError(null);
    setIsSpinningOff(true);
    try {
      const result = await spinoffBreakoutGroup({ sourceGroupId: groupId });
      if (!result.ok) {
        setBreakoutError(`${result.message}${result.traceId ? ` (trace: ${result.traceId})` : ''}`);
        return;
      }

      setBreakoutError(null);
      window.location.hash = `/g/${result.newGroupId}/ignite`;
    } finally {
      breakoutInFlightRef.current = false;
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
        sessionEmail={sessionEmail}
        sessionName={signedInPersonName}
        onDashboardClick={() => window.location.assign(`${window.location.origin}/`)}
      />
      {breakoutError ? (
        <div className="ui-alert" style={{ maxWidth: 760, marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Breakout Session</div>
          <div style={{ color: 'var(--muted)' }}>{breakoutError}</div>
        </div>
      ) : null}
      <div className="ui-shell">
        <aside className="ui-sidebar" aria-hidden="true" />
        <section className="ui-main">
          {import.meta.env.DEV && snapshot.people.length === 0 ? <p className="dev-warning">Loaded group with 0 people — create flow may be broken.</p> : null}

          <Box sx={{ backgroundColor: 'background.default', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Tabs
              value={activeSection === 'members' ? 'members' : 'calendar'}
              onChange={(_event: SyntheticEvent, value: 'calendar' | 'members') => setActiveSection(value)}
              aria-label="Section tabs"
              sx={{
                minHeight: 40,
                '& .MuiTabs-flexContainer': { paddingLeft: BODY_PX, paddingRight: BODY_PX, gap: 1 },
                '& .MuiTabs-indicator': { display: 'none' }
              }}
            >
              <Tab
                value="calendar"
                label="Schedule"
                sx={{
                  textTransform: 'none',
                  borderRadius: 0,
                  minHeight: 40,
                  minWidth: 0,
                  px: 2,
                  backgroundColor: 'background.default',
                  '&:hover': { backgroundColor: 'action.hover' },
                  '&.Mui-selected': { backgroundColor: 'background.paper', position: 'relative', mb: '-1px', zIndex: 2, fontWeight: 600 }
                }}
              />
              <Tab
                value="members"
                label="Members"
                sx={{
                  textTransform: 'none',
                  borderRadius: 0,
                  minHeight: 40,
                  minWidth: 0,
                  px: 2,
                  backgroundColor: 'background.default',
                  '&:hover': { backgroundColor: 'action.hover' },
                  '&.Mui-selected': { backgroundColor: 'background.paper', position: 'relative', mb: '-1px', zIndex: 2, fontWeight: 600 }
                }}
              />
            </Tabs>
          </Box>

          <Paper variant="outlined" sx={{ borderTop: 'none', borderRadius: 0 }}>

          {activeSection === 'overview' ? <section className="panel"><p>Overview view coming soon.</p></section> : null}

          {activeSection === 'settings' ? <section className="panel"><p>Settings view coming soon.</p></section> : null}

          {activeSection === 'calendar' ? (
            <>
              <Box sx={{ px: BODY_PX, pb: 2, pt: 2 }}>
              <section className="ui-cal">
                  <Box>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ gap: 2 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Button
                          variant="text"
                          endIcon={<ExpandMoreIcon />}
                          onClick={(event) => setViewMenuAnchor(event.currentTarget)}
                          sx={{ textTransform: 'none', minWidth: 0, px: 1 }}
                          aria-haspopup="menu"
                          aria-expanded={isViewMenuOpen ? 'true' : undefined}
                          aria-label="Calendar view selector"
                        >
                          {calendarViewLabels[calendarView]}
                        </Button>
                        <Menu anchorEl={viewMenuAnchor} open={isViewMenuOpen} onClose={() => setViewMenuAnchor(null)}>
                          <MenuItem selected={calendarView === 'list'} onClick={() => { setCalendarView('list'); setViewMenuAnchor(null); }}>List</MenuItem>
                          <MenuItem selected={calendarView === 'month'} onClick={() => { setCalendarView('month'); setViewMenuAnchor(null); }}>Month</MenuItem>
                          <MenuItem selected={calendarView === 'week'} onClick={() => { setCalendarView('week'); setViewMenuAnchor(null); }}>Week</MenuItem>
                          <MenuItem selected={calendarView === 'day'} onClick={() => { setCalendarView('day'); setViewMenuAnchor(null); }}>Day</MenuItem>
                        </Menu>
                      </Box>
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
                        <Tooltip title="AI scan">
                          <span>
                            <IconButton className="ui-aiAction" onClick={() => setIsAdvancedOpen(true)} aria-label="AI scan" title="AI scan" disabled={commandActionsDisabled}>
                              <AutoAwesomeIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </Box>
                  <Divider />
                  <Box sx={{ pt: 2 }}>
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
                        const now = new Date();
                        const isToday =
                          day.getFullYear() === now.getFullYear() &&
                          day.getMonth() === now.getMonth() &&
                          day.getDate() === now.getDate();
                        return (
                          <div key={dateKey} className={`ui-cal-cell ${inMonth ? '' : 'ui-cal-outside'} ${isToday ? 'ui-cal-today' : ''}`}>
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
                          onOpenDetails={(appointment) => openAppointmentDetails(appointment)}
                          activeAppointmentCode={activeAppointmentCode}
                          scanViewIcon={<ReceiptLongOutlinedIcon fontSize="small" />}
                          editIcon={<Pencil />}
                          assignIcon={<GroupOutlinedIcon fontSize="small" />}
                          deleteIcon={<Trash2 />}
                        />
                      </>
                    ) : null}

                    {calendarView === 'week' ? (
                      <>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                          <IconButton size="small" aria-label="Previous week" onClick={() => setWeekCursor((prev) => { const next = new Date(prev); next.setDate(prev.getDate() - 7); return next; })}><ChevronLeft /></IconButton>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, minWidth: 170 }}>{weekLabel}</Typography>
                          <IconButton size="small" aria-label="Next week" onClick={() => setWeekCursor((prev) => { const next = new Date(prev); next.setDate(prev.getDate() + 7); return next; })}><ChevronRight /></IconButton>
                          <Button size="small" variant="outlined" onClick={() => setWeekCursor(new Date())}>Today</Button>
                        </Stack>
                        <div className="ui-week-grid">
                          {weekDays.map((day) => {
                            const dateKey = localDateKey(day);
                            const dayAppointments = appointmentsByDate[dateKey] ?? [];
                            const dayTodos = todosByDate[dateKey] ?? [];
                            const isToday = isSameLocalDay(day, new Date());
                            return (
                              <div key={dateKey} className={`ui-week-col ${isToday ? 'ui-cal-today' : ''}`}>
                                <div className="ui-week-colHeader">
                                  <div className="ui-week-colHeaderTop">
                                    <span className="ui-week-dow">{new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(day)}</span>
                                    <span className="ui-week-dateNum">{day.getDate()}</span>
                                  </div>
                                  <button type="button" className="ui-cal-dayPlus" aria-label={`Add appointment for ${dateKey}`} onClick={() => { void addAppointment(); }}>+</button>
                                </div>
                                <div className="ui-week-items">
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

                    {calendarView === 'day' ? (
                      <>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                          <IconButton size="small" aria-label="Previous day" onClick={() => setDayCursor((prev) => { const next = new Date(prev); next.setDate(prev.getDate() - 1); return next; })}><ChevronLeft /></IconButton>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, minWidth: 220 }}>{dayLabel}</Typography>
                          <IconButton size="small" aria-label="Next day" onClick={() => setDayCursor((prev) => { const next = new Date(prev); next.setDate(prev.getDate() + 1); return next; })}><ChevronRight /></IconButton>
                          <Button size="small" variant="outlined" onClick={() => setDayCursor(new Date())}>Today</Button>
                        </Stack>
                        {(() => {
                          const dateKey = localDateKey(dayCursor);
                          const dayAppointments = appointmentsByDate[dateKey] ?? [];
                          const dayTodos = todosByDate[dateKey] ?? [];
                          const isToday = isSameLocalDay(dayCursor, new Date());
                          return (
                            <div className="ui-day">
                              <div className={`ui-dayHeader ${isToday ? 'ui-cal-today' : ''}`}>
                                <div className="ui-dayHeaderTitle">{dayLabel}</div>
                                <button type="button" className="ui-cal-dayPlus" aria-label={`Add appointment for ${dateKey}`} onClick={() => { void addAppointment(); }}>+</button>
                              </div>
                              <div className="ui-dayItems">
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
                                {dayAppointments.length === 0 && dayTodos.length === 0 ? <Typography variant="body2" color="text.secondary">No items for this day.</Typography> : null}
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    ) : null}
                  </Box>
              </section>
            </Box>
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
            <Box sx={{ px: BODY_PX, pb: 2, pt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>People</Typography>
                <Tooltip title="Add person">
                  <span>
                    <IconButton color="primary" onClick={() => { void addPerson(); }} aria-label="Add person">
                      <Plus />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
              {peopleInView.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  No people added yet.
                </Typography>
              ) : null}
              <div className="ui-membersTableWrap">
                    <table className="ui-membersTable">
                      <thead><tr><th>Name</th><th className="email-col">Email</th><th>Last seen</th><th>Actions</th></tr></thead>
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
                          <td className="email-col">
                            {isEditingPerson ? <input type="email" value={personDraft.email} onChange={(event) => setPersonDraft((prev) => ({ ...prev, email: event.target.value }))} onKeyDown={(event) => onNewPersonRowKeyDown(event, isNewRowEditing)} placeholder="name@example.com" /> : <span>{person.email || '—'}</span>}
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
                              <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                                <Tooltip title="Rules">
                                  <IconButton size="small" aria-label="Rules" onClick={() => openRulePromptModal(person)}>
                                    <Clock3 />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title={isEditingPerson ? 'Save person' : 'Edit person'}>
                                  <IconButton
                                    size="small"
                                    aria-label={isEditingPerson ? 'Save person' : 'Edit person'}
                                    onClick={() => { if (isEditingPerson) void submitPersonEdit(); else startEditingPerson(person); }}
                                  >
                                    <Pencil />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete person">
                                  <IconButton size="small" aria-label="Delete person" onClick={() => setPersonToDelete(person)}>
                                    <Trash2 />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
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
                                            <Stack direction="row" spacing={0.5} alignItems="center">
                                              <Tooltip title="Edit rule">
                                                <IconButton
                                                  size="small"
                                                  aria-label="Edit rule"
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
                                                </IconButton>
                                              </Tooltip>
                                              <Tooltip title="Delete rule">
                                                <IconButton size="small" aria-label="Delete rule" onClick={() => setRuleToDelete(rule)}>
                                                  <Trash2 />
                                                </IconButton>
                                              </Tooltip>
                                            </Stack>
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
          ) : null}
          </Paper>
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
          <Button type="button" variant="outlined" onClick={() => void sendMessage('cancel')}>Cancel</Button>
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
          <Button type="button" variant="outlined" onClick={() => setAppointmentToDelete(null)}>Cancel</Button>
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
              src={apiUrl(`/api/appointmentScanImage?groupId=${encodeURIComponent(groupId)}&appointmentId=${encodeURIComponent(scanViewerAppointment.id)}`)}
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
              void apiFetch('/api/appointmentScanDelete', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ groupId, appointmentId })
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
          {!isScanCaptureReady && !scanCaptureBusy ? <Alert severity="info" sx={{ mt: 2 }}>Camera warming up…</Alert> : null}
          {scanCaptureBusy ? <Alert severity="info" sx={{ mt: 2 }}>Uploading and scanning…</Alert> : null}
          {scanError ? <Alert severity="error" sx={{ mt: 2 }}>{scanError}</Alert> : null}
          <canvas ref={scanCaptureCanvasRef} style={{ display: 'none' }} />
        </DialogContent>
        <DialogActions>
          <Button type="button" variant="outlined" onClick={closeScanCaptureModal} disabled={scanCaptureBusy}>Cancel</Button>
          <Button type="button" variant="contained" onClick={() => { void captureScanFrame(); }} disabled={!isScanCaptureReady || scanCaptureBusy}>{scanCaptureBusy ? 'Scanning…' : 'Capture'}</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(personToDelete)} onClose={() => setPersonToDelete(null)} fullWidth maxWidth="sm">
        <DialogTitle>{personToDelete ? `Delete ${personToDelete.name || personToDelete.personId}?` : 'Delete person?'}</DialogTitle>
        <DialogContent>
          <Typography>This will remove this person from the active allowlist. Existing history and appointments are preserved.</Typography>
        </DialogContent>
        <DialogActions>
          <Button type="button" variant="outlined" onClick={() => setPersonToDelete(null)}>Cancel</Button>
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
          <Button type="button" variant="outlined" onClick={() => setRuleToDelete(null)}>Cancel</Button>
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
          <Button type="button" variant="outlined" onClick={closeRulePromptModal}>Cancel</Button>
          <Button type="button" variant="contained" onClick={() => void confirmRulePrompt()} disabled={!hasProposedRules || isConfirming}>{isConfirming ? 'Confirming…' : 'Add Rule'}</Button>
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

      <Drawer open={detailsOpen} title={detailsData?.appointment.desc || 'Appointment details'} onClose={closeAppointmentDetails}>
        {detailsData ? (
          <Stack spacing={1.5}>
            <Box>
              <Button size="small" onClick={() => setHeaderCollapsed((prev) => !prev)}>{headerCollapsed ? 'Expand header' : 'Collapse header'}</Button>
              {!headerCollapsed ? (
                <Stack spacing={0.5}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{detailsData.appointment.desc || 'Appointment'}</Typography>
                  <Typography variant="body2" color="text.secondary">🕒 {formatAppointmentTime(detailsData.appointment)}</Typography>
                  <Typography variant="body2" color="text.secondary">📍 {detailsData.appointment.locationDisplay || detailsData.appointment.location || 'No location'}</Typography>
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">{detailsData.appointment.desc || 'Appointment'} · {formatAppointmentTime(detailsData.appointment)} · {detailsData.appointment.locationDisplay || detailsData.appointment.location || 'No location'}</Typography>
              )}
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button size="small" variant="outlined" onClick={async () => {
                  const params = new URLSearchParams();
                  params.set('appointmentId', detailsData.appointment.id);
                  await navigator.clipboard.writeText(`${window.location.origin}/#/g/${groupId}/app?${params.toString()}`);
                }}>Share</Button>
                <Button size="small" variant="outlined" disabled>Notify (coming soon)</Button>
              </Stack>
            </Box>
            <Tabs value={detailsTab} onChange={(_e, value) => setDetailsTab(value)}>
              <Tab value="discussion" label="Discussion" />
              <Tab value="changes" label="Changes" />
              <Tab value="constraints" label="Constraints" />
            </Tabs>
            {detailsTab === 'discussion' ? (
              <Stack spacing={1}>
                {detailsData.nextCursor ? <Button size="small" onClick={() => void loadAppointmentDetails(detailsData.appointment.id, detailsData.nextCursor)}>Load earlier</Button> : null}
                {[...detailsData.projections.discussionEvents].reverse().map((event) => (
                  <Paper key={event.id} variant="outlined" sx={{ p: 1 }}>
                    <Typography variant="caption" color="text.secondary">{new Date(event.tsUtc).toLocaleString()} · {event.type}</Typography>
                    <Typography variant="body2">{String(event.payload.message ?? event.payload.text ?? event.payload.to ?? event.payload.value ?? '')}</Typography>
                  </Paper>
                ))}
                {pendingProposal ? (
                  <Paper variant="outlined" sx={{ p: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Proposed title change:</Typography>
                    <Typography variant="body2">“{pendingProposal.from || '(empty)'}” → “{pendingProposal.to}”</Typography>
                    <Typography variant="caption" color="text.secondary">{pendingProposal.paused ? 'Paused' : `${Math.max(0, Math.ceil((pendingProposal.expiresAt - proposalNow) / 1000))}s remaining`}</Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                      <Button size="small" variant="contained" onClick={() => void applyPendingProposal()}>Apply Now</Button>
                      <Button size="small" onClick={() => setPendingProposal((prev) => prev ? { ...prev, paused: !prev.paused } : prev)}>{pendingProposal.paused ? 'Resume' : 'Pause'}</Button>
                      <Button size="small" onClick={() => void cancelPendingProposal()}>Cancel</Button>
                      <Button size="small" onClick={() => { setProposalEditValue(pendingProposal.to); setProposalEditOpen(true); }}>Edit</Button>
                    </Stack>
                  </Paper>
                ) : null}
                <Stack direction="row" spacing={1}>
                  <TextField fullWidth size="small" placeholder="Message" value={detailsMessageText} onChange={(event) => setDetailsMessageText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void sendDetailsMessage(); } }} />
                  <Button variant="contained" onClick={() => void sendDetailsMessage()} disabled={!detailsMessageText.trim()}>Send</Button>
                </Stack>
              </Stack>
            ) : null}
            {detailsTab === 'changes' ? (
              <Stack spacing={1}>
                {detailsData.projections.changeEvents.map((event) => (
                  <Paper key={event.id} variant="outlined" sx={{ p: 1 }} title={event.sourceTextSnapshot || ''}>
                    <Typography variant="body2">{String(event.payload.field)}: {String(event.payload.from ?? event.payload.oldValue ?? '')} → {String(event.payload.to ?? event.payload.newValue ?? '')}</Typography>
                    <Typography variant="caption" color="text.secondary">{new Date(event.tsUtc).toLocaleString()}</Typography>
                  </Paper>
                ))}
              </Stack>
            ) : null}
            {detailsTab === 'constraints' ? <Alert severity="info">Coming soon.</Alert> : null}
          </Stack>
        ) : <Typography variant="body2" color="text.secondary">Loading…</Typography>}
      </Drawer>

      <Dialog open={proposalEditOpen} onClose={() => setProposalEditOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Edit proposed title</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth size="small" sx={{ mt: 1 }} value={proposalEditValue} onChange={(event) => setProposalEditValue(event.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProposalEditOpen(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={() => {
              setPendingProposal((prev) => prev ? { ...prev, to: proposalEditValue.trim().replace(/\s+/g, ' ') } : prev);
              setProposalEditOpen(false);
            }}
            disabled={!proposalEditValue.trim()}
          >
            Save
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

      <Dialog open={whenEditorCode != null} onClose={closeWhenEditor} maxWidth="sm" fullWidth>
        <DialogTitle>Edit appointment</DialogTitle>
        <DialogContent dividers sx={{ py: 2 }}>
          {editingAppointment ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {editingAppointment.code} · {editingAppointment.time?.intent?.status === 'resolved' ? 'Resolved' : 'Unresolved'}
            </Typography>
          ) : null}
          {editingAppointment ? (
            <AppointmentEditorForm
              whenValue={whenDraftText}
              descriptionValue={descDraftText}
              locationValue={locationDraftText}
              notesValue={notesDraftText}
              onWhenChange={(next) => {
                setWhenDraftText(next);
                setWhenDraftResult(null);
                setWhenDraftError(null);
              }}
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
              onAcceptPreview={() => {
                if (!whenDraftResult || whenDraftResult.intent.status !== 'resolved') return;
                setWhenDraftText(formatAppointmentTime({ ...editingAppointment, time: whenDraftResult }));
              }}
              isResolving={isWhenResolving}
              canResolve={!whenDraftResult}
              previewDisplayText={whenDraftResult?.intent.status === 'resolved' ? formatAppointmentTime({ ...editingAppointment, time: whenDraftResult }) : null}
              errorText={whenDraftError}
              assumptions={whenDraftResult?.intent?.assumptions ?? []}
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
